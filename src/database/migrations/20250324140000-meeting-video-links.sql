-- Meeting video links: provider (Google Meet, Teams, Zoom) + client visibility flag.
-- Idempotent for existing DBs that already ran 20250324130000 without these columns.
-- MySQL 8+

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meetings'
     AND COLUMN_NAME = 'meeting_link_provider') = 0,
  'ALTER TABLE meetings ADD COLUMN meeting_link_provider ENUM(''google_meet'', ''microsoft_teams'', ''zoom'', ''other'') NULL COMMENT ''Join link vendor'' AFTER meeting_url',
  'SELECT 1'
);
PREPARE mlp FROM @sql;
EXECUTE mlp;
DEALLOCATE PREPARE mlp;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meetings'
     AND COLUMN_NAME = 'share_link_with_client') = 0,
  'ALTER TABLE meetings ADD COLUMN share_link_with_client TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''Expose meeting_url to client API'' AFTER meeting_link_provider',
  'SELECT 1'
);
PREPARE slc FROM @sql;
EXECUTE slc;
DEALLOCATE PREPARE slc;
