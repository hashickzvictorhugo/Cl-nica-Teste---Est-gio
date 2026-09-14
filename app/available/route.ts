import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { appointments } from "@/db/schema";
import { databaseError, jsonError } from "@/lib/api-response";
import {
  getHolidayForDate,
  HolidayServiceError,
} from "@/lib/holiday-service";
import { resolveProvider } from "@/lib/providers";
import {
  buildScheduleSlots,
  BUSINESS_HOURS,
  getWeekdayLabel,
  isSupportedDate,
  isWeekend,
  SCHEDULING_YEAR,
  TIMEZONE,
} from "@/lib/scheduling";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  try {
    const holiday = await getHolidayForDate(date);
    const weekend = isWeekend(date);
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
            ),
          );

    const slots = buildScheduleSlots(
      occupiedRows.map((row) => row.startTime),
      Boolean(blockedReason),
    );

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
        slots,
        availableSlots: slots.filter((slot) => slot.available),
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
