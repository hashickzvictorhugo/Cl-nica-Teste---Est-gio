import { and, gte, ne } from "drizzle-orm";

import { getDb } from "@/db";
import { appointments } from "@/db/schema";
import { databaseError, jsonError } from "@/lib/api-response";
import { getHolidays, HolidayServiceError } from "@/lib/holiday-service";
import {
  appointmentSlotKey,
  findNextAvailableSlot,
} from "@/lib/next-availability";
import { getProviderById, PROVIDERS } from "@/lib/providers";
import {
  getEndTime,
  getWeekdayLabel,
  isSupportedDate,
  SCHEDULING_YEAR,
  TIMEZONE,
} from "@/lib/scheduling";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fromDate = url.searchParams.get("fromDate")?.trim() ?? "";
  const providerId = url.searchParams.get("providerId")?.trim() ?? "all";

  if (!isSupportedDate(fromDate)) {
    return jsonError(
      400,
      "INVALID_DATE",
      `Informe uma data inicial válida de ${SCHEDULING_YEAR}.`,
    );
  }

  const provider = providerId === "all" ? null : getProviderById(providerId);
  if (providerId !== "all" && !provider) {
    return jsonError(
      400,
      "INVALID_PROVIDER",
      "Escolha um profissional válido ou pesquise em toda a equipe.",
    );
  }

  try {
    const [holidays, activeAppointments] = await Promise.all([
      getHolidays(),
      getDb()
        .select({
          appointmentDate: appointments.appointmentDate,
          providerId: appointments.providerId,
          startTime: appointments.startTime,
        })
        .from(appointments)
        .where(
          and(
            gte(appointments.appointmentDate, fromDate),
            ne(appointments.status, "CANCELLED"),
          ),
        ),
    ]);

    const occupiedSlots = new Set(
      activeAppointments.map((item) =>
        appointmentSlotKey(item.providerId, item.appointmentDate, item.startTime),
      ),
    );
    const holidayDates = new Set(holidays.map((holiday) => holiday.date));
    const providerIds = provider
      ? [provider.id]
      : PROVIDERS.map((item) => item.id);

    const next = findNextAvailableSlot({
      fromDate,
      holidayDates,
      occupiedSlots,
      providerIds,
    });

    if (!next) {
      return jsonError(
        404,
        "NO_AVAILABILITY",
        "Não encontramos mais horários disponíveis em 2026 a partir dessa data.",
      );
    }

    const nextProvider = getProviderById(next.providerId);
    if (!nextProvider) {
      return jsonError(
        503,
        "DATABASE_UNAVAILABLE",
        "A agenda encontrou um profissional inválido. Tente novamente.",
      );
    }

    return Response.json(
      {
        fromDate,
        date: next.date,
        weekday: getWeekdayLabel(next.date),
        timezone: TIMEZONE,
        provider: nextProvider,
        slot: {
          startTime: next.startTime,
          endTime: getEndTime(next.startTime as Parameters<typeof getEndTime>[0]),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof HolidayServiceError) {
      return jsonError(
        503,
        "HOLIDAY_SERVICE_UNAVAILABLE",
        "Não foi possível verificar os feriados para buscar o próximo horário.",
      );
    }
    return databaseError(error);
  }
}
