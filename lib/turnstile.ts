import { env } from "cloudflare:workers";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export function turnstileEnabled() {
  return Boolean(env.TURNSTILE_SITE_KEY?.trim() && env.TURNSTILE_SECRET_KEY?.trim());
}

export function getTurnstileSiteKey() {
  return turnstileEnabled() ? env.TURNSTILE_SITE_KEY!.trim() : "";
}

export async function verifyTurnstile(
  request: Request,
  token: unknown,
): Promise<Response | null> {
  if (!turnstileEnabled()) return null;

  if (typeof token !== "string" || !token.trim()) {
    return Response.json(
      {
        error: {
          code: "TURNSTILE_REQUIRED",
          message: "Confirme a verificação de segurança antes de agendar.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = new FormData();
  body.set("secret", env.TURNSTILE_SECRET_KEY!.trim());
  body.set("response", token.trim());
  const remoteIp = request.headers.get("CF-Connecting-IP")?.trim();
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("Turnstile verify endpoint unavailable");

    const result = (await response.json()) as TurnstileResponse;
    if (result.success) return null;

    return Response.json(
      {
        error: {
          code: "TURNSTILE_FAILED",
          message: "A verificação de segurança não foi validada. Atualize o desafio e tente novamente.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error: {
          code: "TURNSTILE_UNAVAILABLE",
          message: "A verificação anti-bot está indisponível no momento. Tente novamente em instantes.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
