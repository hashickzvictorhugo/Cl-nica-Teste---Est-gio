import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScheduleSlots, getEndTime, getWeekdayLabel, isSupportedDate,
  isValidStartTime, isWeekend, parseIsoDate, sanitizePatientName,
  sanitizePatientPhone, SLOT_STARTS,
} from "../lib/scheduling.ts";

test("accepts real dates from 2026 and rejects unsupported dates", () => {
  assert.deepEqual(parseIsoDate("2026-02-10"), { year: 2026, month: 2, day: 10 });
  assert.equal(parseIsoDate("2026-02-29"), null);
  assert.equal(isSupportedDate("2026-12-31"), true);
  assert.equal(isSupportedDate("2027-01-01"), false);
});

test("identifies weekends without timezone date shifts", () => {
  assert.equal(isWeekend("2026-02-14"), true);
  assert.equal(isWeekend("2026-02-10"), false);
  assert.equal(getWeekdayLabel("2026-02-10"), "terça-feira");
});

test("creates the ten one-hour slots", () => {
  const slots = buildScheduleSlots();
  assert.equal(slots.length, 10);
  assert.equal(slots[0].startTime, "08:00");
  assert.equal(slots.at(-1)?.endTime, "18:00");
});

test("marks occupied times unavailable", () => {
  const slots = buildScheduleSlots(["09:00", "14:00"]);
  assert.equal(slots.find((item) => item.startTime === "09:00")?.available, false);
  assert.equal(slots.find((item) => item.startTime === "15:00")?.available, true);
});

test("only accepts configured start times", () => {
  assert.equal(SLOT_STARTS.length, 10);
  assert.equal(isValidStartTime("17:00"), true);
  assert.equal(isValidStartTime("18:00"), false);
  assert.equal(getEndTime("17:00"), "18:00");
});

test("normalizes patient names", () => {
  assert.equal(sanitizePatientName("  Maria   da Silva  "), "Maria da Silva");
  assert.equal(sanitizePatientName("M"), null);
});

test("normalizes optional patient phones", () => {
  assert.equal(sanitizePatientPhone("(18) 99999-9999"), "18999999999");
  assert.equal(sanitizePatientPhone("18 999999"), "18999999");
  assert.equal(sanitizePatientPhone(""), "");
  assert.equal(sanitizePatientPhone("123"), null);
});
