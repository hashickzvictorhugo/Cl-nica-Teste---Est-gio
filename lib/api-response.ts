export type ApiErrorCode =
  | "INVALID_DATE"
  | "PAST_DATE"
  | "VALIDATION_ERROR"
  | "UNSUPPORTED_MEDIA_TYPE"
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
  | "INVALID_VISIT_REASON"
  | "INVALID_SYMPTOM_DURATION"
  | "INVALID_VISIT_TYPE"
  | "INVALID_PATIENT_NOTES"
  | "INVALID_PROVIDER"
  | "INVALID_STATUS"
  | "INVALID_TRANSITION"
  | "CONCURRENT_MODIFICATION"
  | "CROSS_SITE_REQUEST_REJECTED"
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

export function isUniqueConstraintError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /unique constraint failed|constraint_unique/i.test(message);
}

export function databaseError(error: unknown) {
  // Mantém o parâmetro consumido sem registrar o erro bruto: adapters de banco
  // podem carregar parâmetros da consulta e, neste domínio, isso pode expor PII.
  void error;
  console.error("Database request failed");
  return jsonError(
    503,
    "DATABASE_UNAVAILABLE",
    "A agenda está temporariamente indisponível. Tente novamente em instantes.",
  );
}
