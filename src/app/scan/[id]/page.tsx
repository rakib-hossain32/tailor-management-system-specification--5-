import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appointments, orderItems, orders, tasks } from "@/db/schema";
import { getStaffSession } from "@/lib/access";
import { isAdminRole } from "@/lib/auth";
import { dateBn, formatPhone, taka } from "@/lib/format";
import { statusMeta } from "@/lib/order-status";
import { garmentsByAppointment } from "@/server/services/appointment-garments";
import { verifyScanToken } from "@/lib/scan-token";
import { takeRateLimit } from "@/lib/rate-limit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "QR স্ক্যান" };

/**
 * Staff scan landing — the ONE target of the appointment-card QR code.
 *
 * The customer hands the printed/PDF card to the shop; any logged-in
 * staff member (admin OR worker) who scans it lands here, inside the
 * staff area, and sees the appointment plus the customer's orders.
 * Admins jump straight to the full order / customer hub; workers see
 * their own tasks for those orders. Workers never see phone numbers or
 * money here, matching the rest of the worker view. There is NO public
 * card page anywhere — without a staff login this page shows nothing.
 */
export default async function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  if (!/^[a-f\d-]{36}$/i.test(id)) notFound();

  // Layer 1 — the QR carries an HMAC-signed token (see lib/scan-token).
  // A guessed, scripted or tampered link gets a plain 404: it does not
  // even learn that a scan page exists here.
  const { t } = await searchParams;
  if (!verifyScanToken(id, t)) notFound();

  // Layer 2 — rate limit per client, so automated probing is throttled.
  const ip = ((await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local").slice(0, 100);
  if (!takeRateLimit(`scan:ip:${ip}`, 60, 10 * 60_000)) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>অনেকবার চেষ্টা হয়েছে</CardTitle>
            <CardDescription>কিছুক্ষণ পরে আবার স্ক্যান করুন।</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  // Layer 3 — a staff session is required before any data is shown.
  const session = await getStaffSession();
  if (!session) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>স্টাফ লগইন প্রয়োজন</CardTitle>
            <CardDescription>
              এই QR কোড শুধু দোকানের স্টাফদের জন্য। লগইন করার পর আবার স্ক্যান করলেই অ্যাপয়েন্টমেন্ট ও
              অর্ডারের তথ্য এখানে খুলবে।
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="w-full">
              <Link href="/staff-login">স্টাফ লগইন করুন</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const [a] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  if (!a) notFound();

  const admin = isAdminRole(session.role);
  const garmentsMap = await garmentsByAppointment([a.id]);
  const garments = garmentsMap.get(a.id) ?? [];

  const customerOrders = a.customerId
    ? await db
        .select()
        .from(orders)
        .where(eq(orders.customerId, a.customerId))
        .orderBy(desc(orders.createdAt))
        .limit(10)
    : [];

  // Tasks hang off order items, not orders — join through orderItems.
  const myTasks =
    !admin && session.workerId && customerOrders.length > 0
      ? await db
          .select({ id: tasks.id, stage: tasks.stage, status: tasks.status })
          .from(tasks)
          .innerJoin(orderItems, eq(orderItems.id, tasks.orderItemId))
          .where(
            and(
              eq(tasks.workerId, session.workerId),
              inArray(
                orderItems.orderId,
                customerOrders.map((o) => o.id),
              ),
            ),
          )
          .orderBy(desc(tasks.createdAt))
      : [];

  const startsAt = new Date(a.startsAt);
  const timeLabel = startsAt.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="smallcaps text-stone">QR স্ক্যান · স্টাফ ভিউ</div>
        <Button asChild variant="outline" size="sm">
          <Link href={admin ? "/admin" : "/worker"}>{admin ? "ড্যাশবোর্ডে যান" : "আমার কাজে যান"}</Link>
        </Button>
      </div>

      <Card className="border-2 border-gold/60">
        <CardHeader>
          <CardTitle className="text-2xl">{a.name}</CardTitle>
          <CardDescription>
            {dateBn(startsAt)} · <span className="num">{timeLabel}</span> · {a.purpose}
            {garments.length > 0 && <> · বানাতে চান: {garments.join(", ")}</>}
            {a.locationType === "home" && " · হোম ভিজিট"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-[15px]">
          {admin && (
            <p>
              ফোন: <span className="num font-medium">{formatPhone(a.phone)}</span>
            </p>
          )}
          {a.notes && <p className="text-ink-3">নোট: {a.notes}</p>}
          <p>
            অবস্থা: <Badge variant="secondary">{a.status}</Badge>
          </p>
          {admin && a.customerId && (
            <div className="flex flex-wrap gap-2.5 pt-2">
              <Button asChild>
                <Link href={`/admin/customers/${a.customerId}?tab=measurements`}>কাস্টমারের মাপ ও অর্ডার →</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/admin/appointments?focus=${a.id}`}>অ্যাপয়েন্টমেন্ট তালিকায় দেখুন</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {customerOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>এই কাস্টমারের অর্ডার</CardTitle>
            <CardDescription>{admin ? "অর্ডারে ক্লিক করলে পুরো বিবরণ খুলবে।" : "আপনার দায়িত্বে থাকা কাজগুলো নিচে আলাদা করে দেওয়া আছে।"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {customerOrders.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-md border border-ink/10 px-3.5 py-2.5">
                <span className="num font-medium">{o.orderNo}</span>
                <Badge variant="outline">{statusMeta(o.status).labelBn}</Badge>
                <span className="text-sm text-ink-3">
                  ডেলিভারি: {dateBn(o.deliveryDate)}
                </span>
                {admin && Number(o.dueAmount) > 0 && (
                  <span className="num ml-auto text-sm text-chalk">বকেয়া {taka(o.dueAmount)}</span>
                )}
                {admin && (
                  <Button asChild size="sm" variant="outline" className={Number(o.dueAmount) > 0 ? "" : "ml-auto"}>
                    <Link href={`/admin/orders/${o.id}`}>খুলুন</Link>
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!admin && (
        <Card>
          <CardHeader>
            <CardTitle>আমার কাজ (এই কাস্টমারের)</CardTitle>
            <CardDescription>
              {myTasks.length === 0
                ? "এই কাস্টমারের কোনো অর্ডারে আপনার নামে কাজ বণ্টন করা নেই।"
                : "কাজে ক্লিক করলে মাপসহ পুরো বিবরণ খুলবে।"}
            </CardDescription>
          </CardHeader>
          {myTasks.length > 0 && (
            <CardContent className="space-y-2.5">
              {myTasks.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-md border border-ink/10 px-3.5 py-2.5">
                  <span className="font-medium">{t.stage}</span>
                  <Badge variant="outline">{t.status}</Badge>
                  <Button asChild size="sm" className="ml-auto">
                    <Link href={`/worker/tasks/${t.id}`}>কাজ খুলুন</Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </main>
  );
}
