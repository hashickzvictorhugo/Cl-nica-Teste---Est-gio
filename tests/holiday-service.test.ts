import assert from "node:assert/strict";
import { test } from "node:test";
import { getHolidays, HolidayServiceError, resetHolidayCacheForTests } from "../lib/holiday-service.ts";

const holiday = {
  date: "2026-01-01",
  localName: "Confraternização Universal",
  name: "New Year's Day",
  countryCode: "BR",
};

test("holiday service validates the upstream response", async () => {
  resetHolidayCacheForTests();
  await assert.rejects(getHolidays(async () => Response.json([])), HolidayServiceError);
  resetHolidayCacheForTests();
  assert.equal((await getHolidays(async () => Response.json([holiday])))[0].date, holiday.date);
  resetHolidayCacheForTests();
});

test("holiday service rejects upstream errors", async () => {
  resetHolidayCacheForTests();
  await assert.rejects(
    getHolidays(async () => new Response(null, { status: 503 })),
    HolidayServiceError,
  );
  resetHolidayCacheForTests();
});
