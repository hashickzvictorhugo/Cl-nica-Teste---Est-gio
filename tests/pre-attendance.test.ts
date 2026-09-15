import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizePatientNotes,
  sanitizeSymptomDuration,
  sanitizeVisitReason,
  sanitizeVisitType,
  symptomDurationLabel,
  visitTypeLabel,
} from "../lib/pre-attendance.ts";

test("visit reason is normalized and constrained", () => {
  assert.equal(sanitizeVisitReason("  Dor   de cabeça há dias  "), "Dor de cabeça há dias");
  assert.equal(sanitizeVisitReason("dor"), null);
  assert.equal(sanitizeVisitReason("x".repeat(301)), null);
  assert.equal(sanitizeVisitReason(undefined), null);
});

test("symptom duration accepts only the documented enum and may be omitted", () => {
  for (const value of ["TODAY", "FEW_DAYS", "WEEKS", "MONTHS", "NOT_APPLICABLE"]) {
    assert.equal(sanitizeSymptomDuration(value), value);
  }
  assert.equal(sanitizeSymptomDuration(""), "");
  assert.equal(sanitizeSymptomDuration(undefined), "");
  assert.equal(sanitizeSymptomDuration("FOREVER"), null);
});

test("visit type is required and restricted", () => {
  assert.equal(sanitizeVisitType("FIRST_VISIT"), "FIRST_VISIT");
  assert.equal(sanitizeVisitType("RETURN"), "RETURN");
  assert.equal(sanitizeVisitType(""), null);
  assert.equal(sanitizeVisitType("UNKNOWN"), null);
});

test("patient notes are optional, normalized and limited to 500 chars", () => {
  assert.equal(sanitizePatientNotes(undefined), "");
  assert.equal(sanitizePatientNotes("  Levar   exames. "), "Levar exames.");
  assert.equal(sanitizePatientNotes("x".repeat(500)), "x".repeat(500));
  assert.equal(sanitizePatientNotes("x".repeat(501)), null);
});

test("labels are safe for known and historical values", () => {
  assert.equal(symptomDurationLabel("FEW_DAYS"), "Alguns dias");
  assert.equal(symptomDurationLabel(""), "Não informado");
  assert.equal(visitTypeLabel("RETURN"), "Retorno");
  assert.equal(visitTypeLabel(""), "Não informado");
});
