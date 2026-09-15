export class JsonBodyError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "JsonBodyError";
    this.status = status;
    this.code = code;
  }
}

export async function readJsonObject(
  request: Request,
  maxBytes = 8_192,
): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new JsonBodyError(413, "PAYLOAD_TOO_LARGE", "A solicitação excede o tamanho permitido.");
  }

  const raw = await request.text();
  const actualBytes = new TextEncoder().encode(raw).byteLength;
  if (actualBytes > maxBytes) {
    throw new JsonBodyError(413, "PAYLOAD_TOO_LARGE", "A solicitação excede o tamanho permitido.");
  }

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
