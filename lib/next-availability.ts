import { PROVIDERS } from "./providers.ts";
import { isWeekend, SLOT_STARTS } from "./scheduling.ts";

export type NextAvailability = {
  date: string;
  providerId: string;
  startTime: string;
};

export function appointmentSlotKey(
  providerId: string,
  date: string,
  startTime: string,
) {
  return `${providerId}|${date}|${startTime}`;
}

export function addDaysIso(date: string, amount = 1) {
  const [year, month, day] = date.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day + amount));
  return [
    candidate.getUTCFullYear(),
    String(candidate.getUTCMonth() + 1).padStart(2, "0"),
    String(candidate.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function findNextAvailableSlot({
  fromDate,
  holidayDates,
  occupiedSlots,
  providerIds = PROVIDERS.map((provider) => provider.id),
  endDate = "2026-12-31",
}: {
  fromDate: string;
  holidayDates: ReadonlySet<string>;
  occupiedSlots: ReadonlySet<string>;
  providerIds?: readonly string[];
  endDate?: string;
}): NextAvailability | null {
  let date = fromDate;

  while (date <= endDate) {
    if (!isWeekend(date) && !holidayDates.has(date)) {
      for (const startTime of SLOT_STARTS) {
        for (const providerId of providerIds) {
          if (!occupiedSlots.has(appointmentSlotKey(providerId, date, startTime))) {
            return { date, providerId, startTime };
          }
        }
      }
    }
    date = addDaysIso(date);
  }

  return null;
}
