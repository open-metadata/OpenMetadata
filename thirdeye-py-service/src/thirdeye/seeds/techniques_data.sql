-- ThirdEye - Techniques Catalog Seed Data
-- Based on techniques_clean.json from old app
-- Date: 2025-01-16

USE thirdeye;

-- Create techniques table if it doesn't exist
CREATE TABLE IF NOT EXISTS `techniques` (
    `id` VARCHAR(100) PRIMARY KEY,
    `slug` VARCHAR(100) UNIQUE NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `subcategory` VARCHAR(50),
    `impact_level` VARCHAR(30) COMMENT 'quick_win, high_impact, strategic',
    `complexity` VARCHAR(20) COMMENT 'low, medium, high',
    `estimated_savings_pct` INT,
    `effort_minutes` INT,
    `description` TEXT,
    `how_to_implement` JSON,
    `code_snippet` TEXT,
    `success_indicators` JSON,
    `when_to_use` VARCHAR(500),
    `prerequisites` JSON,
    `tags` JSON,
    `last_reviewed` DATE,
    `status` VARCHAR(20) DEFAULT 'active',
    `version` INT DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_category` (`category`),
    INDEX `idx_impact` (`impact_level`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catalog of cost optimization techniques';

-- Insert techniques (sample - full list would be from techniques_clean.json)
INSERT IGNORE INTO techniques
(id, slug, title, category, subcategory, impact_level, complexity, estimated_savings_pct,
 effort_minutes, description, how_to_implement, code_snippet, success_indicators,
 when_to_use, prerequisites, tags, last_reviewed, status, version)
VALUES

-- Technique 1: Auto-Suspend
('enable-auto-suspend-on-idle-warehouses',
 'enable-auto-suspend-on-idle-warehouses',
 'Enable Auto-Suspend on Idle Warehouses',
 'warehouse', 'autosuspend', 'quick_win', 'low', 19, 15,
 'Idle dev and QA warehouses often burn credits even when no queries run. Auto-Suspend pauses compute after a short gap and eliminates that waste.',
 '["Run SQL to find median idle gap", "Multiply gap by 1.5 and round to nearest 10 seconds", "ALTER WAREHOUSE SET AUTO_SUSPEND", "Monitor for cold-start complaints"]',
 '```sql\nSELECT APPROX_PERCENTILE(\n  TIMESTAMPDIFF(second,\n      LAG(start_time) OVER(PARTITION BY warehouse_name ORDER BY start_time),\n      start_time),\n  0.5) AS median_gap_sec\nFROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY\nWHERE warehouse_name = ''DEV_WH'';\n\nALTER WAREHOUSE DEV_WH SET AUTO_SUSPEND = 90;\n```',
 '["Warehouse credit burn ↓ ≥ 20%", "No rise in dashboard time-out complaints"]',
 'If median idle gap is ≥ 120s for at least 70% of queries',
 '["Role: ACCOUNTADMIN", "Access to QUERY_HISTORY"]',
 '["warehouse", "autosuspend", "cost_optimization"]',
 '2025-08-08', 'active', 1),

-- Technique 2: Right-Size Warehouses
('right-size-warehouse-compute',
 'right-size-warehouse-compute',
 'Right-Size Warehouse Compute',
 'warehouse', 'sizing', 'high_impact', 'medium', 25, 46,
 'Many warehouses stay over-provisioned after launch. Adjusting size to match real workload trims credits without hurting performance.',
 '["Query WAREHOUSE_LOAD_HISTORY for queue length", "If queue ≈ 0 and exec time ≪ SLA → scale down", "ALTER WAREHOUSE SET WAREHOUSE_SIZE", "Re-check weekly until stable"]',
 '```sql\nSELECT warehouse_name,\n       AVG(queued_overload_time)/1000 AS avg_queue_s,\n       AVG(execution_time)/1000 AS avg_exec_s\nFROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_LOAD_HISTORY\nWHERE start_time >= DATEADD(day,-7,CURRENT_TIMESTAMP())\nGROUP BY 1;\n```',
 '["Credits/query ↓ ≥ 25%", "Query latency within SLA"]',
 'When avg queue length < 0.1 and avg exec time < 50% of SLA',
 '["Role: ACCOUNTADMIN", "Access to WAREHOUSE_LOAD_HISTORY"]',
 '["warehouse", "sizing", "cost_optimization"]',
 '2025-08-08', 'active', 1),

-- Technique 3: Parameterize Queries
('parameterise-repeating-queries',
 'parameterise-repeating-queries',
 'Parameterise Repeating Queries',
 'query', 'result_cache', 'quick_win', 'low', 10, 24,
 'Changing literals to bind parameters lets Snowflake reuse cached results, skipping compute on identical result sets.',
 '["Identify high-volume queries differing by literals", "Rewrite with bind parameters", "Monitor RESULT_CACHE_USAGE", "Aim for ≥ 70% cache hit rate"]',
 '```sql\n-- Before\nSELECT * FROM sales WHERE region = ''NORTH'';\n-- After\nSELECT * FROM sales WHERE region = :region_param;\n```',
 '["Compute credits ↓ ≥ 10%", "Result-cache hit ≥ 70%"]',
 'Same query text runs > 1,000 times/day with varying literals',
 '["Developers can modify app SQL"]',
 '["query", "result_cache", "cost_optimization"]',
 '2025-08-08', 'active', 1);

-- =============================================================================
-- Note: Full techniques catalog (20+ items) can be loaded via Python script
-- See: thirdeye-py-service/src/thirdeye/seeds/load_techniques.py
-- =============================================================================

