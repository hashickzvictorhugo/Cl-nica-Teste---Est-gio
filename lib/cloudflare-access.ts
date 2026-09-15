import { env } from "cloudflare:workers";

export type AdminIdentity = {
  email: string;
  subject: string;
};

type AccessHeader = {
  alg?: string;
  kid?: string;
};

type AccessPayload = {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iss?: string;
  nbf?: number;
  sub?: string;
};

type AccessJwk = JsonWebKey & { kid?: string };
type AccessCerts = {
  keys?: AccessJwk[];
};

type CertCache = {
  expiresAt: number;
  keys: AccessJwk[];
};

let certCache: CertCache | null = null;

function base64UrlBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlBytes(value))) as T;
  } catch {
    return null;
  }
}

function configuredTeamDomain() {
  const value = env.CF_ACCESS_TEAM_DOMAIN?.trim().toLowerCase() ?? "";
  if (!value || !/^[a-z0-9.-]+\.cloudflareaccess\.com$/.test(value)) return "";
  return value;
}

function configuredAudience() {
  return env.CF_ACCESS_AUD?.trim() ?? "";
}

function allowedEmails() {
  return new Set(
    (env.ADMIN_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function cloudflareAccessConfigured() {
  return Boolean(configuredTeamDomain() && configuredAudience());
}

async function getAccessKeys(teamDomain: string) {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.keys;

  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Cloudflare Access certs unavailable");

  const payload = (await response.json()) as AccessCerts;
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new Error("Cloudflare Access certs invalid");
  }

  certCache = {
    keys: payload.keys,
    expiresAt: Date.now() + 60 * 60 * 1_000,
  };
  return payload.keys;
}

function audienceMatches(value: string | string[] | undefined, expected: string) {
  return Array.isArray(value) ? value.includes(expected) : value === expected;
}

export async function verifyCloudflareAccessIdentity(
  request: Request,
): Promise<AdminIdentity | null> {
  const teamDomain = configuredTeamDomain();
  const audience = configuredAudience();
  if (!teamDomain || !audience) return null;

  const token = request.headers.get("Cf-Access-Jwt-Assertion")?.trim() ?? "";
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const header = decodeJson<AccessHeader>(parts[0]);
  const payload = decodeJson<AccessPayload>(parts[1]);
  if (!header || !payload || header.alg !== "RS256" || !header.kid) return null;

  const now = Math.floor(Date.now() / 1_000);
  if (!payload.exp || payload.exp <= now) return null;
  if (payload.nbf && payload.nbf > now + 30) return null;
  if (payload.iss !== `https://${teamDomain}`) return null;
  if (!audienceMatches(payload.aud, audience)) return null;
  if (!payload.email || !payload.sub) return null;

  const keys = await getAccessKeys(teamDomain);
  const jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) return null;

  const email = payload.email.trim().toLowerCase();
  const allowlist = allowedEmails();
  if (allowlist.size > 0 && !allowlist.has(email)) return null;

  return { email, subject: payload.sub };
}

export function resetAccessCertCacheForTests() {
  certCache = null;
}
