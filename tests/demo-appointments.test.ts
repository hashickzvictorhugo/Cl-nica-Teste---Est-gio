import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_ADMIN_APPOINTMENTS,
  filterDemoAppointments,
} from "../lib/demo-appointments.ts";

const validDurations = new Set(["TODAY", "FEW_DAYS", "WEEKS", "MONTHS", "NOT_APPLICABLE"]);
const validVisitTypes = new Set(["FIRST_VISIT", "RETURN"]);

test("dataset demo contém apenas registros explicitamente fictícios", () => {
  assert.ok(DEMO_ADMIN_APPOINTMENTS.length >= 4);
  for (const item of DEMO_ADMIN_APPOINTMENTS) {
    assert.match(item.id, /^demo-/);
    assert.match(item.patientName, /\(demo\)$/i);
    assert.match(item.patientPhone, /^1890000000\d$/);
    assert.ok(item.visitReason.length >= 5 && item.visitReason.length <= 300);
    assert.ok(validDurations.has(item.symptomDuration));
    assert.ok(validVisitTypes.has(item.visitType));
    assert.ok(item.patientNotes.length <= 500);
    assert.match(`${item.visitReason} ${item.patientNotes}`, /demonstr|fict|sintét|ilustr/i);
  }
});

test("filtros do modo demo respeitam profissional, status e busca", () => {
  const confirmed = filterDemoAppointments({ status: "CONFIRMED" });
  assert.ok(confirmed.length > 0);
  assert.ok(confirmed.every((item) => item.status === "CONFIRMED"));

  const providerRows = filterDemoAppointments({ providerId: "ana-martins" });
  assert.ok(providerRows.every((item) => item.provider.id === "ana-martins"));

  const searchRows = filterDemoAppointments({ search: "Marina" });
  assert.equal(searchRows.length, 1);
  assert.match(searchRows[0].patientName, /Marina/);

  const reasonRows = filterDemoAppointments({ search: "irritação" });
  assert.equal(reasonRows.length, 1);
  assert.match(reasonRows[0].visitReason, /irritação/i);
});
