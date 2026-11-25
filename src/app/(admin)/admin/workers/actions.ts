"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AuthError, requireOwnerOrManager, type StaffSession } from "@/lib/access";
import { ApiError } from "@/lib/api-route";
import { createWorker as saveWorker, getWorker, updateWorker } from "@/server/services/workers";

async function perform(work: (actor: StaffSession) => Promise<unknown>, message: string) {
  try { await work(await requireOwnerOrManager()); }
  catch (error) {
    if (error instanceof AuthError && error.status === 401) redirect("/staff-login");
    const detail = error instanceof AuthError || error instanceof ApiError ? error.message : "কারিগর সংরক্ষণ করা যায়নি — আবার চেষ্টা করুন";
    redirect("/admin/workers?error=" + encodeURIComponent(detail));
  }
  revalidatePath("/admin", "layout"); revalidatePath("/worker", "layout");
  redirect("/admin/workers?ok=" + encodeURIComponent(message));
}
export async function createWorker(form: FormData): Promise<void> {
  await perform((actor) => saveWorker(actor, {
    name: String(form.get("name") ?? ""), phone: String(form.get("phone") ?? ""), email: String(form.get("login_email") ?? ""), password: String(form.get("login_password") ?? ""),
    role: String(form.get("role") ?? "stitching"), payType: String(form.get("pay_type") ?? "piece_rate"), monthlySalary: Number(form.get("monthly_salary")),
    skillTags: String(form.get("skill_tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean), joinedOn: String(form.get("joined_on") ?? "") || undefined,
  }), "কারিগর প্রোফাইল সংরক্ষিত হয়েছে");
}
export async function toggleWorker(form: FormData): Promise<void> {
  await perform(async (actor) => {
    const id = String(form.get("id") ?? ""), worker = await getWorker(actor, id);
    return updateWorker(actor, id, { isActive: !worker.isActive });
  }, "কারিগরের সক্রিয় অবস্থা সংরক্ষিত হয়েছে");
}
