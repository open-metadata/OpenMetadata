-- ThirdEye Schema - Migration 005
-- Version: 005_views.sql
-- Date: 2025-01-16
-- Description: Create analytical views for purge scores and health metrics

USE thirdeye;

-- =============================================================================
-- View: v_table_purge_scores
-- Calculates purge scores for each table based on multiple factors
-- =============================================================================

CREATE OR REPLACE VIEW v_table_purge_scores AS
WITH score_components AS (
    SELECT
        FQN,
        DATABASE_NAME,
        DB_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE,
        ROLL_30D_TBL_UC,
        ROLL_30D_TBL_QC,
        CREATE_DATE,
        LAST_ACCESSED_DATE,
        LAST_REFRESHED_DATE,
        SIZE_GB,
        RUN_DATE,
        SERVICE,
        CREATED_BY,

        -- Component 1: SIZE IMPACT (10% weight)
        -- Larger tables = more savings potential
        CASE
            WHEN SIZE_GB IS NULL THEN 0
            WHEN SIZE_GB >= 10000 THEN 10  -- 10+ TB
            WHEN SIZE_GB >= 5000 THEN 9    -- 5-10 TB
            WHEN SIZE_GB >= 1000 THEN 8    -- 1-5 TB
            WHEN SIZE_GB >= 500 THEN 7     -- 500GB-1TB
            WHEN SIZE_GB >= 100 THEN 6     -- 100-500GB
            WHEN SIZE_GB >= 50 THEN 5      -- 50-100GB
            WHEN SIZE_GB >= 10 THEN 4      -- 10-50GB
            WHEN SIZE_GB >= 1 THEN 3       -- 1-10GB
            WHEN SIZE_GB > 0 THEN 2        -- <1GB
            ELSE 1
        END AS size_score,

        -- Component 2: ACCESS STALENESS (70% weight)
        -- Longer since last access = safer to purge
        CASE
            WHEN DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) > 90 OR LAST_ACCESSED_DATE IS NULL THEN 10  -- >90 days
            WHEN DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) > 60 THEN 5    -- 60-90 days
            WHEN DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) > 30 THEN 3    -- 30-60 days
            ELSE 1  -- <30 days
        END AS access_staleness_score,

        -- Component 3: USAGE FREQUENCY (10% weight)
        -- Lower usage = better purge candidate
        CASE
            WHEN COALESCE(ROLL_30D_TBL_QC, 0) = 0 THEN 10     -- No queries
            WHEN ROLL_30D_TBL_QC <= 1 THEN 9                  -- 1 query
            WHEN ROLL_30D_TBL_QC <= 5 THEN 8                  -- 2-5 queries
            WHEN ROLL_30D_TBL_QC <= 10 THEN 7                 -- 6-10 queries
            WHEN ROLL_30D_TBL_QC <= 25 THEN 6                 -- 11-25 queries
            WHEN ROLL_30D_TBL_QC <= 50 THEN 5                 -- 26-50 queries
            WHEN ROLL_30D_TBL_QC <= 100 THEN 3                -- 51-100 queries
            WHEN ROLL_30D_TBL_QC <= 500 THEN 2                -- 101-500 queries
            ELSE 1  -- >500 queries (heavily used)
        END AS usage_frequency_score,

        -- Component 4: REFRESH WASTE (5% weight)
        -- Tables refreshed but not accessed = waste
        CASE
            WHEN LAST_REFRESHED_DATE IS NULL AND LAST_ACCESSED_DATE IS NULL THEN 5
            WHEN LAST_REFRESHED_DATE IS NOT NULL AND LAST_ACCESSED_DATE IS NULL THEN 10
            WHEN LAST_REFRESHED_DATE > LAST_ACCESSED_DATE
                AND DATEDIFF(LAST_REFRESHED_DATE, LAST_ACCESSED_DATE) > 30 THEN 9
            WHEN LAST_REFRESHED_DATE > LAST_ACCESSED_DATE
                AND DATEDIFF(LAST_REFRESHED_DATE, LAST_ACCESSED_DATE) > 7 THEN 8
            WHEN LAST_REFRESHED_DATE > LAST_ACCESSED_DATE THEN 7
            WHEN LAST_ACCESSED_DATE >= LAST_REFRESHED_DATE THEN 3
            ELSE 5
        END AS refresh_waste_score,

        -- Component 5: USER ENGAGEMENT (5% weight)
        -- Fewer users = easier to migrate/remove
        CASE
            WHEN COALESCE(ROLL_30D_TBL_UC, 0) = 0 THEN 10    -- No users
            WHEN ROLL_30D_TBL_UC = 1 THEN 8                   -- 1 user
            WHEN ROLL_30D_TBL_UC <= 5 THEN 6                  -- 2-5 users
            WHEN ROLL_30D_TBL_UC <= 10 THEN 4                 -- 6-10 users
            WHEN ROLL_30D_TBL_UC <= 25 THEN 2                 -- 11-25 users
            ELSE 1  -- >25 users (widely used)
        END AS user_engagement_score,

        -- Additional metrics
        DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) AS days_since_access,
        ROUND(COALESCE(SIZE_GB, 0) * 0.018, 2) AS monthly_cost_usd

    FROM fact_datalake_table_usage_inventory
    WHERE RUN_DATE = (SELECT MAX(RUN_DATE) FROM fact_datalake_table_usage_inventory)
)
SELECT
    FQN,
    DATABASE_NAME,
    DB_SCHEMA,
    TABLE_NAME,
    TABLE_TYPE,
    SIZE_GB,
    days_since_access,
    ROLL_30D_TBL_QC,
    ROLL_30D_TBL_UC,
    monthly_cost_usd,

    -- Individual component scores
    size_score,
    access_staleness_score,
    usage_frequency_score,
    refresh_waste_score,
    user_engagement_score,

    -- Final purge score (weighted average)
    ROUND(
        (size_score * 0.10) +           -- 10% weight on size
        (access_staleness_score * 0.70) + -- 70% weight on staleness
        (usage_frequency_score * 0.10) +  -- 10% weight on usage
        (refresh_waste_score * 0.05) +    -- 5% weight on refresh waste
        (user_engagement_score * 0.05),   -- 5% weight on users
        1
    ) AS purge_score,

    -- Risk category
    CASE
        WHEN ROUND(
            (size_score * 0.10) +
            (access_staleness_score * 0.70) +
            (usage_frequency_score * 0.10) +
            (refresh_waste_score * 0.05) +
            (user_engagement_score * 0.05), 1
        ) >= 8 THEN 'EXCELLENT_CANDIDATE'
        WHEN ROUND(
            (size_score * 0.10) +
            (access_staleness_score * 0.70) +
            (usage_frequency_score * 0.10) +
            (refresh_waste_score * 0.05) +
            (user_engagement_score * 0.05), 1
        ) >= 6 THEN 'GOOD_CANDIDATE'
        WHEN ROUND(
            (size_score * 0.10) +
            (access_staleness_score * 0.70) +
            (usage_frequency_score * 0.10) +
            (refresh_waste_score * 0.05) +
            (user_engagement_score * 0.05), 1
        ) >= 4 THEN 'REVIEW_REQUIRED'
        ELSE 'KEEP'
    END AS recommendation,

    -- Potential savings
    ROUND(COALESCE(SIZE_GB, 0) * 0.018 * 12, 2) AS annual_savings_usd,

    -- Additional metadata
    LAST_ACCESSED_DATE,
    LAST_REFRESHED_DATE,
    CREATE_DATE,
    SERVICE,
    CREATED_BY,
    RUN_DATE

