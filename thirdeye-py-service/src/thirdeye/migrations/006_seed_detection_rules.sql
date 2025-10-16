-- ThirdEye Schema - Migration 006
-- Version: 006_seed_detection_rules.sql
-- Date: 2025-01-16
-- Description: Seed detection rules for automated opportunity detection

USE thirdeye;

-- =============================================================================
-- Seed Detection Rules
-- Based on last_accessed_date thresholds
-- =============================================================================

-- Rule 1: Tables not accessed for 30-60 days
INSERT IGNORE INTO detection_rules
(rule_id, rule_name, rule_category, resource_type, rule_sql, threshold_config,
 enable_grouping, grouping_strategy, min_items_to_group, max_items_per_group,
 is_active, run_frequency, created_at, updated_at)
VALUES
('RULE_30_60_DAYS',
 'Tables Not Accessed 30-60 Days',
 'USAGE',
 'TABLE',
 'SELECT FQN, RUN_DATE FROM fact_datalake_table_usage_inventory WHERE RUN_DATE = (SELECT MAX(RUN_DATE) FROM fact_datalake_table_usage_inventory) AND DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) > 30 AND DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) <= 60',
 '{"min_days": 30, "max_days": 60, "risk_level": "HIGH", "recommended_action": "REVIEW"}',
 true,
 'BY_TABLE',
 5,
 100,
 true,
 'WEEKLY',
 CURRENT_TIMESTAMP,
 CURRENT_TIMESTAMP);

-- Rule 2: Tables not accessed for 60-90 days
INSERT IGNORE INTO detection_rules
(rule_id, rule_name, rule_category, resource_type, rule_sql, threshold_config,
 enable_grouping, grouping_strategy, min_items_to_group, max_items_per_group,
 is_active, run_frequency, created_at, updated_at)
VALUES
('RULE_60_90_DAYS',
 'Tables Not Accessed 60-90 Days',
 'USAGE',
 'TABLE',
 'SELECT FQN, RUN_DATE FROM fact_datalake_table_usage_inventory WHERE RUN_DATE = (SELECT MAX(RUN_DATE) FROM fact_datalake_table_usage_inventory) AND DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) > 60 AND DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) <= 90',
 '{"min_days": 60, "max_days": 90, "risk_level": "MEDIUM", "recommended_action": "ARCHIVE"}',
 true,
 'BY_SCHEMA',
 5,
 100,
 true,
 'WEEKLY',
 CURRENT_TIMESTAMP,
 CURRENT_TIMESTAMP);

-- Rule 3: Tables not accessed for 90+ days
INSERT IGNORE INTO detection_rules
(rule_id, rule_name, rule_category, resource_type, rule_sql, threshold_config,
 enable_grouping, grouping_strategy, min_items_to_group, max_items_per_group,
 is_active, run_frequency, created_at, updated_at)
VALUES
('RULE_90_PLUS_DAYS',
 'Tables Not Accessed 90+ Days',
 'USAGE',
 'TABLE',
 'SELECT FQN, RUN_DATE FROM fact_datalake_table_usage_inventory WHERE RUN_DATE = (SELECT MAX(RUN_DATE) FROM fact_datalake_table_usage_inventory) AND DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) > 90',
 '{"min_days": 90, "max_days": null, "risk_level": "LOW", "recommended_action": "DELETE"}',
 true,
 'BY_SCHEMA',
 5,
 100,
 true,
 'WEEKLY',
 CURRENT_TIMESTAMP,
 CURRENT_TIMESTAMP);

-- Rule 4: Zombie tables (no queries, no users, old)
INSERT IGNORE INTO detection_rules
(rule_id, rule_name, rule_category, resource_type, rule_sql, threshold_config,
 enable_grouping, grouping_strategy, min_items_to_group, max_items_per_group,
 is_active, run_frequency, created_at, updated_at)
VALUES
('RULE_ZOMBIE_TABLES',
 'Zombie Tables Detection',
 'COST',
 'TABLE',
 'SELECT FQN, RUN_DATE FROM fact_datalake_table_usage_inventory WHERE RUN_DATE = (SELECT MAX(RUN_DATE) FROM fact_datalake_table_usage_inventory) AND COALESCE(ROLL_30D_TBL_QC, 0) = 0 AND COALESCE(ROLL_30D_TBL_UC, 0) = 0 AND DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) > 90',
 '{"min_inactive_days": 90, "risk_level": "HIGH", "recommended_action": "DELETE"}',
 true,
 'BY_SCHEMA',
 10,
 200,
 true,
 'DAILY',
 CURRENT_TIMESTAMP,
 CURRENT_TIMESTAMP);

-- =============================================================================
-- End of migration 006
-- =============================================================================

