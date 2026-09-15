import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(
  new URL("../app/appointments/route.ts", import.meta.url),
  "utf8",
);

function functionSource(name: string, nextName: string) {
  const start = routeSource.indexOf(`function ${name}`);
  const end = routeSource.indexOf(`function ${nextName}`, start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must exist after ${name}`);
  return routeSource.slice(start, end);
}

test("public confirmation does not expose pre-attendance or patient PII", () => {
  const source = functionSource("presentPublicConfirmation", "jsonBodyError");
  assert.doesNotMatch(source, /patientName|patientPhone|visitReason|symptomDuration|visitType|patientNotes/);
  assert.match(source, /provider/);
  assert.match(source, /status/);
});

test("admin presenter includes pre-attendance fields", () => {
  const source = functionSource("presentAdminAppointment", "presentPublicConfirmation");
  assert.match(source, /visitReason/);
  assert.match(source, /symptomDuration/);
  assert.match(source, /visitType/);
  assert.match(source, /patientNotes/);
});
