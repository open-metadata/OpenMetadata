-- ThirdEye Schema - Migration 004
-- Version: 004_detection_rules_config.sql
-- Date: 2025-01-16
-- Description: Create detection_rules and cost_basis_config tables

USE thirdeye;

-- =============================================================================
-- Table: detection_rules
-- Configuration for automated detection of optimization opportunities
-- =============================================================================
CREATE TABLE IF NOT EXISTS `detection_rules` (
    `rule_id` VARCHAR(50) PRIMARY KEY,
    `rule_name` VARCHAR(200) NOT NULL,
    `rule_category` ENUM('COST', 'USAGE', 'COMPLIANCE', 'PERFORMANCE') DEFAULT 'COST',
    `resource_type` VARCHAR(50) NOT NULL COMMENT 'TABLE, WAREHOUSE, DATABASE',
    
    -- Rule Logic
    `rule_sql` TEXT COMMENT 'SQL query to detect issues',
    `threshold_config` JSON DEFAULT NULL COMMENT 'Threshold configuration JSON',
    
    -- Grouping Configuration
    `enable_grouping` BOOLEAN DEFAULT TRUE,
    `grouping_strategy` ENUM('BY_SCHEMA', 'BY_PATTERN', 'BY_OWNER', 'BY_AGE', 'BY_TABLE') DEFAULT NULL,
    `min_items_to_group` INT DEFAULT 5,
    `max_items_per_group` INT DEFAULT 100,
    
    -- OpenMetadata Integration
    `om_alert_config` JSON DEFAULT NULL,
    `om_webhook_id` VARCHAR(36) DEFAULT NULL,
    
    -- Scheduling
    `is_active` BOOLEAN DEFAULT TRUE,
    `run_frequency` ENUM('DAILY', 'WEEKLY', 'MONTHLY') DEFAULT 'DAILY',
    `last_run_at` TIMESTAMP NULL DEFAULT NULL,
    `next_run_at` TIMESTAMP NULL DEFAULT NULL,
    
    -- Metadata
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX `idx_active_rules` (`is_active`, `next_run_at`),
    INDEX `idx_resource_type` (`resource_type`),
    INDEX `idx_category` (`rule_category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Automated detection rules for optimization opportunities';

-- =============================================================================
-- Table: cost_basis_config
-- Master pricing configuration for cost calculations
-- =============================================================================
CREATE TABLE IF NOT EXISTS `cost_basis_config` (
    `cost_basis_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- Service and Resource Identification
    `service` VARCHAR(50) NOT NULL COMMENT 'SNOWFLAKE, DATABRICKS, BIGQUERY, REDSHIFT',
    `resource_type` VARCHAR(50) NOT NULL COMMENT 'STORAGE, COMPUTE, TRANSFER, SERVERLESS',
    
    -- Pricing Information
    `cost_metric` VARCHAR(50) NOT NULL COMMENT 'PER_TB_MONTH, PER_CREDIT, PER_HOUR, PER_GB_TRANSFERRED',
    `unit_cost` DECIMAL(15,6) NOT NULL COMMENT 'Base cost per unit',
    `currency` VARCHAR(3) DEFAULT 'USD',
    
    -- Pricing Tiers (for volume discounts)
    `tier_name` VARCHAR(50) DEFAULT 'STANDARD' COMMENT 'STANDARD, DISCOUNTED, ENTERPRISE, COMMITTED',
    `min_units` DECIMAL(15,2) DEFAULT 0 COMMENT 'Minimum units for this tier',
    `max_units` DECIMAL(15,2) DEFAULT NULL COMMENT 'Maximum units (NULL = unlimited)',
    `discount_percentage` DECIMAL(5,2) DEFAULT 0 COMMENT 'Discount % from base price',
    
    -- Contract/Commitment Details
    `contract_type` VARCHAR(50) DEFAULT 'ON_DEMAND' COMMENT 'ON_DEMAND, RESERVED, COMMITTED_USE',
    `commitment_term_months` INT DEFAULT NULL COMMENT 'Contract term length',
    
    -- Validity Period
    `effective_start_date` DATE NOT NULL COMMENT 'When this pricing becomes effective',
    `effective_end_date` DATE DEFAULT NULL COMMENT 'When pricing expires (NULL = current)',
    `is_current` BOOLEAN DEFAULT TRUE COMMENT 'Whether pricing is currently active',
    
    -- Metadata
    `source` VARCHAR(100) DEFAULT 'MANUAL' COMMENT 'MANUAL, API, CONTRACT',
    `notes` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `created_by` VARCHAR(100) DEFAULT 'system',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `updated_by` VARCHAR(100) DEFAULT NULL,
    
    -- Indexes
    UNIQUE KEY `uk_current_pricing` (`service`, `resource_type`, `tier_name`, `effective_start_date`),
    INDEX `idx_service_resource` (`service`, `resource_type`),
    INDEX `idx_effective_dates` (`effective_start_date`, `effective_end_date`),
    INDEX `idx_is_current` (`is_current`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Master pricing configuration for cost calculations';

-- =============================================================================
-- Insert default cost basis data
-- =============================================================================

-- Snowflake Storage Cost - $18 per TB per month
INSERT IGNORE INTO cost_basis_config
(service, resource_type, cost_metric, unit_cost, currency,
 tier_name, min_units, max_units, discount_percentage, contract_type,
 commitment_term_months, effective_start_date, effective_end_date, source, notes,
 created_by, updated_by)
VALUES
('SNOWFLAKE', 'STORAGE', 'PER_TB_MONTH', 18.00, 'USD',
 'STANDARD', 0, NULL, 0.00, 'COMMITTED_USE', 12,
 '2024-01-01', NULL, 'CONTRACT', 'Negotiated storage rate: $18 per TB per month',
 'system', NULL),

-- Snowflake Compute Cost - $2.00 per credit
('SNOWFLAKE', 'COMPUTE', 'WAREHOUSE_COMPUTE', 2.00, 'USD',
 'STANDARD', 0, NULL, 0.00, 'ON_DEMAND', NULL,
 '2024-01-01', NULL, 'CONTRACT', 'Standard compute rate: $2 per Snowflake credit',
 'system', NULL),

-- Snowflake Data Transfer Cost
('SNOWFLAKE', 'TRANSFER', 'PER_GB_TRANSFERRED', 0.12, 'USD',
 'STANDARD', 0, NULL, 0.00, 'ON_DEMAND', NULL,
 '2024-01-01', NULL, 'CONTRACT', 'Data transfer costs: $0.12 per GB transferred',
 'system', NULL);

-- =============================================================================
-- End of migration 004
-- =============================================================================

