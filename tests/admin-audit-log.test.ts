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

test("mudança de status gera auditoria automática e imutável", () => {
  const db = database();
  db.prepare(`INSERT INTO appointments
    (id, appointment_date, start_time, provider_id, patient_name, patient_phone, visit_reason, visit_type, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      "appointment-audit",
      "2026-10-20",
      "10:00",
      "ana-martins",
      "Paciente Teste",
      "18999999999",
      "Consulta demonstrativa",
      "FIRST_VISIT",
      "CONFIRMED",
      "2026-09-15T12:00:00Z",
    );

  db.prepare("UPDATE appointments SET status = 'CANCELLED' WHERE id = 'appointment-audit'").run();

  const row = db.prepare(`SELECT action, actor, source, request_id
    FROM admin_audit_log WHERE appointment_id = ?`).get("appointment-audit") as {
      action: string;
      actor: string;
      source: string;
      request_id: string;
    };

  assert.equal(row.action, "CANCELLED");
  assert.equal(row.actor, "database-enforced");
  assert.equal(row.source, "DATABASE");
  assert.equal(row.request_id, "database-trigger");

  assert.throws(
    () => db.prepare("UPDATE admin_audit_log SET actor = 'other'").run(),
    /admin audit log is immutable/,
  );
  assert.throws(
    () => db.prepare("DELETE FROM admin_audit_log").run(),
    /admin audit log is immutable/,
  );
  db.close();
});

test("auditoria de aplicação aceita identidade sem permitir alteração posterior", () => {
  const db = database();
  db.prepare(`INSERT INTO admin_audit_log
    (id, appointment_id, action, actor, request_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(
      "audit-app",
      "appointment-app",
      "COMPLETED",
      "admin@example.test",
      "ray-example",
      "2026-09-15T12:00:00Z",
    );

  const row = db.prepare("SELECT actor, source FROM admin_audit_log WHERE id = ?")
    .get("audit-app") as { actor: string; source: string };
  assert.equal(row.actor, "admin@example.test");
  assert.equal(row.source, "APPLICATION");
  db.close();
});
