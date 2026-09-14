import { sql } from "drizzle-orm";
import { check, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    appointmentDate: text("appointment_date").notNull(),
    startTime: text("start_time").notNull(),
    patientName: text("patient_name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("appointments_date_start_time_unique").on(
      table.appointmentDate,
      table.startTime,
    ),
    check(
      "appointments_start_time_check",
      sql`${table.startTime} IN ('08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00')`,
    ),
  ],
);
