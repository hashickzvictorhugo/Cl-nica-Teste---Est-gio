CREATE TABLE IF NOT EXISTS `appointments` (
  `id` text PRIMARY KEY NOT NULL,
  `appointment_date` text NOT NULL,
  `start_time` text NOT NULL,
  `provider_id` text NOT NULL DEFAULT 'ana-martins',
  `patient_name` text NOT NULL,
  `patient_phone` text,
  `status` text NOT NULL DEFAULT 'CONFIRMED',
  `created_at` text NOT NULL,
  `updated_at` text,
  `cancelled_at` text,
  `completed_at` text,
  CONSTRAINT "appointments_start_time_check" CHECK("appointments"."start_time" IN ('08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00')),
  CONSTRAINT "appointments_status_check" CHECK("appointments"."status" IN ('CONFIRMED', 'COMPLETED', 'CANCELLED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS `appointments_active_provider_date_start_time_unique`
ON `appointments` (`provider_id`, `appointment_date`, `start_time`)
WHERE `status` <> 'CANCELLED';

PRAGMA optimize;
