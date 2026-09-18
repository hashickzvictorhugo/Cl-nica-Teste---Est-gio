import { env } from "cloudflare:workers";

import { TURNSTILE_ACTION } from "@/lib/security-constants";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export function turnstileEnabled() {
  return Boolean(env.TURNSTILE_SITE_KEY?.trim() && env.TURNSTILE_SECRET_KEY?.trim());
}

export function getTurnstileSiteKey() {
  return turnstileEnabled() ? env.TURNSTILE_SITE_KEY!.trim() : "";
}

function sameOriginBrowserFallbackAllowed(request: Request) {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("Origin")?.trim();
  const fetchSite = request.headers.get("Sec-Fetch-Site")?.trim().toLowerCase();

  return origin === expectedOrigin && fetchSite === "same-origin";
}

function turnstileError(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function verifyTurnstile(
  request: Request,
  token: unknown,
): Promise<Response | null> {
  const fallbackAllowed = sameOriginBrowserFallbackAllowed(request);

  if (!turnstileEnabled()) {
    if (fallbackAllowed) return null;
    return turnstileError(
      503,
      "TURNSTILE_UNAVAILABLE",
      "A proteção anti-bot principal não está disponível para esta requisição.",
    );
  }

  if (typeof token !== "string" || !token.trim()) {
    if (fallbackAllowed) return null;
    return turnstileError(
      400,
      "TURNSTILE_REQUIRED",
      "Confirme a verificação de segurança antes de agendar.",
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
    if (!result.success) {
      return turnstileError(
        400,
        "TURNSTILE_FAILED",
        "A verificação de segurança não foi validada. Atualize o desafio e tente novamente.",
      );
    }

    const expectedHostname = new URL(request.url).hostname.toLowerCase();
    if (result.hostname?.toLowerCase() !== expectedHostname || result.action !== TURNSTILE_ACTION) {
      return turnstileError(
        400,
        "TURNSTILE_FAILED",
        "A verificação de segurança não corresponde a esta sessão de agendamento.",
      );
    }

    return null;
  } catch {
    return turnstileError(
      503,
      "TURNSTILE_UNAVAILABLE",
      "A verificação anti-bot está indisponível no momento. Tente novamente em instantes.",
    );
  }
}
