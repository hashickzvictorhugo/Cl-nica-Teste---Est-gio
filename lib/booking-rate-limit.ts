import { env } from "cloudflare:workers";

const encoder = new TextEncoder();

async function hashKey(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function clientAddress(request: Request) {
  return request.headers.get("CF-Connecting-IP")?.trim() || "anonymous";
}

async function consume(key: string) {
  const limiter = env.BOOKING_RATE_LIMITER;
  if (!limiter) return true;
  const { success } = await limiter.limit({ key: await hashKey(key) });
  return success;
}

function limited(message: string) {
  return Response.json(
    {
      error: {
        code: "RATE_LIMITED",
        message,
      },
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "60",
      },
    },
  );
}

export async function enforceBookingRateLimit(
  request: Request,
  patientPhone: string,
): Promise<Response | null> {
  const ipAllowed = await consume(`booking:ip:${clientAddress(request)}`);
  if (!ipAllowed) {
    return limited("Muitas tentativas de agendamento a partir deste acesso. Aguarde um minuto e tente novamente.");
  }

  if (patientPhone) {
    const phoneAllowed = await consume(`booking:phone:${patientPhone}`);
    if (!phoneAllowed) {
      return limited("Muitas tentativas de agendamento para este contato. Aguarde um minuto e tente novamente.");
    }
  }

  return null;
}

export async function enforceAdminAttemptRateLimit(request: Request): Promise<Response | null> {
  const allowed = await consume(`admin-auth:ip:${clientAddress(request)}`);
  if (allowed) return null;
  return limited("Muitas tentativas de acesso administrativo. Aguarde um minuto antes de tentar novamente.");
}
