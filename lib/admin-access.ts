export type AdminAccessLevel = "full" | "demo";

const encoder = new TextEncoder();

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

async function constantTimeEqual(left: string, right: string) {
  const [leftDigest, rightDigest] = await Promise.all([
    digest(left),
    digest(right),
  ]);
  let difference = leftDigest.length ^ rightDigest.length;
  const length = Math.max(leftDigest.length, rightDigest.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftDigest[index] ?? 0) ^ (rightDigest[index] ?? 0);
  }
  return difference === 0;
}

export function adminSecretsMisconfigured({
  adminToken,
  demoToken,
}: {
  adminToken?: string;
  demoToken?: string;
}) {
  const full = adminToken?.trim() ?? "";
  const demo = demoToken?.trim() ?? "";
  return Boolean(full && demo && full === demo);
}

export async function classifyAdminCredential({
  suppliedToken,
  adminToken,
  demoToken,
}: {
  suppliedToken: string;
  adminToken?: string;
  demoToken?: string;
}): Promise<AdminAccessLevel | null> {
  const supplied = suppliedToken.trim();
  const full = adminToken?.trim() ?? "";
  const demo = demoToken?.trim() ?? "";

  if (!supplied) return null;
  if (adminSecretsMisconfigured({ adminToken: full, demoToken: demo })) return null;
  if (full && await constantTimeEqual(supplied, full)) return "full";
  if (demo && await constantTimeEqual(supplied, demo)) return "demo";
  return null;
}

export function canMutateAdmin(access: AdminAccessLevel) {
  return access === "full";
}
