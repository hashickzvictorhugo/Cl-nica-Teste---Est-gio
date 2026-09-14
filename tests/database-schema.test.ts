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
  (id, appointment_date, start_time, provider_id, patient_name, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)`;

test("database prevents two active appointments with the same professional and slot", () => {
  const db = database();
  const insert = db.prepare(insertSql);
  insert.run("first", "2026-02-10", "09:00", "ana-martins", "Maria", "CONFIRMED", "2026-01-01T12:00:00Z");
  assert.throws(() =>
    insert.run("second", "2026-02-10", "09:00", "ana-martins", "João", "CONFIRMED", "2026-01-01T12:01:00Z"),
    /UNIQUE constraint failed/,
  );
  db.close();
});

test("database allows the same time for different professionals", () => {
  const db = database();
  const insert = db.prepare(insertSql);
  insert.run("first", "2026-02-10", "09:00", "ana-martins", "Maria", "CONFIRMED", "2026-01-01T12:00:00Z");
  insert.run("second", "2026-02-10", "09:00", "lucas-ferreira", "João", "CONFIRMED", "2026-01-01T12:01:00Z");

  const count = db.prepare("SELECT COUNT(*) AS total FROM appointments").get() as { total: number };
  assert.equal(count.total, 2);
  db.close();
});

test("cancelled appointments keep history and release the slot", () => {
  const db = database();
  const insert = db.prepare(insertSql);
  insert.run("first", "2026-02-10", "10:00", "ana-martins", "Maria", "CONFIRMED", "2026-01-01T12:00:00Z");
  db.prepare("UPDATE appointments SET status = 'CANCELLED' WHERE id = 'first'").run();
  insert.run("second", "2026-02-10", "10:00", "ana-martins", "João", "CONFIRMED", "2026-01-01T12:05:00Z");

  const count = db.prepare("SELECT COUNT(*) AS total FROM appointments").get() as { total: number };
  assert.equal(count.total, 2);
  db.close();
});

test("database rejects times outside the schedule", () => {
  const db = database();
  assert.throws(() => db.prepare(insertSql)
    .run("outside", "2026-02-10", "18:00", "ana-martins", "Ana", "CONFIRMED", "2026-01-01T12:00:00Z"),
    /CHECK constraint failed/,
  );
  db.close();
});

test("database rejects unknown appointment statuses", () => {
  const db = database();
  assert.throws(() => db.prepare(insertSql)
    .run("bad-status", "2026-02-10", "11:00", "ana-martins", "Ana", "UNKNOWN", "2026-01-01T12:00:00Z"),
    /CHECK constraint failed/,
  );
  db.close();
});
