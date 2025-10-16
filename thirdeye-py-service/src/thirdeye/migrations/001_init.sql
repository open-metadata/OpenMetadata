-- ThirdEye Schema - Initial Migration
-- Version: 001_init.sql
-- Date: 2025-01-16
-- Description: Create basic tables in thirdeye schema

-- Note: Schema creation is handled by Python (ensure_schema_exists())
-- This file only creates tables within the thirdeye schema

USE thirdeye;

-- =============================================================================
-- Table: health_score_history
-- Stores ZI (Zero Inefficiency) score snapshots over time
-- =============================================================================
CREATE TABLE IF NOT EXISTS health_score_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    score INT NOT NULL COMMENT 'ZI Score (0-100)',
    meta JSON NULL COMMENT 'Additional metadata (breakdown, storage stats, etc)',
    INDEX idx_captured_at (captured_at),
    INDEX idx_score (score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historical ZI scores and infrastructure health metrics';

-- =============================================================================
-- Table: action_items
-- Stores cost optimization recommendations and actions
-- =============================================================================
CREATE TABLE IF NOT EXISTS action_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    category VARCHAR(50) NULL COMMENT 'storage, compute, query, etc.',
    priority ENUM('high', 'medium', 'low') DEFAULT 'medium',
    status ENUM('OPEN', 'IN_PROGRESS', 'DONE') DEFAULT 'OPEN',
    estimated_savings_usd DECIMAL(12,2) DEFAULT 0.00,
    fqn VARCHAR(500) NULL COMMENT 'Fully qualified name of resource',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    meta JSON NULL COMMENT 'Additional metadata',
    INDEX idx_status (status),
    INDEX idx_category (category),
    INDEX idx_priority (priority),
    INDEX idx_created_at (created_at),
    INDEX idx_fqn (fqn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cost optimization action items and recommendations';

-- =============================================================================
-- Insert sample data (optional - for testing)
-- =============================================================================

-- Insert a sample health score entry
INSERT IGNORE INTO health_score_history (id, captured_at, score, meta)
VALUES (
    1,
    CURRENT_TIMESTAMP,
    74,
    JSON_OBJECT(
        'breakdown', JSON_OBJECT(
            'storage', 60,
            'compute', 15,
            'query', 10,
            'others', 15
        ),
        'total_tables', 1500,
        'active_tables', 890
    )
);

-- =============================================================================
-- End of migration 001_init.sql
-- =============================================================================
