import "server-only";
import { and, asc, eq, gt, ilike, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointmentRecords, appointments, garmentTypes } from "@/db/schema";
import { ApiError } from "@/lib/api-route";
import { text } from "@/lib/api-input";
import { dhakaDate } from "@/lib/appointments";
import { recordAudit } from "@/server/audit";
import { resolvePerson, type Transaction } from "@/server/repositories/people";
import { validateBusinessSlot } from "@/server/cms/booking";
import { garmentsByAppointment, hasGarmentsColumn, mergeGarmentsIntoNotes } from "./appointment-garments";
import { authorize, changedFields, choice, page, personFields, present, searchTerms, labelTerm, required, uuid, type Actor, type Input, type ListOptions } from "./ops-common";

const STATES = ["booked", "confirmed", "done", "no_show", "cancelled"];
const TRANSITIONS: Record<string, string[]> = { booked: ["confirmed", "no_show", "cancelled"], confirmed: ["done", "no_show", "cancelled"], done: [], no_show: ["booked", "confirmed"], cancelled: ["booked", "confirmed"] };
function localTime(start: Date) {
  return new Date(start.getTime() + 6 * 3600000).toISOString().slice(11, 16);
}
function dto(row: typeof appointments.$inferSelect, garments: string[] = []) {
  return { ...row, garments, date: dhakaDate(row.startsAt), slot: localTime(row.startsAt) };
}
async function withGarments(rows: (typeof appointments.$inferSelect)[]) {
  const map = await garmentsByAppointment(rows.map((row) => row.id));
  return rows.map((row) => dto(row, map.get(row.id) ?? []));
}
/**
 * "কী বানাতে চান" — names the customer picked on the booking form.
 * Accepts an array (public form / API) or a comma-separated string
 * (admin forms). When the shop has active garments in the catalog,
 * every picked name must be one of them, so the public list always
 * matches what the admin panel has added and activated.
 */
