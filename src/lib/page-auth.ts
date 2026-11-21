import "server-only";
import { redirect } from "next/navigation";
import { AuthError, requireAdmin, requireOwnerOrManager } from "@/lib/access";

export async function requireAdminPage(ownerOnly = false) {
  try {
    return await (ownerOnly ? requireOwnerOrManager() : requireAdmin());
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 401) redirect("/staff-login?next=/admin");
      redirect(ownerOnly ? "/admin?error=এই%20পাতার%20অনুমতি%20নেই" : "/staff-login");
    }
    throw error;
  }
}
