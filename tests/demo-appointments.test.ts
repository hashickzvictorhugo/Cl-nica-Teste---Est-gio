import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_ADMIN_APPOINTMENTS,
  filterDemoAppointments,
} from "../lib/demo-appointments.ts";

test("dataset demo contém apenas registros explicitamente fictícios", () => {
  assert.ok(DEMO_ADMIN_APPOINTMENTS.length >= 4);
  for (const item of DEMO_ADMIN_APPOINTMENTS) {
    assert.match(item.id, /^demo-/);
    assert.match(item.patientName, /\(demo\)$/i);
    assert.match(item.patientPhone, /^1890000000\d$/);
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
});
