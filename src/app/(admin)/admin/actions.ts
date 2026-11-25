"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AuthError, requireAdmin, requireOwnerOrManager, requireStaff, type StaffSession } from "@/lib/access";
import { ApiError } from "@/lib/api-route";
import { createExpense } from "@/server/services/expenses";
import { adjustStock } from "@/server/services/inventory";
import { createAppointment as createBooking, changeAppointmentStatus } from "@/server/services/appointments";
import { autoDistributeTasks as distribute, moveTask as transitionTask, updateAssignmentPolicy as savePolicy } from "@/server/services/tasks";
import { getAdminSiteContent, saveSiteContent } from "@/server/cms/admin";

function returnPath(form: FormData, fallback: string) {
  const path = String(form.get("return_path") ?? "");
  return /^\/(admin|worker)(\/|\?|$)/.test(path) && !path.includes("\\") ? path : fallback;
}
function flash(path: string, key: "ok" | "error", message: string): never {
  redirect(path + (path.includes("?") ? "&" : "?") + key + "=" + encodeURIComponent(message));
}
async function perform(form: FormData, fallback: string, guard: () => Promise<StaffSession>, work: (actor: StaffSession) => Promise<unknown>, message: string) {
  const path = returnPath(form, fallback);
  try {
    const actor = await guard();
    await work(actor);
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/staff-login");
    if (error instanceof AuthError || error instanceof ApiError) flash(path, "error", error.message);
    console.error("Admin action failed", error);
    flash(path, "error", "তথ্য সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন");
  }
  revalidatePath("/admin", "layout"); revalidatePath("/worker", "layout"); revalidatePath("/account", "layout");
  flash(path, "ok", message);
}
const value = (form: FormData, key: string) => String(form.get(key) ?? "");

export async function addExpense(form: FormData): Promise<void> {
  await perform(form, "/admin/expenses", requireOwnerOrManager, (actor) => createExpense(actor, { category: value(form, "category"), amount: Number(form.get("amount")), date: value(form, "date"), method: value(form, "method") || "cash", note: value(form, "note") }), "খরচ সংরক্ষিত হয়েছে");
}
export async function addStockMovement(form: FormData): Promise<void> {
  await perform(form, "/admin/inventory", requireAdmin, (actor) => adjustStock(actor, value(form, "fabric_id"), Number(form.get("qty")), value(form, "note")), "স্টক লেজারে পরিবর্তন সংরক্ষিত হয়েছে");
}
export async function updateShopInfo(form: FormData): Promise<void> {
  await perform(form, "/admin/settings", requireOwnerOrManager, async (actor) => {
    const { shop } = await getAdminSiteContent(actor);
    await saveSiteContent("shop", { ...shop, nameBn: value(form, "name_bn"), nameEn: value(form, "name_en"), tagline: value(form, "tagline"), address: value(form, "address"), phone: value(form, "phone"), invoiceFooter: value(form, "invoice_footer"), email: shop?.email ?? "", whatsapp: shop?.whatsapp ?? "", facebookUrl: shop?.facebookUrl ?? "", foundedYear: shop?.foundedYear ?? null }, actor);
    revalidatePath("/", "layout");
  }, "দোকানের তথ্য সংরক্ষিত হয়েছে");
}
export async function createAppointment(form: FormData): Promise<void> {
  await perform(form, "/admin/appointments", requireAdmin, (actor) => createBooking(actor, { name: value(form, "name"), phone: value(form, "phone"), purpose: value(form, "purpose"), date: value(form, "date"), slot: value(form, "time"), notes: value(form, "notes"), status: "confirmed" }), "অ্যাপয়েন্টমেন্ট তৈরি হয়েছে");
}
export async function setAppointmentStatus(form: FormData): Promise<void> {
  await perform(form, "/admin/appointments", requireAdmin, (actor) => changeAppointmentStatus(actor, value(form, "id"), value(form, "status")), "অ্যাপয়েন্টমেন্টের অবস্থা সংরক্ষিত হয়েছে");
}
export async function autoDistributeTasks(form: FormData): Promise<void> {
  await perform(form, "/admin/tasks", requireAdmin, (actor) => distribute(actor, value(form, "task_id") || undefined), "কাজের বণ্টন সংরক্ষিত হয়েছে");
}
export async function updateAssignmentPolicy(form: FormData): Promise<void> {
  await perform(form, "/admin", requireOwnerOrManager, (actor) => savePolicy(actor, value(form, "mode")), "কাজ বণ্টনের নীতি সংরক্ষিত হয়েছে");
}
export async function moveTask(form: FormData): Promise<void> {
  await perform(form, "/worker", requireStaff, (actor) => transitionTask(actor, value(form, "id"), { action: value(form, "action"), workerId: value(form, "worker_id"), note: value(form, "note") }), "কাজের পরিবর্তন সংরক্ষিত হয়েছে");
}
