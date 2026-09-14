CREATE TABLE IF NOT EXISTS `appointments` (
  `id` text PRIMARY KEY NOT NULL,
  `appointment_date` text NOT NULL,
  `start_time` text NOT NULL,
  `patient_name` text NOT NULL,
  `created_at` text NOT NULL,
  CONSTRAINT "appointments_start_time_check" CHECK("appointments"."start_time" IN ('08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `appointments_date_start_time_unique` ON `appointments` (`appointment_date`,`start_time`);
--> statement-breakpoint
PRAGMA optimize;
