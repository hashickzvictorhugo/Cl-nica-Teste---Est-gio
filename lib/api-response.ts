export type ApiErrorCode =
  | "INVALID_DATE"
  | "PAST_DATE"
  | "VALIDATION_ERROR"
  | "PAYLOAD_TOO_LARGE"
  | "AUTOMATION_REJECTED"
  | "TURNSTILE_REQUIRED"
  | "TURNSTILE_FAILED"
  | "TURNSTILE_UNAVAILABLE"
  | "INVALID_SLOT"
  | "PAST_SLOT"
  | "BOOKING_TOO_SOON"
  | "CANCELLATION_TOO_LATE"
  | "PATIENT_CONFLICT"
  | "INVALID_PHONE"
  | "INVALID_PROVIDER"
  | "INVALID_STATUS"
  | "INVALID_TRANSITION"
  | "APPOINTMENT_NOT_FINISHED"
  | "WEEKEND"
  | "HOLIDAY"
  | "SLOT_TAKEN"
  | "NO_AVAILABILITY"
  | "APPOINTMENT_NOT_FOUND"
  | "HOLIDAY_SERVICE_UNAVAILABLE"
  | "DATABASE_UNAVAILABLE";

export function jsonError(status: number, code: ApiErrorCode, message: string) {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function databaseError(_error: unknown) {
  // Não serializa nem registra o erro bruto: adapters de banco podem incluir
  // parâmetros da consulta e, neste domínio, isso pode significar PII.
  console.error("Database request failed");
  return jsonError(
    503,
    "DATABASE_UNAVAILABLE",
    "A agenda está temporariamente indisponível. Tente novamente em instantes.",
  );
}
