import type { AdminIdentity } from "@/lib/cloudflare-access";

export type AdminAuditAction = "RESCHEDULED" | "COMPLETED" | "CANCELLED";

export function buildAdminAuditValues({
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

  return {
    id: crypto.randomUUID(),
    appointmentId,
    action,
    actor,
    requestId,
    createdAt: new Date().toISOString(),
  } as const;
}
