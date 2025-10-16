use thirdeye;
INSERT INTO cost_basis_config
(service, resource_type, cost_metric, unit_cost, currency,
 tier_name, min_units, max_units, discount_percentage, contract_type,
 commitment_term_months, effective_start_date, effective_end_date, source, notes,
 created_by, updated_by)
VALUES

-- 1. STORAGE COST - $18 per TB per month (as mentioned in requirements)
('SNOWFLAKE', 'STORAGE',  'PER_TB_MONTH', 18.00, 'USD',
 'STANDARD', 0, NULL, 0.00, 'COMMITTED_USE', 12,
 '2024-01-01', NULL, 'CONTRACT', 'Negotiated storage rate: $18 per TB per month',
 'admin@company.com', NULL),

-- 2. COMPUTE COST - $2.00 per credit (typical Snowflake compute pricing)
('SNOWFLAKE', 'COMPUTE', 'WAREHOUSE_COMPUTE', 2.00, 'USD',
 'STANDARD', 0, NULL, 0.00, 'ON_DEMAND', NULL,
 '2024-01-01', NULL, 'CONTRACT', 'Standard compute rate: $2 per Snowflake credit',
 'admin@company.com', NULL),

-- 3. OTHER COSTS - Data transfer/egress costs
('SNOWFLAKE', 'TRANSFER', 'PER_GB_TRANSFERRED', 0.12, 'USD',
 'STANDARD', 0, NULL, 0.00, 'ON_DEMAND', NULL,
 '2024-01-01', NULL, 'CONTRACT', 'Data transfer costs: $0.12 per GB transferred',
 'admin@company.com', NULL);


-- =====================================================
-- SIMPLIFIED DETECTION RULES FOR TABLE OPTIMIZATION
-- =====================================================
-- Based on: last_accessed_date
-- Three buckets: 30-60 days, 60-90 days, 90+ days
-- Only selecting FQN and RUN_DATE
-- =====================================================

USE thirdeye;

-- Clear ALL existing detection rules
DELETE FROM detection_rules;

-- =====================================================
-- INSERT SIMPLIFIED DETECTION RULES
-- =====================================================

INSERT INTO detection_rules
(rule_id, rule_name, rule_category, resource_type, rule_sql, threshold_config,
 enable_grouping, grouping_strategy, min_items_to_group, max_items_per_group,
 is_active, run_frequency, created_at, updated_at)
VALUES

-- =====================================================
-- RULE 1: Tables not accessed for 30-60 days (HIGH RISK)
-- =====================================================
('RULE_30_60_DAYS',
 'Tables Not Accessed 30-60 Days',
 'USAGE',
 'TABLE',
 'SELECT
    FQN,
    RUN_DATE
FROM fact_datalake_table_usage_inventory
WHERE RUN_DATE = (SELECT MAX(RUN_DATE) FROM fact_datalake_table_usage_inventory)
    AND DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) > 30
    AND DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) <= 60',
 '{
    "min_days": 30,
    "max_days": 60,
    "risk_level": "HIGH",
    "recommended_action": "REVIEW"
 }',
 true,
 'BY_TABLE',
 5,
 100,
 true,
 'WEEKLY',
 CURRENT_TIMESTAMP,
 CURRENT_TIMESTAMP),

-- =====================================================
-- RULE 2: Tables not accessed for 60-90 days (MEDIUM RISK)
-- =====================================================
('RULE_60_90_DAYS',
 'Tables Not Accessed 60-90 Days',
 'USAGE',
 'TABLE',
 'SELECT
    FQN,
    RUN_DATE
FROM fact_datalake_table_usage_inventory
WHERE RUN_DATE = (SELECT MAX(RUN_DATE) FROM fact_datalake_table_usage_inventory)
    AND DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) > 60
    AND DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) <= 90',
 '{
    "min_days": 60,
    "max_days": 90,
    "risk_level": "MEDIUM",
    "recommended_action": "ARCHIVE"
 }',
 true,
 'BY_SCHEMA',
 5,
 100,
 true,
 'WEEKLY',
 CURRENT_TIMESTAMP,
 CURRENT_TIMESTAMP),

