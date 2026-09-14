import { sql } from "drizzle-orm";
import { check, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    appointmentDate: text("appointment_date").notNull(),
    startTime: text("start_time").notNull(),
    providerId: text("provider_id").notNull().default("ana-martins"),
    patientName: text("patient_name").notNull(),
    patientPhone: text("patient_phone"),
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
