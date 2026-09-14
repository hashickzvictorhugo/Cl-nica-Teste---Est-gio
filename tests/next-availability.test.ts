import assert from "node:assert/strict";
import test from "node:test";

import {
  addDaysIso,
  appointmentSlotKey,
  findNextAvailableSlot,
} from "../lib/next-availability.ts";

test("addDaysIso advances dates without timezone shifts", () => {
  assert.equal(addDaysIso("2026-02-28"), "2026-03-01");
  assert.equal(addDaysIso("2026-12-31"), "2027-01-01");
});

test("next availability chooses the earliest clock time across professionals", () => {
  const occupied = new Set([
    appointmentSlotKey("ana-martins", "2026-02-10", "08:00"),
  ]);
  const result = findNextAvailableSlot({
    fromDate: "2026-02-10",
    holidayDates: new Set(),
    occupiedSlots: occupied,
    providerIds: ["ana-martins", "lucas-ferreira"],
    now: new Date("2026-02-09T12:00:00.000Z"),
  });

  assert.deepEqual(result, {
    date: "2026-02-10",
    providerId: "lucas-ferreira",
    startTime: "08:00",
  });
});

test("next availability skips slots that already started today", () => {
  const result = findNextAvailableSlot({
    fromDate: "2026-09-14",
    holidayDates: new Set(),
    occupiedSlots: new Set(),
    providerIds: ["ana-martins"],
    now: new Date("2026-09-14T17:20:00.000Z"),
  });

  assert.deepEqual(result, {
    date: "2026-09-14",
    providerId: "ana-martins",
    startTime: "15:00",
  });
});

test("next availability never searches before the current local date", () => {
  const result = findNextAvailableSlot({
    fromDate: "2026-09-10",
    holidayDates: new Set(),
    occupiedSlots: new Set(),
    providerIds: ["ana-martins"],
    now: new Date("2026-09-14T17:20:00.000Z"),
  });

  assert.deepEqual(result, {
    date: "2026-09-14",
    providerId: "ana-martins",
    startTime: "15:00",
  });
});

test("next availability skips weekends and holidays", () => {
  const result = findNextAvailableSlot({
    fromDate: "2026-12-25",
    holidayDates: new Set(["2026-12-25"]),
    occupiedSlots: new Set(),
    providerIds: ["ana-martins"],
    now: new Date("2026-12-24T12:00:00.000Z"),
  });

  assert.deepEqual(result, {
    date: "2026-12-28",
    providerId: "ana-martins",
    startTime: "08:00",
  });
});

test("next availability returns null when the year has no remaining slot", () => {
  const occupied = new Set([
    appointmentSlotKey("ana-martins", "2026-12-31", "08:00"),
    appointmentSlotKey("ana-martins", "2026-12-31", "09:00"),
    appointmentSlotKey("ana-martins", "2026-12-31", "10:00"),
    appointmentSlotKey("ana-martins", "2026-12-31", "11:00"),
    appointmentSlotKey("ana-martins", "2026-12-31", "12:00"),
    appointmentSlotKey("ana-martins", "2026-12-31", "13:00"),
    appointmentSlotKey("ana-martins", "2026-12-31", "14:00"),
    appointmentSlotKey("ana-martins", "2026-12-31", "15:00"),
    appointmentSlotKey("ana-martins", "2026-12-31", "16:00"),
    appointmentSlotKey("ana-martins", "2026-12-31", "17:00"),
  ]);
  const result = findNextAvailableSlot({
    fromDate: "2026-12-31",
    holidayDates: new Set(),
    occupiedSlots: occupied,
    providerIds: ["ana-martins"],
    now: new Date("2026-12-30T12:00:00.000Z"),
  });

  assert.equal(result, null);
});