-- =====================================================
-- RULE 3: Tables not accessed for 90+ days (LOW RISK)
-- =====================================================
('RULE_90_PLUS_DAYS',
 'Tables Not Accessed 90+ Days',
 'USAGE',
 'TABLE',
 'SELECT
    FQN,
    RUN_DATE
FROM fact_datalake_table_usage_inventory
WHERE RUN_DATE = (SELECT MAX(RUN_DATE) FROM fact_datalake_table_usage_inventory)
    AND DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) > 90',
 '{
    "min_days": 90,
    "max_days": null,
    "risk_level": "LOW",
    "recommended_action": "DELETE"
 }',
 true,
 'BY_SCHEMA',
 5,
 100,
 true,
 'WEEKLY',
 CURRENT_TIMESTAMP,
 CURRENT_TIMESTAMP);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- View all detection rules
SELECT
    rule_id,
    rule_name,
    JSON_UNQUOTE(JSON_EXTRACT(threshold_config, '$.min_days')) as min_days,
    JSON_UNQUOTE(JSON_EXTRACT(threshold_config, '$.max_days')) as max_days,
    JSON_UNQUOTE(JSON_EXTRACT(threshold_config, '$.risk_level')) as risk_level,
    JSON_UNQUOTE(JSON_EXTRACT(threshold_config, '$.recommended_action')) as action,
    is_active,
    run_frequency
FROM detection_rules
ORDER BY rule_id;

-- ==


SELECT
    FQN,
    RUN_DATE
FROM fact_datalake_table_usage_inventory
WHERE RUN_DATE = (SELECT MAX(RUN_DATE) FROM fact_datalake_table_usage_inventory)
    AND DATEDIFF(RUN_DATE, RUN_DATE) > 30
    AND DATEDIFF(RUN_DATE, RUN_DATE) <= 60;


select DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) from fact_datalake_table_usage_inventory where DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE)<60;


INSERT INTO opportunity_campaigns
(campaign_name, campaign_type, fqn_list, total_items, grouping_rule,
 service, resource_type, opportunity_type, current_monthly_cost, projected_savings,
 confidence_score, risk_level, status, items_actioned,
 expires_at, detection_rule_id, om_task_id,
 created_at, created_by, updated_at)
VALUES

-- =====================================================
-- CAMPAIGN 1: Test/Sandbox Tables Cleanup (30-60 days old)
-- =====================================================
('DETECT_2025_SANDBOX_TEST_CLEANUP',
 'PATTERN_BASED',
 '["test-SANDBOX_PRD-JMANANSALA_SANDBOX-WBR_MKTG_TOUCHPOINTS",
   "test-SANDBOX_PRD-SYUNUS_SANDBOX-HOM_DIM_MISMATCH_APM_CLOUD_L1_CONTACTS",
   "test-SANDBOX_PRD-SYUNUS_SANDBOX-HOM_DIM_MISMATCH_AGGREGATE_OFFER_TYPE_RESPONSE",
   "test-SANDBOX_PRD-DEBASHIS_SAHOO_SANDBOX-INT_MTA_ORG62_SALES_TP_STG1",
   "test-SANDBOX_PRD-OLISA_UBA_SANDBOX-INT_HOM_TABLEAU_AGG_CUBE_MP",
   "test-SANDBOX_PRD-COHMS_SANDBOX-INT_KALTURA_CNC_CHAT",
   "test-SANDBOX_PRD-CHRISTINE_BERGER_SANDBOX-STG_GOOGLE_DFA_CONVERSION_TAG",
   "test-SANDBOX_PRD-CHRISTINE_BERGER_SANDBOX-CDO_CAMPAIGN_ASSOCIATIONS_PRODUCT_FORMS",
   "test-SANDBOX_PRD-SFRASCO_SANDBOX-WBR_CONSOLIDATED_OU_V3",
   "test-SANDBOX_PRD-PRATHYUSH_HEBBAR_SANDBOX-WRK_MDW_ACV_TARGETS"]',
 10,
 'BY_PATTERN',
 'SNOWFLAKE',
 'TABLE',
 'SANDBOX_CLEANUP',
 125.50,  -- Assuming avg 700GB per table * 10 tables * $0.018/GB
 125.50,  -- 100% savings possible for sandbox tables
 0.85,    -- High confidence for sandbox cleanup
 'LOW',
 'OPEN',
 0,
 DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY),
 'RULE_30_60_DAYS',
 'task-sandbox-cleanup-2025',
 CURRENT_TIMESTAMP,
 'detection_service@company.com',
 CURRENT_TIMESTAMP),

