import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function migration(name: string) {
  return readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8")
    .replaceAll("--> statement-breakpoint", "");
}

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(migration("0000_quick_leopardon.sql"));
  db.exec(migration("0001_add_patient_phone.sql"));
  db.exec(migration("0002_add_provider_schedule.sql"));
  return db;
}

const insertSql = `INSERT INTO appointments
  (id, appointment_date, start_time, provider_id, patient_name, created_at)
  VALUES (?, ?, ?, ?, ?, ?)`;

test("database prevents two appointments with the same professional and slot", () => {
  const db = database();
  const insert = db.prepare(insertSql);
  insert.run("first", "2026-02-10", "09:00", "ana-martins", "Maria", "2026-01-01T12:00:00Z");
  assert.throws(() =>
    insert.run("second", "2026-02-10", "09:00", "ana-martins", "João", "2026-01-01T12:01:00Z"),
    /UNIQUE constraint failed/,
  );
  db.close();
});

test("database allows the same time for different professionals", () => {
  const db = database();
  const insert = db.prepare(insertSql);
  insert.run("first", "2026-02-10", "09:00", "ana-martins", "Maria", "2026-01-01T12:00:00Z");
  insert.run("second", "2026-02-10", "09:00", "lucas-ferreira", "João", "2026-01-01T12:01:00Z");

  const count = db.prepare("SELECT COUNT(*) AS total FROM appointments").get() as { total: number };
  assert.equal(count.total, 2);
  db.close();
});

test("database rejects times outside the schedule", () => {
  const db = database();
  assert.throws(() => db.prepare(insertSql)
    .run("outside", "2026-02-10", "18:00", "ana-martins", "Ana", "2026-01-01T12:00:00Z"),
    /CHECK constraint failed/,
  );
  db.close();
});
