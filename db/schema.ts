import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    appointmentDate: text("appointment_date").notNull(),
    startTime: text("start_time").notNull(),
    providerId: text("provider_id").notNull().default("ana-martins"),
    patientName: text("patient_name").notNull(),
    patientPhone: text("patient_phone"),
    visitReason: text("visit_reason"),
    symptomDuration: text("symptom_duration"),
    visitType: text("visit_type"),
    patientNotes: text("patient_notes"),
    status: text("status").notNull().default("CONFIRMED"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
    cancelledAt: text("cancelled_at"),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("appointments_active_provider_date_start_time_unique")
      .on(table.providerId, table.appointmentDate, table.startTime)
      .where(sql`${table.status} <> 'CANCELLED'`),
    uniqueIndex("appointments_active_patient_date_start_time_unique")
      .on(table.patientPhone, table.appointmentDate, table.startTime)
      .where(sql`${table.status} <> 'CANCELLED' AND ${table.patientPhone} IS NOT NULL`),
    check(
      "appointments_start_time_check",
      sql`${table.startTime} IN ('08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00')`,
    ),
    check(
      "appointments_status_check",
      sql`${table.status} IN ('CONFIRMED', 'COMPLETED', 'CANCELLED')`,
    ),
  ],
);

export const adminAuditLog = sqliteTable(
  "admin_audit_log",
  {
    id: text("id").primaryKey(),
    appointmentId: text("appointment_id").notNull(),
    action: text("action").notNull(),
    actor: text("actor").notNull(),
    source: text("source").notNull(),
    requestId: text("request_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("admin_audit_created_at_idx").on(table.createdAt),
    index("admin_audit_appointment_idx").on(table.appointmentId),
    check(
      "admin_audit_action_check",
      sql`${table.action} IN ('RESCHEDULED', 'COMPLETED', 'CANCELLED')`,
    ),
    check(
      "admin_audit_source_check",
      sql`${table.source} IN ('DATABASE', 'APPLICATION')`,
    ),
  ],
);