-- =====================================================
-- CAMPAIGN 2: Backup/Archive Tables (90+ days old)
-- =====================================================
('DETECT_2025_ARCHIVE_TABLES_REMOVAL',
 'BULK_CLEANUP',
 '["test-SSE_DM_GDSO_PRD-ARCHIVE-HCPQYIEXMT_2025_05_27_04_56_30",
   "test-SSE_DM_GDSO_PRD-ARCHIVE-SDM_SE_SELLER_DATASET_HISTORY_TEST_2025_05_27_04_56_30",
   "test-SSE_DM_GDSO_PRD-ARCHIVE-Q1FY25_ACV_DATA_PRIME_T_2025_05_27_04_56_30",
   "test-SSE_PRD-SSE_FIN_CNTRLSHP_DZ-BKP_BDE_BDE_POC_FACT_AOV_DETAILS_01_11",
   "test-SSE_DM_FIN_PREPRD-FNS_BOOKINGS-ZZZ_APM_ACV_CSG_STG_BKP_210205",
   "test-SSE_DM_CSG_RPT_PRD-CI_STAGE-ZZZ_CI_PROD_EDU_ASSEMBLED_FORECASTS_BKP",
   "test-DEMO_DB-PUBLIC-FACT_HEROKU_USG_ENTTLMNT_MTHLY_VW_BKP_1003",
   "test-SANDBOX_PRD-PRATEEK_TANDON_SANDBOX-BKUP_15_APR_2024_FACT_AA_EVENT_TASK_UNION"]',
 8,
 'BY_PATTERN',
 'SNOWFLAKE',
 'TABLE',
 'ARCHIVE_CLEANUP',
 288.00,  -- Assuming avg 2000GB per archive table * 8 tables * $0.018/GB
 288.00,  -- 100% savings - archives over 90 days old
 0.95,    -- Very high confidence for old archives
 'LOW',
 'IN_REVIEW',
 0,
 DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY),
 'RULE_90_PLUS_DAYS',
 'task-archive-cleanup-2025',
 CURRENT_TIMESTAMP,
 'detection_service@company.com',
 CURRENT_TIMESTAMP),

