-- Daily listings (court diary / daily case listing) — MySQL 8+
-- Replaces legacy `hearings` with `daily_listings` + `daily_listing_clients` for multiple clients per row.

CREATE TABLE IF NOT EXISTS `daily_listings` (
  `id` char(36) NOT NULL,
  `matter_id` char(36) NOT NULL,
  `case_type` varchar(255) DEFAULT NULL,
  `case_no` varchar(255) DEFAULT NULL,
  `complainants` json DEFAULT NULL,
  `defendants` json DEFAULT NULL,
  `status` enum('SCHEDULED','COMPLETED','ADJOURNED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  `current_date` date NOT NULL,
  `next_date` date DEFAULT NULL,
  `synopsis` text,
  `orders` text,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_daily_listings_matter_id` (`matter_id`),
  CONSTRAINT `FK_daily_listings_matter` FOREIGN KEY (`matter_id`) REFERENCES `matters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `daily_listing_clients` (
  `daily_listing_id` char(36) NOT NULL,
  `client_id` char(36) NOT NULL,
  PRIMARY KEY (`daily_listing_id`,`client_id`),
  KEY `IDX_dlc_client` (`client_id`),
  CONSTRAINT `FK_dlc_listing` FOREIGN KEY (`daily_listing_id`) REFERENCES `daily_listings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_dlc_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional upgrade from legacy `hearings` (run only if that table exists and is populated):
-- 1) INSERT INTO daily_listings (id, matter_id, case_type, case_no, complainants, defendants, status, current_date, next_date, synopsis, orders, created_at, updated_at)
--    SELECT id, matter_id, case_type, case_no, complainants, defendants, status, current_date, next_date, synopsis, orders, created_at, updated_at FROM hearings;
-- 2) INSERT INTO daily_listing_clients (daily_listing_id, client_id) SELECT id, client_id FROM hearings;
-- 3) DROP TABLE hearings;
