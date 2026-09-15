import { env } from "cloudflare:workers";

const encoder = new TextEncoder();

async function hashKey(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function enforceBookingRateLimit(
  request: Request,
  patientPhone: string,
): Promise<Response | null> {
  const limiter = env.BOOKING_RATE_LIMITER;
  if (!limiter) return null;

  const source = patientPhone
    ? `phone:${patientPhone}`
    : `ip:${request.headers.get("CF-Connecting-IP") ?? "anonymous"}`;
  const key = await hashKey(source);
  const { success } = await limiter.limit({ key });

  if (success) return null;

  return Response.json(
    {
      error: {
        code: "RATE_LIMITED",
        message: "Muitas tentativas de agendamento em pouco tempo. Aguarde um minuto e tente novamente.",
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
