export type ApiErrorCode =
  | "INVALID_DATE"
  | "PAST_DATE"
  | "VALIDATION_ERROR"
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

export function databaseError(error: unknown) {
  console.error("Database request failed", error);
  return jsonError(
    503,
    "DATABASE_UNAVAILABLE",
    "A agenda está temporariamente indisponível. Tente novamente em instantes.",
  );
}
