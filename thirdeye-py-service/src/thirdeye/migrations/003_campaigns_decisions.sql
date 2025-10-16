-- ThirdEye Schema - Migration 003
-- Version: 003_campaigns_decisions.sql
-- Date: 2025-01-16
-- Description: Create opportunity_campaigns and entity_decisions tables

USE thirdeye;

-- =============================================================================
-- Table: opportunity_campaigns
-- Groups optimization opportunities into campaigns (individual or bulk)
-- =============================================================================
CREATE TABLE IF NOT EXISTS `opportunity_campaigns` (
    `campaign_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `campaign_name` VARCHAR(200) NOT NULL,
    `campaign_type` VARCHAR(50) NOT NULL COMMENT 'INDIVIDUAL, BULK_CLEANUP, PATTERN_BASED',
    
    -- FQN List (JSON array)
    `fqn_list` JSON NOT NULL COMMENT 'Array of FQNs: ["table1"] or ["table1","table2",...]',
    `total_items` INT DEFAULT 1,
    
    -- Grouping Information
    `grouping_rule` VARCHAR(100) DEFAULT NULL COMMENT 'BY_SCHEMA, BY_PATTERN, BY_AGE, BY_OWNER, BY_TABLE',
    
    -- Resource Information
    `service` VARCHAR(50) NOT NULL COMMENT 'SNOWFLAKE, DATABRICKS, BIGQUERY',
    `resource_type` VARCHAR(50) NOT NULL COMMENT 'TABLE, WAREHOUSE, DATABASE',
    `opportunity_type` VARCHAR(100) NOT NULL COMMENT 'UNUSED_TABLE, OVERSIZED_WAREHOUSE, etc',
    
    -- Cost Metrics
    `current_monthly_cost` DECIMAL(12,2) DEFAULT 0,
    `projected_savings` DECIMAL(12,2) DEFAULT 0,
    `confidence_score` DECIMAL(3,2) DEFAULT 0.85 COMMENT '0.00 to 1.00',
    
    -- Risk Assessment
    `risk_level` ENUM('HIGH', 'MEDIUM', 'LOW') DEFAULT 'LOW',
    
    -- Status Tracking
    `status` ENUM('OPEN', 'IN_REVIEW', 'COMPLETED', 'EXPIRED') DEFAULT 'OPEN',
    `items_actioned` INT DEFAULT 0,
    `status_updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Expiration
    `expires_at` DATE DEFAULT NULL,
    
    -- Detection Rule Reference
    `detection_rule_id` VARCHAR(50) DEFAULT NULL,
    
    -- OpenMetadata Integration
    `om_task_id` VARCHAR(50) DEFAULT NULL COMMENT 'OpenMetadata task ID',
    
    -- Metadata
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `created_by` VARCHAR(100) DEFAULT 'system',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX `idx_status` (`status`),
    INDEX `idx_campaign_type` (`campaign_type`),
    INDEX `idx_om_task` (`om_task_id`),
    INDEX `idx_expires` (`expires_at`),
    INDEX `idx_detection_rule` (`detection_rule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Opportunity campaigns for cost optimization';

-- =============================================================================
-- Table: entity_decisions
-- Audit trail for every optimization decision made
-- =============================================================================
CREATE TABLE IF NOT EXISTS `entity_decisions` (
    `decision_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `campaign_id` BIGINT DEFAULT NULL COMMENT 'Links to campaign',
    
    -- Entity Information
    `service` VARCHAR(50) NOT NULL,
    `fqn` VARCHAR(500) NOT NULL,
    `type` VARCHAR(50) DEFAULT NULL,
    
    -- Decision Details
    `final_decision` ENUM('DELETE', 'ARCHIVE', 'KEEP', 'OPTIMIZE', 'DEFER') NOT NULL,
    `review_notes` TEXT DEFAULT NULL,
    `properties` JSON DEFAULT NULL COMMENT 'Additional decision metadata',
    
    -- Scheduling (for deferred actions)
    `scheduled_execution_date` DATE DEFAULT NULL,
    `actual_execution_date` DATE DEFAULT NULL,
    
    -- Decision Metadata
    `decision_date` DATE NOT NULL,
    `created_by` VARCHAR(100) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `modified_by` VARCHAR(100) DEFAULT NULL,
    `modified_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- OpenMetadata Integration
    `om_task_id` VARCHAR(36) DEFAULT NULL,
    
    -- Constraints and Indexes
    UNIQUE KEY `uk_fqn` (`fqn`(255)),
    INDEX `idx_campaign` (`campaign_id`),
    INDEX `idx_decision_date` (`decision_date`),
    INDEX `idx_final_decision` (`final_decision`),
    INDEX `idx_om_task` (`om_task_id`),
    
    CONSTRAINT `fk_campaign` FOREIGN KEY (`campaign_id`)
        REFERENCES `opportunity_campaigns`(`campaign_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Audit trail for optimization decisions';

-- =============================================================================
-- Table: notification_engagement_tracking
-- Tracks user engagement with notifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS `notification_engagement_tracking` (
    `tracking_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `campaign_id` BIGINT NOT NULL,
    
    -- OpenMetadata Reference
    `om_entity_id` VARCHAR(36) NOT NULL COMMENT 'Task/Alert ID in OpenMetadata',
    `om_entity_type` ENUM('task', 'alert', 'announcement') DEFAULT 'task',
    
    -- User Engagement
    `user_id` VARCHAR(100) NOT NULL,
    `first_viewed_at` TIMESTAMP NULL DEFAULT NULL,
    `last_viewed_at` TIMESTAMP NULL DEFAULT NULL,
    `view_count` INT DEFAULT 0,
    `clicked_at` TIMESTAMP NULL DEFAULT NULL,
    `dismissed_at` TIMESTAMP NULL DEFAULT NULL,
    
    -- Channel Information
    `notification_channel` ENUM('web', 'email', 'slack', 'teams') DEFAULT 'web',
    
    -- Metadata
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints and Indexes
    UNIQUE KEY `uk_user_campaign` (`user_id`, `campaign_id`),
    INDEX `idx_campaign_tracking` (`campaign_id`),
    INDEX `idx_om_entity` (`om_entity_id`),
    INDEX `idx_user` (`user_id`),
    
    CONSTRAINT `fk_campaign_tracking` FOREIGN KEY (`campaign_id`)
        REFERENCES `opportunity_campaigns`(`campaign_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Notification engagement metrics';

-- =============================================================================
-- Table: cost_tracking
-- Measures actual cost savings over time
-- =============================================================================
CREATE TABLE IF NOT EXISTS `cost_tracking` (
    `tracking_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- Entity Reference
    `fqn` VARCHAR(500) NOT NULL,
    `decision_id` BIGINT DEFAULT NULL,
    `campaign_id` BIGINT DEFAULT NULL,
    
    -- Measurement Period
    `measurement_date` DATE NOT NULL,
    `measurement_type` ENUM('DAILY', 'WEEKLY', 'MONTHLY') DEFAULT 'DAILY',
    
    -- Cost Measurements
    `baseline_cost` DECIMAL(12,2) DEFAULT 0 COMMENT 'Cost before action',
    `current_cost` DECIMAL(12,2) DEFAULT 0 COMMENT 'Current cost (0 if deleted)',
    
    -- Generated column for realized savings
    `realized_savings` DECIMAL(12,2) GENERATED ALWAYS AS (baseline_cost - current_cost) STORED,
    
    -- Metadata
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints and Indexes
    UNIQUE KEY `uk_fqn_date` (`fqn`(255), `measurement_date`),
    INDEX `idx_decision_tracking` (`decision_id`),
    INDEX `idx_campaign_tracking` (`campaign_id`),
    INDEX `idx_measurement_date` (`measurement_date`),
    INDEX `idx_fqn` (`fqn`(255)),
    
    CONSTRAINT `fk_decision_tracking` FOREIGN KEY (`decision_id`)
        REFERENCES `entity_decisions`(`decision_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_campaign_cost` FOREIGN KEY (`campaign_id`)
        REFERENCES `opportunity_campaigns`(`campaign_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cost tracking and savings measurement';

-- =============================================================================
-- End of migration 003
-- =============================================================================

