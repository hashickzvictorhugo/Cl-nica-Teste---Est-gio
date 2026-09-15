export const SCHEDULING_YEAR = 2026;
export const TIMEZONE = "America/Sao_Paulo";
export const BUSINESS_HOURS = {
  opensAt: "08:00",
  closesAt: "18:00",
  durationMinutes: 60,
} as const;
export const BOOKING_MIN_LEAD_MINUTES = 30;
export const CANCELLATION_MIN_LEAD_MINUTES = 60;

export const SLOT_STARTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00",
] as const;

export type SlotStart = (typeof SLOT_STARTS)[number];
export type SlotUnavailableReason = "BLOCKED" | "OCCUPIED" | "TOO_SOON" | null;
export type ScheduleSlot = {
  startTime: SlotStart;
  endTime: string;
  available: boolean;
  unavailableReason?: SlotUnavailableReason;
};

const WEEKDAYS_PT_BR = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
] as const;

export function parseIsoDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

export function isSupportedDate(value: unknown): value is string {
  return parseIsoDate(value)?.year === SCHEDULING_YEAR;
}

export function getUtcWeekday(date: string) {
  const parsed = parseIsoDate(date);
  if (!parsed) throw new Error("Invalid ISO date");
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
}

export function isWeekend(date: string) {
  const weekday = getUtcWeekday(date);
  return weekday === 0 || weekday === 6;
}

export function getWeekdayLabel(date: string) {
  return WEEKDAYS_PT_BR[getUtcWeekday(date)];
}

export function isValidStartTime(value: unknown): value is SlotStart {
  return typeof value === "string" && SLOT_STARTS.includes(value as SlotStart);
}

export function getEndTime(startTime: SlotStart) {
  return `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`;
}

export function getSchedulingClock(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const read = (type: "year" | "month" | "day" | "hour" | "minute") => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error(`Missing ${type} while formatting scheduling clock`);
    return value;
  };

  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    time: `${read("hour")}:${read("minute")}`,
  };
}

function minutesFromClock(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function minutesUntilSlot(
  date: string,
  startTime: string,
  now: Date = new Date(),
) {
  const current = getSchedulingClock(now);
  const currentDate = parseIsoDate(current.date);
  const targetDate = parseIsoDate(date);
  if (!currentDate || !targetDate) return Number.NEGATIVE_INFINITY;

  const dayDifference = Math.round(
    (Date.UTC(targetDate.year, targetDate.month - 1, targetDate.day) -
      Date.UTC(currentDate.year, currentDate.month - 1, currentDate.day)) /
      86_400_000,
  );

  return dayDifference * 1440 + minutesFromClock(startTime) - minutesFromClock(current.time);
}

export function isPastDate(date: string, now: Date = new Date()) {
  return date < getSchedulingClock(now).date;
}

export function hasSlotStarted(
  date: string,
  startTime: string,
  now: Date = new Date(),
) {
  return minutesUntilSlot(date, startTime, now) <= 0;
}

export function isSlotBookable(
  date: string,
  startTime: string,
  now: Date = new Date(),
  minimumLeadMinutes = BOOKING_MIN_LEAD_MINUTES,
) {
  return minutesUntilSlot(date, startTime, now) >= minimumLeadMinutes;
}

export function isWithinCancellationWindow(
  date: string,
  startTime: string,
  now: Date = new Date(),
  minimumLeadMinutes = CANCELLATION_MIN_LEAD_MINUTES,
) {
  return minutesUntilSlot(date, startTime, now) < minimumLeadMinutes;
}

export function hasSlotEnded(
  date: string,
  startTime: SlotStart,
  now: Date = new Date(),
) {
  const current = getSchedulingClock(now);
  if (date < current.date) return true;
  if (date > current.date) return false;
  return getEndTime(startTime) <= current.time;
}

export function buildScheduleSlots(
  occupiedStartTimes: Iterable<string> = [],
  blocked = false,
): ScheduleSlot[] {
  const occupied = new Set(occupiedStartTimes);
  return SLOT_STARTS.map((startTime) => {
    const isOccupied = occupied.has(startTime);
    return {
      startTime,
      endTime: getEndTime(startTime),
      available: !blocked && !isOccupied,
      unavailableReason: blocked ? "BLOCKED" : isOccupied ? "OCCUPIED" : null,
    };
  });
}

export function sanitizePatientName(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= 2 && normalized.length <= 80 ? normalized : null;
}

export function sanitizePatientPhone(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 13 ? digits : null;
}