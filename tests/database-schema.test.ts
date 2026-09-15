import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function database() {
  const schema = readFileSync(
    new URL("../drizzle/bootstrap.sql", import.meta.url),
    "utf8",
  ).replaceAll("--> statement-breakpoint", "");
  const db = new DatabaseSync(":memory:");
  db.exec(schema);
  return db;
}

const insertSql = `INSERT INTO appointments
  (id, appointment_date, start_time, provider_id, patient_name, patient_phone, visit_reason, symptom_duration, visit_type, patient_notes, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function insert(
  db: DatabaseSync,
  {
    id = "row",
    date = "2026-02-10",
    time = "09:00",
    provider = "ana-martins",
    name = "Maria",
    phone = "18999999999" as string | null,
    visitReason = "Consulta demonstrativa",
    symptomDuration = null as string | null,
    visitType = "FIRST_VISIT" as string | null,
    patientNotes = null as string | null,
    status = "CONFIRMED",
  } = {},
) {
  return db.prepare(insertSql).run(
    id,
    date,
    time,
    provider,
    name,
    phone,
    visitReason,
    symptomDuration,
    visitType,
    patientNotes,
    status,
    "2026-01-01T12:00:00Z",
  );
}

test("database prevents two active appointments with the same professional and slot", () => {
  const db = database();
  insert(db, { id: "first" });
  assert.throws(() => insert(db, { id: "second", name: "João" }), /UNIQUE constraint failed/);
  db.close();
});

test("database allows the same time for different professionals", () => {
  const db = database();
  insert(db, { id: "first" });
  insert(db, { id: "second", provider: "lucas-ferreira", name: "João", phone: "18999999998" });

  const count = db.prepare("SELECT COUNT(*) AS total FROM appointments").get() as { total: number };
  assert.equal(count.total, 2);
  db.close();
});

test("cancelled appointments keep history and release the slot", () => {
  const db = database();
  insert(db, { id: "first", time: "10:00" });
  db.prepare("UPDATE appointments SET status = 'CANCELLED' WHERE id = 'first'").run();
  insert(db, { id: "second", time: "10:00", name: "João", phone: "18999999998" });

  const count = db.prepare("SELECT COUNT(*) AS total FROM appointments").get() as { total: number };
  assert.equal(count.total, 2);
  db.close();
});

test("database rejects times outside the schedule", () => {
  const db = database();
  assert.throws(() => insert(db, { id: "outside", time: "18:00" }), /CHECK constraint failed/);
  db.close();
});

test("database rejects unknown appointment statuses", () => {
  const db = database();
  assert.throws(() => insert(db, { id: "bad-status", status: "UNKNOWN" }), /CHECK constraint failed/);
  db.close();
});

test("database rejects unknown providers", () => {
  const db = database();
  assert.throws(() => insert(db, { id: "bad-provider", provider: "intruso" }), /invalid provider/);
  db.close();
});

test("database requires a valid patient phone for new pre-attendance records", () => {
  const db = database();
  assert.throws(() => insert(db, { id: "missing-phone", phone: null }), /invalid required patient phone/);
  assert.throws(() => insert(db, { id: "bad-phone", phone: "18-9999" }), /invalid patient phone|invalid required patient phone/);
  assert.doesNotThrow(() => insert(db, { id: "good-phone", time: "10:00", phone: "18999999999" }));
  db.close();
});

test("database rejects empty names and dates outside 2026", () => {
  const db = database();
  assert.throws(() => insert(db, { id: "bad-name", name: " " }), /invalid patient name/);
  assert.throws(() => insert(db, { id: "bad-date", date: "2027-02-10" }), /invalid appointment date/);
  db.close();
});

test("database enforces pre-attendance reason, type, duration and notes", () => {
  const db = database();
  assert.throws(
    () => insert(db, { id: "bad-reason", visitReason: "dor" }),
    /invalid visit reason/,
  );
  assert.throws(
    () => insert(db, { id: "bad-duration", symptomDuration: "FOREVER" }),
    /invalid symptom duration/,
  );
  assert.throws(
    () => insert(db, { id: "bad-type", visitType: "UNKNOWN" }),
    /invalid visit type/,
  );
  assert.throws(
    () => insert(db, { id: "missing-type", visitType: null }),
    /invalid visit type/,
  );
  assert.throws(
    () => insert(db, { id: "long-notes", patientNotes: "x".repeat(501) }),
    /invalid patient notes/,
  );
  db.close();
});
