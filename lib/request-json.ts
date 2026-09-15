import type { ApiErrorCode } from "@/lib/api-response";

export class JsonBodyError extends Error {
  status: number;
  code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = "JsonBodyError";
    this.status = status;
    this.code = code;
  }
}

async function readTextWithLimit(request: Request, maxBytes: number) {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let raw = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("payload too large").catch(() => undefined);
        throw new JsonBodyError(413, "PAYLOAD_TOO_LARGE", "A solicitação excede o tamanho permitido.");
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    return raw;
  } finally {
    reader.releaseLock();
  }
}

export async function readJsonObject(
  request: Request,
  maxBytes = 8_192,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new JsonBodyError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Envie a solicitação com Content-Type application/json.",
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new JsonBodyError(413, "PAYLOAD_TOO_LARGE", "A solicitação excede o tamanho permitido.");
  }

  const raw = await readTextWithLimit(request, maxBytes);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new JsonBodyError(400, "VALIDATION_ERROR", "Envie um objeto JSON válido.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new JsonBodyError(400, "VALIDATION_ERROR", "Envie um objeto JSON válido.");
  }

  return parsed as Record<string, unknown>;
}