FROM score_components
ORDER BY purge_score DESC, monthly_cost_usd DESC;

-- =============================================================================
-- View: v_datalake_health_metrics
-- Calculates overall data lake health score and metrics
-- =============================================================================

CREATE OR REPLACE VIEW v_datalake_health_metrics AS
WITH table_scores AS (
    SELECT
        FQN,
        DATABASE_NAME,
        DB_SCHEMA,
        TABLE_NAME,
        SIZE_GB,
        COALESCE(SIZE_GB, 0) as size_gb_clean,
        days_since_access,
        COALESCE(days_since_access, 9999) as days_since_access_clean,
        ROLL_30D_TBL_QC,
        COALESCE(ROLL_30D_TBL_QC, 0) as queries_clean,
        ROLL_30D_TBL_UC,
        COALESCE(ROLL_30D_TBL_UC, 0) as users_clean,
        purge_score,
        monthly_cost_usd,
        LAST_ACCESSED_DATE,
        LAST_REFRESHED_DATE,
        access_staleness_score,
        RUN_DATE
    FROM v_table_purge_scores
),
utilization_metrics AS (
    SELECT
        -- Basic counts
        COUNT(*) as total_tables,
        SUM(CASE WHEN access_staleness_score < 7 THEN 1 ELSE 0 END) as active_tables,
        SUM(CASE WHEN access_staleness_score >= 7 THEN 1 ELSE 0 END) as inactive_tables,

        -- Storage metrics (in GB)
        SUM(size_gb_clean) as total_storage_gb,
        SUM(CASE WHEN access_staleness_score < 7 THEN size_gb_clean ELSE 0 END) as active_storage_gb,
        SUM(CASE WHEN access_staleness_score >= 7 THEN size_gb_clean ELSE 0 END) as waste_storage_gb,

        -- Access metrics
        SUM(CASE WHEN days_since_access_clean <= 30 THEN 1 ELSE 0 END) as recently_accessed_tables,
        SUM(CASE WHEN days_since_access_clean > 90 THEN 1 ELSE 0 END) as stale_tables,
        SUM(CASE WHEN days_since_access_clean > 365 THEN 1 ELSE 0 END) as very_stale_tables,

        -- Query activity metrics
        SUM(queries_clean) as total_monthly_queries,
        AVG(queries_clean) as avg_queries_per_table,
        SUM(CASE WHEN queries_clean = 0 THEN 1 ELSE 0 END) as zero_query_tables,

        -- User engagement metrics
        SUM(users_clean) as total_unique_users,
        AVG(users_clean) as avg_users_per_table,
        SUM(CASE WHEN users_clean = 0 THEN 1 ELSE 0 END) as zero_user_tables,

        -- Cost metrics
        SUM(monthly_cost_usd) as total_monthly_cost,
        SUM(CASE WHEN access_staleness_score < 7 THEN monthly_cost_usd ELSE 0 END) as justified_monthly_cost,
        SUM(CASE WHEN access_staleness_score >= 7 THEN monthly_cost_usd ELSE 0 END) as waste_monthly_cost,

        -- Zombie tables (no activity at all)
        SUM(CASE
            WHEN queries_clean = 0
            AND users_clean = 0
            AND days_since_access_clean > 90
            THEN 1 ELSE 0
        END) as zombie_tables

    FROM table_scores
),
component_scores AS (
    SELECT
        -- Component 1: Utilization Rate (40% weight)
        ROUND((active_tables * 100.0 / NULLIF(total_tables, 0)), 2) as utilization_rate,

        -- Component 2: Storage Efficiency (35% weight)
        ROUND((active_storage_gb * 100.0 / NULLIF(total_storage_gb, 0)), 2) as storage_efficiency,

        -- Component 3: Access Freshness (25% weight)
        ROUND((recently_accessed_tables * 100.0 / NULLIF(total_tables, 0)), 2) as access_freshness,

        -- Additional raw metrics
        total_tables,
        active_tables,
        inactive_tables,
        total_storage_gb,
        active_storage_gb,
        waste_storage_gb,
        recently_accessed_tables,
        stale_tables,
        very_stale_tables,
        zombie_tables,
        total_monthly_queries,
        avg_queries_per_table,
        zero_query_tables,
        total_unique_users,
        avg_users_per_table,
        zero_user_tables,
        total_monthly_cost,
        justified_monthly_cost,
        waste_monthly_cost

    FROM utilization_metrics
)
SELECT
    -- FINAL HEALTH SCORE (ZI Score)
    ROUND(
        (COALESCE(utilization_rate, 0) * 0.40) +      -- 40% weight
        (COALESCE(storage_efficiency, 0) * 0.35) +    -- 35% weight
        (COALESCE(access_freshness, 0) * 0.25),       -- 25% weight
        1
    ) as health_score,

    -- Health Classification
    CASE
        WHEN ROUND(
            (COALESCE(utilization_rate, 0) * 0.40) +
            (COALESCE(storage_efficiency, 0) * 0.35) +
            (COALESCE(access_freshness, 0) * 0.25), 1
        ) >= 80 THEN 'EXCELLENT'
        WHEN ROUND(
            (COALESCE(utilization_rate, 0) * 0.40) +
            (COALESCE(storage_efficiency, 0) * 0.35) +
            (COALESCE(access_freshness, 0) * 0.25), 1
        ) >= 60 THEN 'GOOD'
        WHEN ROUND(
            (COALESCE(utilization_rate, 0) * 0.40) +
            (COALESCE(storage_efficiency, 0) * 0.35) +
            (COALESCE(access_freshness, 0) * 0.25), 1
        ) >= 40 THEN 'FAIR'
        WHEN ROUND(
            (COALESCE(utilization_rate, 0) * 0.40) +
            (COALESCE(storage_efficiency, 0) * 0.35) +
            (COALESCE(access_freshness, 0) * 0.25), 1
        ) >= 20 THEN 'POOR'
        ELSE 'CRITICAL'
    END as health_status,

    -- Component Scores
    utilization_rate,
    storage_efficiency,
    access_freshness,

    -- Key Metrics
    total_tables,
    active_tables,
    inactive_tables,
    ROUND((inactive_tables * 100.0 / NULLIF(total_tables, 0)), 1) as inactive_percentage,

    -- Storage Metrics (convert to TB)
    ROUND(total_storage_gb / 1024, 2) as total_storage_tb,
    ROUND(active_storage_gb / 1024, 2) as active_storage_tb,
    ROUND(waste_storage_gb / 1024, 2) as waste_storage_tb,
    ROUND((waste_storage_gb * 100.0 / NULLIF(total_storage_gb, 0)), 1) as waste_percentage,

    -- Cost Metrics
    ROUND(total_monthly_cost, 2) as total_monthly_cost_usd,
    ROUND(waste_monthly_cost, 2) as monthly_savings_opportunity_usd,
    ROUND(waste_monthly_cost * 12, 2) as annual_savings_opportunity_usd,
    ROUND((waste_monthly_cost * 100.0 / NULLIF(total_monthly_cost, 0)), 1) as cost_waste_percentage,

    -- Problem Indicators
    zombie_tables,
    ROUND((zombie_tables * 100.0 / NULLIF(total_tables, 0)), 1) as zombie_percentage,
    stale_tables,
    ROUND((stale_tables * 100.0 / NULLIF(total_tables, 0)), 1) as stale_percentage,

    -- Activity Metrics
    total_monthly_queries,
    ROUND(avg_queries_per_table, 1) as avg_queries_per_table,
    zero_query_tables,
    ROUND((zero_query_tables * 100.0 / NULLIF(total_tables, 0)), 1) as zero_query_percentage,

    -- User Metrics
    total_unique_users,
    ROUND(avg_users_per_table, 1) as avg_users_per_table,
    zero_user_tables,
    ROUND((zero_user_tables * 100.0 / NULLIF(total_tables, 0)), 1) as zero_user_percentage,

    -- Breakdown for UI display
    -- Storage component (35% of score)
    ROUND(COALESCE(storage_efficiency, 0) * 0.35, 1) as breakdown_storage,
    -- Compute/utilization component (40% of score)  
    ROUND(COALESCE(utilization_rate, 0) * 0.40, 1) as breakdown_compute,
    -- Query/access component (25% of score)
    ROUND(COALESCE(access_freshness, 0) * 0.25, 1) as breakdown_query,
    -- Others (placeholders for consistency)
    0 as breakdown_others,
    0 as roi,

    -- Timestamp
    CURRENT_TIMESTAMP as calculated_at

