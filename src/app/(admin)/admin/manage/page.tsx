import { asc } from "drizzle-orm";
import { db } from "@/db";
import { people } from "@/db/schema";
import { requireAdminPage } from "@/lib/page-auth";
import { dhakaDate } from "@/lib/appointments";
import { opsResource } from "@/server/services/ops-registry";
import { ManageResources } from "@/components/admin/ManageResources";

export const dynamic = "force-dynamic";
export const metadata = { title: "তথ্য ব্যবস্থাপনা" };

export default async function ManagePage({ searchParams }: { searchParams: Promise<{ resource?: string; page?: string; q?: string }> }) {
  const actor = await requireAdminPage(true);
  const query = await searchParams;
  const available = actor.role === "owner" ? ["users", "workers", "garments", "fabrics", "expenses", "appointments"] : ["workers", "garments", "fabrics", "expenses", "appointments"];
  const resource = available.includes(query.resource ?? "") ? query.resource! : "workers";
  const currentPage = Number(query.page ?? 1), q = query.q ?? "";
  const [result, identities] = await Promise.all([
    opsResource(resource).list(actor, { page: currentPage, limit: 50, q }),
    db.select({ id: people.id, name: people.name, phone: people.phone }).from(people).orderBy(asc(people.name)).limit(1000),
  ]);
  return <ManageResources key={resource + ":" + currentPage + ":" + q} resource={resource} available={available} initialRows={JSON.parse(JSON.stringify(result.rows))} total={result.total} page={result.page} limit={result.limit} query={q} people={identities} today={dhakaDate()} isOwner={actor.role === "owner"} />;
}
