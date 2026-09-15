import { and, eq, ne } from "drizzle-orm";

import { getDb } from "@/db";
import { appointments } from "@/db/schema";
import { databaseError, jsonError } from "@/lib/api-response";
import { enforcePublicReadRateLimit } from "@/lib/booking-rate-limit";
import {
  getHolidayForDate,
  HolidayServiceError,
} from "@/lib/holiday-service";
import { resolveProvider } from "@/lib/providers";
import {
  BOOKING_MIN_LEAD_MINUTES,
  buildScheduleSlots,
  BUSINESS_HOURS,
  getWeekdayLabel,
  isPastDate,
  isSlotBookable,
  isSupportedDate,
  isWeekend,
  SCHEDULING_YEAR,
  TIMEZONE,
} from "@/lib/scheduling";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rateLimitError = await enforcePublicReadRateLimit(request, "available");
  if (rateLimitError) return rateLimitError;

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const provider = resolveProvider(url.searchParams.get("providerId"));

  if (!isSupportedDate(date)) {
    return jsonError(
      400,
      "INVALID_DATE",
      `Informe uma data válida de ${SCHEDULING_YEAR} no formato AAAA-MM-DD.`,
    );
  }

  if (!provider) {
    return jsonError(
      400,
      "INVALID_PROVIDER",
      "Escolha um profissional válido para consultar a agenda.",
    );
  }

  const now = new Date();
  if (isPastDate(date, now)) {
    return jsonError(
      422,
      "PAST_DATE",
      "Essa data já passou. Escolha hoje ou uma data futura.",
    );
  }

  try {
    const weekend = isWeekend(date);
    const holiday = weekend ? null : await getHolidayForDate(date);
    const blockedReason = weekend ? "WEEKEND" : holiday ? "HOLIDAY" : null;

    const occupiedRows = blockedReason
      ? []
      : await getDb()
          .select({ startTime: appointments.startTime })
          .from(appointments)
          .where(
            and(
              eq(appointments.appointmentDate, date),
              eq(appointments.providerId, provider.id),
              ne(appointments.status, "CANCELLED"),
            ),
          );

    const slots = buildScheduleSlots(
      occupiedRows.map((row) => row.startTime),
      Boolean(blockedReason),
    ).map((slot) => {
      if (!slot.available) return slot;
      if (!isSlotBookable(date, slot.startTime, now)) {
        return {
          ...slot,
          available: false,
          unavailableReason: "TOO_SOON" as const,
        };
      }
      return slot;
    });
    const availableSlots = slots.filter((slot) => slot.available);

    return Response.json(
      {
        date,
        provider,
        timezone: TIMEZONE,
        weekday: getWeekdayLabel(date),
        isBusinessDay: !blockedReason,
        blockedReason,
        holiday,
        businessHours: BUSINESS_HOURS,
        bookingPolicy: {
          minimumLeadMinutes: BOOKING_MIN_LEAD_MINUTES,
        },
        slots,
        availableSlots,
        availableCount: availableSlots.length,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof HolidayServiceError) {
      return jsonError(
        503,
        "HOLIDAY_SERVICE_UNAVAILABLE",
        "Não foi possível verificar os feriados agora. Tente novamente em instantes.",
      );
    }
    return databaseError(error);
  }
}