FROM component_scores;

-- =============================================================================
-- View: v_campaign_summary
-- Summary view for campaigns with decision counts
-- =============================================================================

CREATE OR REPLACE VIEW v_campaign_summary AS
SELECT 
    c.campaign_id,
    c.campaign_name,
    c.campaign_type,
    c.status,
    c.total_items,
    c.items_actioned,
    c.projected_savings,
    c.current_monthly_cost,
    c.service,
    c.opportunity_type,
    c.created_at,
    c.expires_at,
    COUNT(DISTINCT ed.decision_id) as decisions_made,
    SUM(CASE WHEN ed.final_decision = 'DELETE' THEN 1 ELSE 0 END) as delete_count,
    SUM(CASE WHEN ed.final_decision = 'ARCHIVE' THEN 1 ELSE 0 END) as archive_count,
    SUM(CASE WHEN ed.final_decision = 'KEEP' THEN 1 ELSE 0 END) as keep_count,
    SUM(CASE WHEN ed.final_decision = 'OPTIMIZE' THEN 1 ELSE 0 END) as optimize_count,
    SUM(CASE WHEN ed.final_decision = 'DEFER' THEN 1 ELSE 0 END) as defer_count
FROM opportunity_campaigns c
LEFT JOIN entity_decisions ed ON c.campaign_id = ed.campaign_id
GROUP BY c.campaign_id;

-- =============================================================================
-- View: v_savings_summary
-- Monthly savings summary by service
-- =============================================================================

CREATE OR REPLACE VIEW v_savings_summary AS
SELECT 
    DATE_FORMAT(d.decision_date, '%Y-%m') as month,
    d.service,
    COUNT(DISTINCT d.decision_id) as decisions_made,
    COUNT(DISTINCT CASE WHEN d.final_decision = 'DELETE' THEN d.decision_id END) as tables_deleted,
    COUNT(DISTINCT CASE WHEN d.final_decision = 'ARCHIVE' THEN d.decision_id END) as tables_archived,
    SUM(ct.realized_savings) as realized_monthly_savings,
    MAX(ct.realized_savings) as peak_monthly_savings
FROM entity_decisions d
LEFT JOIN cost_tracking ct ON d.decision_id = ct.decision_id
GROUP BY DATE_FORMAT(d.decision_date, '%Y-%m'), d.service
ORDER BY month DESC;

-- =============================================================================
-- End of migration 005
-- =============================================================================

