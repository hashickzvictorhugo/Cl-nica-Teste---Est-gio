ALTER TABLE `appointments` ADD COLUMN `status` text NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE `appointments` ADD COLUMN `updated_at` text;
ALTER TABLE `appointments` ADD COLUMN `cancelled_at` text;
ALTER TABLE `appointments` ADD COLUMN `completed_at` text;

DROP INDEX IF EXISTS `appointments_provider_date_start_time_unique`;

CREATE UNIQUE INDEX `appointments_active_provider_date_start_time_unique`
ON `appointments` (`provider_id`, `appointment_date`, `start_time`)
WHERE `status` <> 'CANCELLED';

PRAGMA optimize;
