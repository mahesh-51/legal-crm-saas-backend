-- Align meetings.title with API (optional / nullable).
ALTER TABLE `meetings`
  MODIFY COLUMN `title` varchar(500) NULL;