async function garmentNames(input: Input, current?: string[]): Promise<string[]> {
  const raw = input.garments ?? input.garmentNames;
  if (raw === undefined) return current ?? [];
  const list = Array.isArray(raw)
    ? raw.map((item) => String(item ?? "").trim())
    : typeof raw === "string"
      ? raw.split(/[,،]/).map((item) => item.trim())
      : [];
  const names = [...new Set(list.filter(Boolean))];
  if (names.length > 20 || names.some((name) => name.length > 150)) {
    throw new ApiError(422, "VALIDATION_ERROR", "বানাতে চাওয়া পোশাকের তালিকা সঠিক নয়");
  }
  if (names.length) {
    const active = await db.select({ nameBn: garmentTypes.nameBn }).from(garmentTypes).where(eq(garmentTypes.isActive, true));
    if (active.length) {
      const allowed = new Set(active.map((row) => row.nameBn));
      if (names.some((name) => !allowed.has(name))) {
        throw new ApiError(422, "VALIDATION_ERROR", "তালিকা থেকে পোশাক বেছে নিন");
      }
    }
  }
  return names;
}
async function lockDates(tx: Transaction, dates: string[]) {
  for (const date of [...new Set(dates)].sort()) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"appointment-date:" + date}))`);
}
async function available(tx: Transaction, start: Date, end: Date, excludeId?: string) {
  const [clash] = await tx.select({ id: appointmentRecords.id }).from(appointmentRecords).where(and(lt(appointmentRecords.startsAt, end), gt(appointmentRecords.endsAt, start), ne(appointmentRecords.status, "cancelled"), ne(appointmentRecords.status, "no_show"), excludeId ? ne(appointmentRecords.id, excludeId) : undefined)).limit(1);
  if (clash) throw new ApiError(409, "SLOT_TAKEN", "এই সময়টি ইতিমধ্যে বুক করা হয়েছে");
}
export async function listAppointments(actor: Actor, options?: ListOptions) {
  authorize(actor, "admin");
  const p = page(options), t = searchTerms(p.q), status = labelTerm(p.q, { "বাতিল": "cancelled", "আসেননি": "no_show", "সম্পন্ন": "done", "নিশ্চিত": "confirmed", "বুক": "booked" });
  const filter = p.q ? or(ilike(appointments.name, "%" + t.raw + "%"), ilike(appointments.phone, "%" + t.normalized + "%"), t.digits ? ilike(appointments.phone, "%" + t.digits + "%") : undefined, ilike(appointments.purpose, "%" + t.raw + "%"), status ? eq(appointments.status, status) : undefined) : undefined;
  const [rows, count] = await Promise.all([db.select().from(appointments).where(filter).orderBy(asc(appointments.startsAt)).limit(p.limit).offset(p.offset), db.select({ n: sql<number>`count(*)::int` }).from(appointments).where(filter)]);
  return { rows: await withGarments(rows), total: count[0].n, page: p.page, limit: p.limit };
}
export async function getAppointment(actor: Actor, id: string) {
  authorize(actor, "admin");
  const row = present((await db.select().from(appointments).where(eq(appointments.id, uuid(id))).limit(1))[0], "অ্যাপয়েন্টমেন্ট");
  return (await withGarments([row]))[0];
}
export async function createAppointment(actor: Actor | null, input: Input) {
  if (actor) authorize(actor, "admin");
  const date = required(input.date, "তারিখ", 10), slot = required(input.slot ?? input.time, "সময়", 5);
  await validateBusinessSlot(date, slot);
  const purpose = required(input.purpose, "উদ্দেশ্য", 150);
  const garments = await garmentNames(input);
  const locationType = choice(input.locationType ?? input.location_type, ["shop", "home"], "স্থান", "shop");
  const address = text(input.address, "ঠিকানা", 1000) || null;
  if (locationType === "home" && (!address || address.length < 5)) throw new ApiError(422, "VALIDATION_ERROR", "বাড়িতে মাপ নেওয়ার ঠিকানা দিন");
  const status = actor ? choice(input.status, STATES, "অবস্থা", "confirmed") : "booked";
  if (!["booked", "confirmed"].includes(status)) throw new ApiError(422, "VALIDATION_ERROR", "নতুন অ্যাপয়েন্টমেন্ট বুক বা নিশ্চিত করুন");
  // If migration 0002 has not been applied yet, keep the picks in notes
  // instead of failing the whole booking with a 500.
  const useGarmentsColumn = await hasGarmentsColumn();
  const rawNotes = text(input.notes, "নোট", 2000) || null;
  const notes = useGarmentsColumn ? rawNotes : mergeGarmentsIntoNotes(rawNotes, garments);
  const id = await db.transaction(async (tx) => {
    await lockDates(tx, [date]);
    const window = await validateBusinessSlot(date, slot, Date.now(), tx);
    await available(tx, window.start, window.end);
    const person = actor && input.personId ? await resolvePerson(tx, {}, uuid(input.personId)) : await resolvePerson(tx, personFields(input));
    if (!person.phone) throw new ApiError(422, "VALIDATION_ERROR", "অ্যাপয়েন্টমেন্টের জন্য ফোন নম্বর প্রয়োজন");
    // Drizzle always names every table column in an INSERT, so on a
    // database without the garments column the fallback insert is raw SQL
    // naming only the columns that exist there.
    const [created] = useGarmentsColumn
      ? await tx.insert(appointmentRecords).values({ personId: person.id, purpose, garments, startsAt: window.start, endsAt: window.end, status, locationType, address, notes }).returning({ id: appointmentRecords.id })
      : await tx.execute(sql`insert into appointments (person_id, purpose, starts_at, ends_at, status, location_type, address, notes) values (${person.id}, ${purpose}, ${window.start}, ${window.end}, ${status}, ${locationType}, ${address}, ${notes}) returning id`).then((r) => (r as unknown as { rows: { id: string }[] }).rows);
    await recordAudit(tx, { actorId: actor?.userId, action: "create", entity: "appointment", entityId: created.id, details: { personId: person.id, status } });
    return created.id;
  });
  const row = present((await db.select().from(appointments).where(eq(appointments.id, id)).limit(1))[0], "অ্যাপয়েন্টমেন্ট");
  return dto(row, useGarmentsColumn ? garments : []);
}
export async function updateAppointment(actor: Actor, id: string, input: Input) {
  authorize(actor, "admin");
  const appointmentId = uuid(id);
  const nextGarments = await garmentNames(input, undefined);
  const useGarmentsColumn = await hasGarmentsColumn();
  await db.transaction(async (tx) => {
    const current = present((await tx.select({
      id: appointmentRecords.id, personId: appointmentRecords.personId, purpose: appointmentRecords.purpose,
      startsAt: appointmentRecords.startsAt, endsAt: appointmentRecords.endsAt, status: appointmentRecords.status,
      locationType: appointmentRecords.locationType, address: appointmentRecords.address, notes: appointmentRecords.notes,
    }).from(appointmentRecords).where(eq(appointmentRecords.id, appointmentId)).for("update"))[0], "অ্যাপয়েন্টমেন্ট");
    if (input.personId !== undefined && input.personId !== current.personId) throw new ApiError(422, "IDENTITY_IMMUTABLE", "অ্যাপয়েন্টমেন্টের ব্যক্তিকে বদলানো যাবে না");
    const identityChanges = personFields(input);
    if (Object.keys(identityChanges).length) {
      authorize(actor, "management");
      await resolvePerson(tx, identityChanges, current.personId);
    }
    const status = choice(input.status, STATES, "অবস্থা", current.status);
    if (status !== current.status && !TRANSITIONS[current.status]?.includes(status)) throw new ApiError(409, "STATE_ERROR", "এই অবস্থায় পরিবর্তন করা যাবে না");
    const date = input.date === undefined ? dhakaDate(current.startsAt) : required(input.date, "তারিখ", 10);
    const slot = input.slot === undefined && input.time === undefined ? localTime(current.startsAt) : required(input.slot ?? input.time, "সময়", 5);
    let startsAt = current.startsAt, endsAt = current.endsAt;
    const rescheduled = date !== dhakaDate(current.startsAt) || slot !== localTime(current.startsAt);
    if (rescheduled || (["cancelled", "no_show"].includes(current.status) && ["booked", "confirmed"].includes(status))) {
      if (current.status === "done") throw new ApiError(409, "STATE_ERROR", "সম্পন্ন অ্যাপয়েন্টমেন্টের সময় বদলানো যাবে না");
      await validateBusinessSlot(date, slot, Date.now(), tx);
      await lockDates(tx, [date, dhakaDate(current.startsAt)]);
      const window = await validateBusinessSlot(date, slot, Date.now(), tx);
      await available(tx, window.start, window.end, appointmentId);
      startsAt = window.start; endsAt = window.end;
    }
    const locationType = choice(input.locationType, ["shop", "home"], "স্থান", current.locationType);
    const address = input.address === undefined ? current.address : text(input.address, "ঠিকানা", 1000) || null;
    if (locationType === "home" && (!address || address.length < 5)) throw new ApiError(422, "VALIDATION_ERROR", "বাড়িতে মাপ নেওয়ার ঠিকানা দিন");
    const garmentsTouched = input.garments !== undefined || input.garmentNames !== undefined;
    const nextNotes = input.notes === undefined ? current.notes : text(input.notes, "নোট", 2000) || null;
    await tx.update(appointmentRecords).set({ status, startsAt, endsAt, purpose: input.purpose === undefined ? current.purpose : required(input.purpose, "উদ্দেশ্য", 150), ...(useGarmentsColumn && garmentsTouched ? { garments: nextGarments } : {}), locationType, address, notes: !useGarmentsColumn && garmentsTouched ? mergeGarmentsIntoNotes(nextNotes, nextGarments) : nextNotes, updatedAt: new Date() }).where(eq(appointmentRecords.id, appointmentId));
    await recordAudit(tx, { actorId: actor.userId, action: "update", entity: "appointment", entityId: appointmentId, details: { fields: changedFields(input), fromStatus: current.status, toStatus: status } });
  });
  return getAppointment(actor, appointmentId);
}
export async function changeAppointmentStatus(actor: Actor, id: string, status: string) {
  return updateAppointment(actor, id, { status });
}
export async function cancelAppointment(actor: Actor, id: string) {
  return changeAppointmentStatus(actor, id, "cancelled");
}
