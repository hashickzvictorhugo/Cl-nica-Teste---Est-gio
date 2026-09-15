import { getDb } from "@/db";
import { adminAuditLog } from "@/db/schema";
import type { AdminIdentity } from "@/lib/cloudflare-access";

export type AdminAuditAction = "RESCHEDULED" | "COMPLETED" | "CANCELLED";

export async function writeAdminAudit({
  request,
  identity,
  appointmentId,
  action,
}: {
  request: Request;
  identity: AdminIdentity | null;
  appointmentId: string;
  action: AdminAuditAction;
}) {
  const requestId = (
    request.headers.get("CF-Ray")?.trim() || crypto.randomUUID()
  ).slice(0, 120);
  const actor = (identity?.email || "shared-admin-token").slice(0, 320);

  await getDb().insert(adminAuditLog).values({
    id: crypto.randomUUID(),
    appointmentId,
    action,
    actor,
    requestId,
    createdAt: new Date().toISOString(),
  });
}
