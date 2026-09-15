import { env } from "cloudflare:workers";

const encoder = new TextEncoder();

type Limiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

type LimiterName = "BOOKING_RATE_LIMITER" | "PUBLIC_READ_RATE_LIMITER" | "ADMIN_RATE_LIMITER";

async function hashKey(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function clientAddress(request: Request) {
  return request.headers.get("CF-Connecting-IP")?.trim() || "anonymous";
}

function limiterFor(name: LimiterName): Limiter | undefined {
  return env[name] as Limiter | undefined;
}

async function consume(name: LimiterName, key: string) {
  const limiter = limiterFor(name);
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

export async function enforceBookingRequestRateLimit(request: Request): Promise<Response | null> {
  const allowed = await consume("BOOKING_RATE_LIMITER", `booking:ip:${clientAddress(request)}`);
  return allowed
    ? null
    : limited("Muitas tentativas de agendamento a partir deste acesso. Aguarde um minuto e tente novamente.");
}

export async function enforceBookingPhoneRateLimit(patientPhone: string): Promise<Response | null> {
  if (!patientPhone) return null;
  const allowed = await consume("BOOKING_RATE_LIMITER", `booking:phone:${patientPhone}`);
  return allowed
    ? null
    : limited("Muitas tentativas de agendamento para este contato. Aguarde um minuto e tente novamente.");
}

export async function enforceBookingRateLimit(
  request: Request,
  patientPhone: string,
): Promise<Response | null> {
  const ipError = await enforceBookingRequestRateLimit(request);
  if (ipError) return ipError;
  return enforceBookingPhoneRateLimit(patientPhone);
}

export async function enforcePublicReadRateLimit(
  request: Request,
  resource: string,
): Promise<Response | null> {
  const allowed = await consume(
    "PUBLIC_READ_RATE_LIMITER",
    `public-read:${resource}:${clientAddress(request)}`,
  );
  return allowed
    ? null
    : limited("Muitas consultas à agenda em pouco tempo. Aguarde um minuto e tente novamente.");
}

export async function enforceAdminRequestRateLimit(request: Request): Promise<Response | null> {
  const allowed = await consume("ADMIN_RATE_LIMITER", `admin:${clientAddress(request)}`);
  return allowed
    ? null
    : limited("Muitas solicitações administrativas. Aguarde um minuto antes de tentar novamente.");
}

export async function enforceAdminAttemptRateLimit(request: Request): Promise<Response | null> {
  const allowed = await consume("ADMIN_RATE_LIMITER", `admin-auth-failure:${clientAddress(request)}`);
  return allowed
    ? null
    : limited("Muitas tentativas de acesso administrativo. Aguarde um minuto antes de tentar novamente.");
}
