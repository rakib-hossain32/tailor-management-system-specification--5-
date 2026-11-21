"use server";

import { requireAdmin } from "@/lib/access";

import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, measurementProfiles } from "@/db/schema";
import { isValidBdPhone, normalizePhone } from "@/lib/format";

export async function createCustomer(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const altPhone = String(formData.get("alt_phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const birthDate = String(formData.get("birth_date") ?? "").slice(0, 10);
  const notes = String(formData.get("notes") ?? "").trim();
  const profileName = String(formData.get("profile_name") ?? "নিজে").trim() || "নিজে";
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6);

  const fail = (msg: string) => redirect(`/admin/customers/new?error=${encodeURIComponent(msg)}`);

  if (name.length < 2) fail("কাস্টমারের নাম দিন");
  if (!isValidBdPhone(phone)) fail("সঠিক ফোন নম্বর দিন (01XXXXXXXXX)");

  const dup = await db
    .select({ id: customers.id })
    .from(customers)
    .where(sql`${customers.phone} = ${phone}`)
    .limit(1);
  if (dup.length > 0) {
    redirect(`/admin/customers/${dup[0].id}?error=${encodeURIComponent("এই ফোন নম্বরে কাস্টমার আছেন")}`);
  }

  const [row] = await db
    .insert(customers)
    .values({
      name,
      phone,
      altPhone: altPhone || null,
      email: email || null,
      address: address || null,
      gender: gender || null,
      birthDate: birthDate || null,
      notes: notes || null,
      tags,
    })
    .returning({ id: customers.id });

  await db.insert(measurementProfiles).values({
    customerId: row.id,
    displayName: profileName,
    relation: profileName === "নিজে" ? "self" : null,
    gender: gender || null,
    birthDate: birthDate || null,
    isDefault: true,
    bodyNotes: notes || null,
  });

  redirect(`/admin/customers/${row.id}?ok=${encodeURIComponent("নতুন কাস্টমার তৈরি হয়েছে — এখন মাপ নিন")}`);
}
