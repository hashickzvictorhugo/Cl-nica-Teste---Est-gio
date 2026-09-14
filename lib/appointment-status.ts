export const APPOINTMENT_STATUSES = [
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === "string" &&
    APPOINTMENT_STATUSES.includes(value as AppointmentStatus);
}

export function getAppointmentStatusLabel(status: AppointmentStatus) {
  switch (status) {
    case "CONFIRMED":
      return "Confirmado";
    case "COMPLETED":
      return "Concluído";
    case "CANCELLED":
      return "Cancelado";
  }
}
