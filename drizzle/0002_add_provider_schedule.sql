PRAGMA foreign_keys=OFF;

CREATE TABLE `__new_appointments` (
  `id` text PRIMARY KEY NOT NULL,
  `appointment_date` text NOT NULL,
  `start_time` text NOT NULL,
  `provider_id` text NOT NULL DEFAULT 'ana-martins',
  `patient_name` text NOT NULL,
  `patient_phone` text,
  `created_at` text NOT NULL,
  CONSTRAINT "appointments_start_time_check" CHECK("__new_appointments"."start_time" IN ('08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'))
);

INSERT INTO `__new_appointments` (`id`, `appointment_date`, `start_time`, `provider_id`, `patient_name`, `patient_phone`, `created_at`)
SELECT `id`, `appointment_date`, `start_time`, 'ana-martins', `patient_name`, `patient_phone`, `created_at`
FROM `appointments`;

DROP TABLE `appointments`;
ALTER TABLE `__new_appointments` RENAME TO `appointments`;

CREATE UNIQUE INDEX `appointments_provider_date_start_time_unique`
ON `appointments` (`provider_id`, `appointment_date`, `start_time`);

PRAGMA foreign_keys=ON;
PRAGMA optimize;
