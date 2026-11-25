"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/access";
import { ApiError } from "@/lib/api-route";
import { createCustomer as createCustomerRecord } from "@/server/services/customers";

export async function createCustomer(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  let result: Awaited<ReturnType<typeof createCustomerRecord>>;
  try {
    result = await createCustomerRecord(actor, {
      name: String(formData.get("name") ?? ""), phone: String(formData.get("phone") ?? ""),
      altPhone: String(formData.get("alt_phone") ?? ""), address: String(formData.get("address") ?? ""),
      email: String(formData.get("email") ?? ""), gender: String(formData.get("gender") ?? ""),
      birthDate: String(formData.get("birth_date") ?? ""), notes: String(formData.get("notes") ?? ""),
      profileName: String(formData.get("profile_name") ?? "নিজে"),
      tags: String(formData.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20),
    });
  } catch (error) {
    redirect("/admin/customers/new?error=" + encodeURIComponent(error instanceof ApiError ? error.message : "কাস্টমার তৈরি করা যায়নি — আবার চেষ্টা করুন"));
  }
  revalidatePath("/admin", "layout");
  if (!result.created) redirect("/admin/customers/" + result.id + "?error=" + encodeURIComponent("এই ব্যক্তির কাস্টমার অ্যাকাউন্ট ইতিমধ্যে আছে"));
  redirect("/admin/customers/" + result.id + "?ok=" + encodeURIComponent("নতুন কাস্টমার তৈরি হয়েছে — এখন মাপ নিন"));
}
