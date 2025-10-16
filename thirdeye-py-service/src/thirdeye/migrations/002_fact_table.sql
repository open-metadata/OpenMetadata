-- ThirdEye Schema - Migration 002
-- Version: 002_fact_table.sql
-- Date: 2025-01-16
-- Description: Create fact_datalake_table_usage_inventory table for daily snapshots

USE thirdeye;

-- =============================================================================
-- Table: fact_datalake_table_usage_inventory
-- Daily snapshots of table usage metrics from various data platforms
-- =============================================================================
CREATE TABLE IF NOT EXISTS `fact_datalake_table_usage_inventory` (
    -- Generated FQN column (Fully Qualified Name)
    `FQN` VARCHAR(500) GENERATED ALWAYS AS (
        CONCAT(SERVICE, '-', DATABASE_NAME, '-', DB_SCHEMA, '-', TABLE_NAME)
    ) STORED,
    
    -- Table Identification
    `DATABASE_NAME` VARCHAR(100) DEFAULT NULL,
    `DB_SCHEMA` VARCHAR(100) DEFAULT NULL,
    `TABLE_NAME` VARCHAR(200) DEFAULT NULL,
    `TABLE_TYPE` VARCHAR(50) DEFAULT NULL,
    
    -- 30-Day Rolling Metrics
    `ROLL_30D_TBL_UC` INT DEFAULT NULL COMMENT '30-day rolling unique user count',
    `ROLL_30D_SCHEMA_UC` INT DEFAULT NULL COMMENT '30-day rolling schema users',
    `ROLL_30D_DB_UC` INT DEFAULT NULL COMMENT '30-day rolling database users',
    `ROLL_30D_TBL_QC` INT DEFAULT NULL COMMENT '30-day rolling query count',
    
    -- Date Metrics
    `CREATE_DATE` DATE DEFAULT NULL,
    `LAST_ACCESSED_DATE` DATE DEFAULT NULL,
    `LAST_REFRESHED_DATE` DATE DEFAULT NULL,
    
    -- Storage Metrics
    `SIZE_GB` DECIMAL(20,10) DEFAULT NULL,
    
    -- Run Information
    `RUN_DATE` DATE DEFAULT NULL,
    `START_DATE` DATE DEFAULT NULL,
    `END_DATE` DATE DEFAULT NULL,
    `ROLL_30D_START_DATE` DATE DEFAULT NULL,
    
    -- Service Information
    `SERVICE` VARCHAR(50) DEFAULT NULL COMMENT 'SNOWFLAKE, DATABRICKS, BIGQUERY, etc',
    `CREATED_BY` VARCHAR(100) DEFAULT NULL,
    
    -- Constraints and Indexes
    UNIQUE KEY `unique_record` (`FQN`(255), `RUN_DATE`),
    INDEX `idx_run_date` (`RUN_DATE`),
    INDEX `idx_service` (`SERVICE`),
    INDEX `idx_last_accessed` (`LAST_ACCESSED_DATE`),
    INDEX `idx_size` (`SIZE_GB`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Daily snapshots of table usage from data lakes';

-- =============================================================================
-- End of migration 002
-- =============================================================================

