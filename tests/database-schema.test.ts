import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function database() {
  const migration = readFileSync(
    new URL("../drizzle/0000_quick_leopardon.sql", import.meta.url),
    "utf8",
  ).replaceAll("--> statement-breakpoint", "");
  const db = new DatabaseSync(":memory:");
  db.exec(migration);
  return db;
}

test("database prevents two appointments in the same slot", () => {
  const db = database();
  const insert = db.prepare(`INSERT INTO appointments
    (id, appointment_date, start_time, patient_name, created_at)
    VALUES (?, ?, ?, ?, ?)`);
  insert.run("first", "2026-02-10", "09:00", "Maria", "2026-01-01T12:00:00Z");
  assert.throws(() =>
    insert.run("second", "2026-02-10", "09:00", "João", "2026-01-01T12:01:00Z"),
    /UNIQUE constraint failed/,
  );
  db.close();
});

test("database rejects times outside the schedule", () => {
  const db = database();
  assert.throws(() => db.prepare(`INSERT INTO appointments
    (id, appointment_date, start_time, patient_name, created_at)
    VALUES (?, ?, ?, ?, ?)`)
    .run("outside", "2026-02-10", "18:00", "Ana", "2026-01-01T12:00:00Z"),
    /CHECK constraint failed/,
  );
  db.close();
});
