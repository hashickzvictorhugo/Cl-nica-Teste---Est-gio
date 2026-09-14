import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { appointments } from "@/db/schema";
import { databaseError, jsonError } from "@/lib/api-response";
import {
  getHolidayForDate,
  HolidayServiceError,
} from "@/lib/holiday-service";
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
  const date = new URL(request.url).searchParams.get("date");

  if (!isSupportedDate(date)) {
    return jsonError(
      400,
      "INVALID_DATE",
      `Informe uma data válida de ${SCHEDULING_YEAR} no formato AAAA-MM-DD.`,
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
          .where(eq(appointments.appointmentDate, date));

    const slots = buildScheduleSlots(
      occupiedRows.map((row) => row.startTime),
      Boolean(blockedReason),
    );

    return Response.json(
      {
        date,
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
