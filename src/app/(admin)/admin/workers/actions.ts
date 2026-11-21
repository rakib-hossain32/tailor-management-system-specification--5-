"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, workers } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { requireOwnerOrManager } from "@/lib/access";
import { isValidBdPhone, normalizePhone } from "@/lib/format";

function flash(path: string, key: "ok" | "error", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

export async function createWorker(formData: FormData): Promise<void> {
  await requireOwnerOrManager();
  const path = "/admin/workers";
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
  const role = String(formData.get("role") ?? "stitching");
  const payType = String(formData.get("pay_type") ?? "piece_rate");
  const salary = Number(formData.get("monthly_salary"));
  const email = String(formData.get("login_email") ?? "").trim().toLowerCase();
  const password = String(formData.get("login_password") ?? "");
  const skills = String(formData.get("skill_tags") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6);
  const joinedOn = String(formData.get("joined_on") ?? "").slice(0, 10);
  if (name.length < 2 || name.length > 120) flash(path, "error", "কারিগরের নাম দিন (২–১২০ অক্ষর)");
  if (phoneRaw && !isValidBdPhone(phone)) flash(path, "error", "সঠিক ফোন নম্বর দিন (01XXXXXXXXX)");
  if (!["cutting", "stitching", "finishing"].includes(role) || !["piece_rate", "salary"].includes(payType)) flash(path, "error", "ধরন সঠিকভাবে বাছুন");
  if (payType === "salary" && (!Number.isFinite(salary) || salary <= 0)) flash(path, "error", "মাসিক বেতনের সঠিক পরিমাণ দিন");
  if (joinedOn && (!/^\d{4}-\d{2}-\d{2}$/.test(joinedOn) || Number.isNaN(new Date(joinedOn).getTime()))) flash(path, "error", "যোগদানের সঠিক তারিখ দিন");
  if ((email || password) && (!phone || password.length < 8 || password.length > 256)) flash(path, "error", "লগইন চালু করতে ফোন নম্বর ও অন্তত ৮ অক্ষরের পাসওয়ার্ড দিন");
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) flash(path, "error", "সঠিক লগইন ইমেইল দিন");

  let error: string | null = null;
  try {
    error = await db.transaction(async (tx) => {
      if (phone) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"worker:" + phone}))`);
        const [duplicate] = await tx.select({ id: workers.id }).from(workers).where(eq(workers.phone, phone)).limit(1);
        if (duplicate) return "এই ফোন নম্বরে ইতিমধ্যে একজন কারিগর আছেন";
      }
      let userId: string | null = null;
      if (password) {
        const [duplicate] = await tx.select({ id: users.id }).from(users).where(sql`${users.phone} = ${phone} OR lower(${users.email}) = ${email || null}`).limit(1);
        if (duplicate) return "এই ফোন/ইমেইলে ইতিমধ্যে লগইন অ্যাকাউন্ট আছে";
        const [user] = await tx.insert(users).values({ name, phone, email: email || null, passwordHash: hashPassword(password), role: "worker", isActive: true }).returning({ id: users.id });
        userId = user.id;
      }
      await tx.insert(workers).values({
        name, phone: phone || null, userId, role, payType,
        monthlySalary: payType === "salary" ? salary.toFixed(2) : null,
        skillTags: skills, isActive: true, joinedOn: joinedOn || new Date().toISOString().slice(0, 10),
      });
      return null;
    });
  } catch (cause) {
    console.error("Create worker failed", cause);
    error = "কারিগর সেভ হয়নি — একই ফোন বা ইমেইল আছে কি না যাচাই করুন";
  }
  if (error) flash(path, "error", error);
  for (const target of ["/admin/workers", "/admin/tasks", "/admin"]) revalidatePath(target);
  flash(path, "ok", `${name} — কারিগর যোগ হয়েছে${password ? " এবং লগইন চালু হয়েছে" : ""}`);
}

export async function toggleWorker(formData: FormData): Promise<void> {
  await requireOwnerOrManager();
  const path = "/admin/workers";
  const id = String(formData.get("id") ?? "");
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) flash(path, "error", "কারিগর নির্বাচন করুন");
  const [worker] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  if (!worker) flash(path, "error", "কারিগর পাওয়া যায়নি");
  await db.update(workers).set({ isActive: !worker.isActive, updatedAt: new Date() }).where(eq(workers.id, id));
  for (const target of ["/admin/workers", "/admin/tasks", "/worker"]) revalidatePath(target);
  flash(path, "ok", worker.isActive ? "কারিগরকে নিষ্ক্রিয় করা হয়েছে" : "কারিগর আবার সক্রিয় হয়েছে");
}
