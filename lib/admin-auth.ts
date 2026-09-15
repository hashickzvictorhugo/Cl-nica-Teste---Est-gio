import { env } from "cloudflare:workers";

import {
  adminSecretsMisconfigured,
  canMutateAdmin,
  classifyAdminCredential,
  type AdminAccessLevel,
} from "@/lib/admin-access";
import {
  enforceAdminAttemptRateLimit,
  enforceAdminRequestRateLimit,
} from "@/lib/booking-rate-limit";

export type AdminAuthorization = {
  access: AdminAccessLevel | null;
  error: Response | null;
};

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

function forbidden() {
  return Response.json(
    {
      error: {
        code: "ADMIN_READ_ONLY",
        message: "A credencial de demonstração permite somente consulta. Use uma credencial administrativa completa para alterar a agenda.",
      },
    },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

function unavailable(code: string, message: string) {
  return Response.json(
    { error: { code, message } },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

async function rejectedAttempt(request: Request, message?: string) {
  const rateLimitError = await enforceAdminAttemptRateLimit(request);
  return rateLimitError ?? unauthorized(message);
}

export async function authorizeAdmin(request: Request): Promise<AdminAuthorization> {
  const requestLimitError = await enforceAdminRequestRateLimit(request);
  if (requestLimitError) return { access: null, error: requestLimitError };

  const adminToken = env.ADMIN_TOKEN?.trim();
  const demoToken = env.DEMO_ADMIN_TOKEN?.trim();
  if (!adminToken && !demoToken) {
    return {
      access: null,
      error: unavailable(
        "ADMIN_AUTH_UNAVAILABLE",
        "A área administrativa está desativada até que uma credencial administrativa seja configurada.",
      ),
    };
  }

  if (adminSecretsMisconfigured({ adminToken, demoToken })) {
    return {
      access: null,
      error: unavailable(
        "ADMIN_AUTH_MISCONFIGURED",
        "As credenciais administrativas estão configuradas de forma insegura. O acesso foi bloqueado preventivamente.",
      ),
    };
  }

  const authorization = request.headers.get("Authorization")?.trim() ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return { access: null, error: await rejectedAttempt(request) };
  }

  const suppliedToken = authorization.slice("Bearer ".length).trim();
  const access = await classifyAdminCredential({
    suppliedToken,
    adminToken,
    demoToken,
  });
  if (!access) {
    return {
      access: null,
      error: await rejectedAttempt(request, "Credencial administrativa inválida."),
    };
  }

  return { access, error: null };
}

export async function requireAdmin(request: Request): Promise<Response | null> {
  const authorization = await authorizeAdmin(request);
  return authorization.error;
}

export async function requireFullAdmin(request: Request): Promise<Response | null> {
  const authorization = await authorizeAdmin(request);
  if (authorization.error) return authorization.error;
  if (!authorization.access || !canMutateAdmin(authorization.access)) return forbidden();
  return null;
}

export function isAdminScope(request: Request) {
  return new URL(request.url).searchParams.get("scope") === "admin";
}
