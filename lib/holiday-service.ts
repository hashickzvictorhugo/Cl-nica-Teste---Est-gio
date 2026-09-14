import { isSupportedDate, SCHEDULING_YEAR } from "./scheduling.ts";

export const NAGER_HOLIDAY_URL =
  "https://date.nager.at/api/v3/PublicHolidays/2026/BR";

export type Holiday = { date: string; localName: string; name: string };
type HolidayApiEntry = Holiday & { countryCode?: string };
type HolidayCache = { expiresAt: number; holidays: Holiday[] };
let cache: HolidayCache | null = null;

export class HolidayServiceError extends Error {
  constructor(message = "Holiday service unavailable") {
    super(message);
    this.name = "HolidayServiceError";
  }
}

function normalizePayload(payload: unknown): Holiday[] {
  if (!Array.isArray(payload)) throw new HolidayServiceError();
  const holidays = payload.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new HolidayServiceError();
    const candidate = entry as Partial<HolidayApiEntry>;
    if (
      !isSupportedDate(candidate.date) || candidate.countryCode !== "BR" ||
      typeof candidate.localName !== "string" || !candidate.localName.trim() ||
      typeof candidate.name !== "string" || !candidate.name.trim()
    ) throw new HolidayServiceError();
    return { date: candidate.date, localName: candidate.localName, name: candidate.name };
  });
  if (!holidays.length) throw new HolidayServiceError();
  return holidays;
}

export async function getHolidays(fetcher: typeof fetch = fetch, now = Date.now()) {
  if (cache && cache.expiresAt > now) return cache.holidays;
  try {
    const response = await fetcher(NAGER_HOLIDAY_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new HolidayServiceError();
    const holidays = normalizePayload(await response.json());
    cache = { holidays, expiresAt: now + 6 * 60 * 60 * 1_000 };
    return holidays;
  } catch (error) {
    if (error instanceof HolidayServiceError) throw error;
    throw new HolidayServiceError();
  }
}

export async function getHolidayForDate(date: string, fetcher: typeof fetch = fetch) {
  if (!date.startsWith(`${SCHEDULING_YEAR}-`)) return null;
  return (await getHolidays(fetcher)).find((holiday) => holiday.date === date) ?? null;
}

export function resetHolidayCacheForTests() { cache = null; }