-- =====================================================
-- CAMPAIGN 3: Old Dated Tables (60-90 days old)
-- =====================================================
('DETECT_2025_OLD_DATED_TABLES',
 'BULK_CLEANUP',
 '["test-SSE_DM_MKT_PRD-DS_MTA-ZZZ_LSTM_ATTRIBUTION_TOUCHPOINT_LEVEL_SAGEMAKER_20240719",
   "test-SSE_DM_MKT_PREPRD-INT_MARKETING_ANALYTICS-DM_VIZ_WBR_CONSOLIDATED_20241120",
   "test-SSE_DM_MKT_PRD-DS_MTA-MATURATION_TOUCHPOINT_LEVEL_ATTRIBUTION_FINAL_SAGEMAKERPIPELINE_FINAL_20241201",
   "test-SSE_DM_MKT_PREPRD-INT_MARKETING_ANALYTICS-DIM_OPPTY_CONTACT_ROLE_VW_20240703",
   "test-SSE_DM_MKT_PREPRD-INT_MARKETING_ANALYTICS-WV_LEADS_VW_20240925",
   "test-SSE_DM_MKT_PREPRD-INT_MARKETING_ANALYTICS-WV_PIPEGEN_ST1_QUARTERLY_SNAP_VW_20240928",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_942_161-ZZZ_WV_RESPONSE_VW_SNAPSHOT_20241018",
   "test-SSE_DM_MKT_PREPRD-INT_MEDIA_LAB-ZZZ_PAID_MEDIA_PUBLISHER_DELIVERY_SNAPSHOT_20240807",
   "test-SSE_DM_MKT_PREPRD-INT_MEDIA_LAB-ZZZ_PAID_MEDIA_PUBLISHER_DELIVERY_SNAPSHOT_20240812",
   "test-SSE_DM_TAB_DE_PREPRD-TABORG62_SNAPSHOT_CDL_CRM_CDL-ZZZ_ALPO_PARTNERMASTER_20220318_144218",
   "test-SSE_DM_TAB_DE_PRD-TABORG62_SNAPSHOT_CDL_CRM_CDL-ZZZ_ALPO_PURCHASINGONLINECUSTOMER_20220318_144218",
   "test-SSE_DM_MKT_PREPRD-INT_MARKETING_ANALYTICS-ZZZ_WV_MKTG_BDR_OPTY_LEAD_VW_20240505"]',
 12,
 'BY_AGE',
 'SNOWFLAKE',
 'TABLE',
 'OLD_SNAPSHOTS',
 162.00,  -- Assuming avg 750GB per snapshot * 12 tables * $0.018/GB
 162.00,  -- 100% savings for old snapshots
 0.80,    -- Good confidence for dated tables
 'MEDIUM',
 'OPEN',
 0,
 DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY),
 'RULE_60_90_DAYS',
 'task-old-snapshots-2025',
 CURRENT_TIMESTAMP,
 'detection_service@company.com',
 CURRENT_TIMESTAMP),

-- =====================================================
-- CAMPAIGN 4: DBT CI/Test Tables (30-60 days old)
-- =====================================================
('DETECT_2025_DBT_CI_TEST_CLEANUP',
 'PATTERN_BASED',
 '["test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_1165_86-ZZZ_MTA_INSIGHTS_TOUCHPOINT_DETAILS",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_1742_39-BASE_SOURCE_COLUMNS",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_1638_18-ZZZ_FCT_DUPLICATE_SOURCES",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_2013_14-INT_EMA_DSE_OFFERSENDLOG_LATAM_HISTORY",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_2013_55-INT_EMA_QSE_OFFERSENDLOG_APAC",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_1678_43-ZZZ_STG_GOOGLE_DISPLAY_AND_VIDEO_ADS_BRAND",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_1779_61-STG_EXPOSURES",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_1048_1068-ZZZ_MASHDASH_PUBLISHER_DELIVERY_WEEK",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_1678_122-INT_ALL_GRAPH_RESOURCES",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_1742_303-INT_ALL_DAG_RELATIONSHIPS",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_1779_28-ZZZ_FCT_HARD_CODED_REFERENCES",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_1742_310-FCT_STAGING_DEPENDENT_ON_MARTS_OR_INTERMEDIATE",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_1741_336-MDW_TRUST_USAGE",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_1779_19-MTA_MODEL_LONG_DATA_FINAL",
   "test-SSE_DM_DBT_CI_PREPRD-DBT_CLOUD_PR_1678_89-BASE_EXPOSURE_RELATIONSHIPS"]',
 15,
 'BY_PATTERN',
 'SNOWFLAKE',
 'TABLE',
 'CI_TEST_CLEANUP',
 67.50,   -- Assuming avg 250GB per CI table * 15 tables * $0.018/GB
 67.50,   -- 100% savings for CI/test tables
 0.90,    -- High confidence - these are CI artifacts
 'LOW',
 'OPEN',
 0,
 DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY),
 'RULE_30_60_DAYS',
 'task-dbt-ci-cleanup-2025',
 CURRENT_TIMESTAMP,
 'detection_service@company.com',
 CURRENT_TIMESTAMP);