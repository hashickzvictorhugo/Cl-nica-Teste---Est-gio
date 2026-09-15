import { env } from "cloudflare:workers";

import { enforceAdminAttemptRateLimit } from "@/lib/booking-rate-limit";

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

function unauthorized(message = "Autenticação administrativa necessária.") {
  return Response.json(
    { error: { code: "ADMIN_AUTH_REQUIRED", message } },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": 'Bearer realm="Garde Agenda Admin"',
      },
    },
  );
}

async function rejectedAttempt(request: Request, message?: string) {
  const rateLimitError = await enforceAdminAttemptRateLimit(request);
  return rateLimitError ?? unauthorized(message);
}

export async function requireAdmin(request: Request): Promise<Response | null> {
  const configuredToken = env.ADMIN_TOKEN?.trim();
  if (!configuredToken) {
    return Response.json(
      {
        error: {
          code: "ADMIN_AUTH_UNAVAILABLE",
          message: "A área administrativa está desativada até que o segredo ADMIN_TOKEN seja configurado.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const authorization = request.headers.get("Authorization")?.trim() ?? "";
  if (!authorization.startsWith("Bearer ")) return rejectedAttempt(request);

  const suppliedToken = authorization.slice("Bearer ".length).trim();
  if (!suppliedToken || !(await constantTimeEqual(suppliedToken, configuredToken))) {
    return rejectedAttempt(request, "Credencial administrativa inválida.");
  }

  return null;
}

export function isAdminScope(request: Request) {
  return new URL(request.url).searchParams.get("scope") === "admin";
}
