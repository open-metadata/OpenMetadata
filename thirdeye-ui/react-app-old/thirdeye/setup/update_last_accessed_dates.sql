-- =====================================================
-- MySQL SQL Program to Update LAST_ACCESSED_DATE
-- Randomly generates dates from July 2023 to December 2023
-- =====================================================

-- First, let's see the current state of the table
SELECT last_accessed_date,
    COUNT(*) as total_records
FROM fact_datalake_table_usage_inventory
GROUP BY last_accessed_date;

-- =====================================================
-- Update LAST_ACCESSED_DATE with random dates
-- Date range: July 1, 2023 to December 31, 2023
-- =====================================================
select distinct RUN_DATE from fact_datalake_table_usage_inventory;
UPDATE fact_datalake_table_usage_inventory 
SET LAST_ACCESSED_DATE = DATE_ADD(
    '2025-04-01',
    INTERVAL FLOOR(RAND() * DATEDIFF('2025-08-19', '2025-04-01')) DAY
);

-- Commit the changes
COMMIT;
