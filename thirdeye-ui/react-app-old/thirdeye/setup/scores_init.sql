-- Drop existing view if exists
DROP VIEW IF EXISTS v_table_purge_scores;

-- =====================================================
-- CREATE PURGE SCORE VIEW FOR TABLES
-- =====================================================

CREATE VIEW v_table_purge_scores AS
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

        -- =====================================================
        -- COMPONENT 1: SIZE IMPACT (Weight: 35%)
        -- Larger tables = more savings potential
        -- =====================================================
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

        -- =====================================================
        -- COMPONENT 2: ACCESS STALENESS (Weight: 30%)
        -- Longer since last access = safer to purge
        -- =====================================================
        CASE
            WHEN DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) > 90 OR LAST_ACCESSED_DATE IS NULL THEN 10  -- >90 days
            WHEN DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) > 60 THEN 5    -- 60-90 days
            WHEN DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) > 30 THEN 3    -- 30-60 days
            ELSE 1  -- <30 days
        END AS access_staleness_score,

        -- =====================================================
        -- COMPONENT 3: USAGE FREQUENCY (Weight: 20%)
        -- Lower usage = better purge candidate
        -- =====================================================
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

        -- =====================================================
        -- COMPONENT 4: REFRESH WASTE (Weight: 10%)
        -- Tables refreshed but not accessed = waste
        -- =====================================================
        CASE
            -- Never refreshed or accessed = neutral
            WHEN LAST_REFRESHED_DATE IS NULL AND LAST_ACCESSED_DATE IS NULL THEN 5
            -- Refreshed but never accessed = high waste
            WHEN LAST_REFRESHED_DATE IS NOT NULL AND LAST_ACCESSED_DATE IS NULL THEN 10
            -- Refreshed more recently than accessed = waste
            WHEN LAST_REFRESHED_DATE > LAST_ACCESSED_DATE
                AND DATEDIFF(LAST_REFRESHED_DATE, LAST_ACCESSED_DATE) > 30 THEN 9
            WHEN LAST_REFRESHED_DATE > LAST_ACCESSED_DATE
                AND DATEDIFF(LAST_REFRESHED_DATE, LAST_ACCESSED_DATE) > 7 THEN 8
            WHEN LAST_REFRESHED_DATE > LAST_ACCESSED_DATE THEN 7
            -- Accessed more recently than refreshed = actively used
            WHEN LAST_ACCESSED_DATE >= LAST_REFRESHED_DATE THEN 3
            ELSE 5
        END AS refresh_waste_score,

        -- =====================================================
        -- COMPONENT 5: USER ENGAGEMENT (Weight: 5%)
        -- Fewer users = easier to migrate/remove
        -- =====================================================
        CASE
            WHEN COALESCE(ROLL_30D_TBL_UC, 0) = 0 THEN 10    -- No users
            WHEN ROLL_30D_TBL_UC = 1 THEN 8                   -- 1 user
            WHEN ROLL_30D_TBL_UC <= 5 THEN 6                  -- 2-5 users
            WHEN ROLL_30D_TBL_UC <= 10 THEN 4                 -- 6-10 users
            WHEN ROLL_30D_TBL_UC <= 25 THEN 2                 -- 11-25 users
            ELSE 1  -- >25 users (widely used)
        END AS user_engagement_score,

        -- Calculate days since last access for additional context
        DATEDIFF(RUN_DATE, LAST_ACCESSED_DATE) AS days_since_access,

        -- Calculate monthly cost
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

    -- Individual component scores (for transparency)
    size_score,
    access_staleness_score,
    usage_frequency_score,
    refresh_waste_score,
    user_engagement_score,

    -- =====================================================
    -- FINAL PURGE SCORE CALCULATION
    -- Weighted average of all components
    -- =====================================================
    ROUND(
        (size_score * 0.10) +           -- 20% weight on size
        (access_staleness_score * 0.70) + -- 50% weight on staleness
        (usage_frequency_score * 0.10) +  -- 20% weight on usage
        (refresh_waste_score * 0.05) +    -- 5% weight on refresh waste
        (user_engagement_score * 0.05),   -- 5% weight on users
        1
    ) AS purge_score,

    -- =====================================================
    -- RISK CATEGORY BASED ON SCORE
    -- =====================================================
    CASE
        WHEN ROUND(
            (size_score * 0.35) +
            (access_staleness_score * 0.30) +
            (usage_frequency_score * 0.20) +
            (refresh_waste_score * 0.10) +
            (user_engagement_score * 0.05), 1
        ) >= 8 THEN 'EXCELLENT_CANDIDATE'
        WHEN ROUND(
            (size_score * 0.35) +
            (access_staleness_score * 0.30) +
            (usage_frequency_score * 0.20) +
            (refresh_waste_score * 0.10) +
            (user_engagement_score * 0.05), 1
        ) >= 6 THEN 'GOOD_CANDIDATE'
        WHEN ROUND(
            (size_score * 0.35) +
            (access_staleness_score * 0.30) +
            (usage_frequency_score * 0.20) +
            (refresh_waste_score * 0.10) +
            (user_engagement_score * 0.05), 1
        ) >= 4 THEN 'REVIEW_REQUIRED'
        ELSE 'KEEP'
    END AS recommendation,

    -- =====================================================
    -- POTENTIAL ANNUAL SAVINGS
    -- =====================================================
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

-- Create view for health score calculation
DROP VIEW IF EXISTS v_datalake_health_metrics;

CREATE VIEW v_datalake_health_metrics AS
WITH table_scores AS (
    -- First, get all table scores from the purge score view
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
        SUM(CASE WHEN access_staleness_score > 7 THEN 1 ELSE 0 END) as inactive_tables,

        -- Storage metrics (in GB)
        SUM(size_gb_clean) as total_storage_gb,
        SUM(CASE WHEN access_staleness_score < 7 THEN size_gb_clean ELSE 0 END) as active_storage_gb,
        SUM(CASE WHEN access_staleness_score > 7 THEN size_gb_clean ELSE 0 END) as waste_storage_gb,

        -- Access metrics
        SUM(CASE WHEN days_since_access_clean <= 30 THEN 1 ELSE 0 END) as recently_accessed_tables,
        SUM(CASE WHEN days_since_access_clean <= 7 THEN 1 ELSE 0 END) as very_recently_accessed_tables,
        SUM(CASE WHEN days_since_access_clean > 90 THEN 1 ELSE 0 END) as stale_tables,
        SUM(CASE WHEN days_since_access_clean > 365 THEN 1 ELSE 0 END) as very_stale_tables,

        -- Query activity metrics (for reporting only, not scoring)
        SUM(queries_clean) as total_monthly_queries,
        AVG(queries_clean) as avg_queries_per_table,
        SUM(CASE WHEN queries_clean = 0 THEN 1 ELSE 0 END) as zero_query_tables,
        SUM(CASE WHEN queries_clean > 100 THEN 1 ELSE 0 END) as high_query_tables,

        -- User engagement metrics
        SUM(users_clean) as total_unique_users,
        AVG(users_clean) as avg_users_per_table,
        SUM(CASE WHEN users_clean = 0 THEN 1 ELSE 0 END) as zero_user_tables,

        -- Cost metrics (for reporting only, not scoring)
        SUM(monthly_cost_usd) as total_monthly_cost,
        SUM(CASE WHEN access_staleness_score < 7 THEN monthly_cost_usd ELSE 0 END) as justified_monthly_cost,
        SUM(CASE WHEN access_staleness_score > 7 THEN monthly_cost_usd ELSE 0 END) as waste_monthly_cost,

        -- Refresh waste metrics
        SUM(CASE
            WHEN LAST_REFRESHED_DATE > LAST_ACCESSED_DATE
            AND days_since_access_clean > 30
            THEN 1 ELSE 0
        END) as refresh_waste_tables,

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
        -- =====================================================
        -- COMPONENT 1: Utilization Rate (40% weight)
        -- Active tables as percentage of total
        -- =====================================================
        ROUND((active_tables * 100.0 / NULLIF(total_tables, 0)), 2) as utilization_rate,

        -- =====================================================
        -- COMPONENT 2: Storage Efficiency (35% weight)
        -- Active storage as percentage of total
        -- =====================================================
        ROUND((active_storage_gb * 100.0 / NULLIF(total_storage_gb, 0)), 2) as storage_efficiency,

        -- =====================================================
        -- COMPONENT 3: Access Freshness (25% weight)
        -- Recently accessed tables as percentage
        -- =====================================================
        ROUND((recently_accessed_tables * 100.0 / NULLIF(total_tables, 0)), 2) as access_freshness,

        -- Additional raw metrics for reporting
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
        waste_monthly_cost,
        refresh_waste_tables

    FROM utilization_metrics
)
SELECT
    -- =====================================================
    -- FINAL HEALTH SCORE CALCULATION (SIMPLIFIED)
    -- Based on 3 core components with redistributed weights
    -- =====================================================
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

    -- Component Scores (only the 3 used in calculation)
    utilization_rate,
    storage_efficiency,
    access_freshness,

    -- Key Metrics
    total_tables,
    active_tables,
    inactive_tables,
    ROUND((inactive_tables * 100.0 / NULLIF(total_tables, 0)), 1) as inactive_percentage,

    -- Storage Metrics
    ROUND(total_storage_gb / 1024, 2) as total_storage_tb,
    ROUND(active_storage_gb / 1024, 2) as active_storage_tb,
    ROUND(waste_storage_gb / 1024, 2) as waste_storage_tb,
    ROUND((waste_storage_gb * 100.0 / NULLIF(total_storage_gb, 0)), 1) as waste_percentage,

    -- Cost Metrics (for reporting, not used in score)
    ROUND(total_monthly_cost, 2) as total_monthly_cost_usd,
    ROUND(waste_monthly_cost, 2) as monthly_savings_opportunity_usd,
    ROUND(waste_monthly_cost * 12, 2) as annual_savings_opportunity_usd,
    ROUND((waste_monthly_cost * 100.0 / NULLIF(total_monthly_cost, 0)), 1) as cost_waste_percentage,

    -- Problem Indicators
    zombie_tables,
    ROUND((zombie_tables * 100.0 / NULLIF(total_tables, 0)), 1) as zombie_percentage,
    refresh_waste_tables,
    ROUND((refresh_waste_tables * 100.0 / NULLIF(total_tables, 0)), 1) as refresh_waste_percentage,
    stale_tables,
    ROUND((stale_tables * 100.0 / NULLIF(total_tables, 0)), 1) as stale_percentage,

    -- Activity Metrics (for reporting, not used in score)
    total_monthly_queries,
    ROUND(avg_queries_per_table, 1) as avg_queries_per_table,
    zero_query_tables,
    ROUND((zero_query_tables * 100.0 / NULLIF(total_tables, 0)), 1) as zero_query_percentage,

    -- User Metrics
    total_unique_users,
    ROUND(avg_users_per_table, 1) as avg_users_per_table,
    zero_user_tables,
    ROUND((zero_user_tables * 100.0 / NULLIF(total_tables, 0)), 1) as zero_user_percentage,

    -- Timestamp
    CURRENT_TIMESTAMP as calculated_at

FROM component_scores;

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================

-- 1. Get current health score and status
SELECT
    health_score,
    health_status,
    CONCAT(utilization_rate, '%') as utilization,
    CONCAT(storage_efficiency, '%') as storage_eff,
    CONCAT(access_freshness, '%') as freshness,
    CONCAT('$', FORMAT(monthly_savings_opportunity_usd, 0)) as monthly_savings
FROM v_datalake_health_metrics;

-- 2. Get detailed breakdown
SELECT
    health_score,
    health_status,
    CONCAT('Tables: ', active_tables, ' / ', total_tables) as table_utilization,
    CONCAT('Storage: ', ROUND(active_storage_tb, 1), ' / ', ROUND(total_storage_tb, 1), ' TB') as storage_utilization,
    CONCAT('Waste: ', ROUND(waste_storage_tb, 1), ' TB (', waste_percentage, '%)') as waste_summary,
    CONCAT('Zombies: ', zombie_tables, ' (', zombie_percentage, '%)') as zombie_summary,
    CONCAT('Monthly Savings: $', FORMAT(monthly_savings_opportunity_usd, 0)) as savings_opportunity
FROM v_datalake_health_metrics;

-- 3. Get component scores for debugging (simplified to 3 components)
SELECT
    health_score as overall_score,
    CONCAT(utilization_rate, '% × 0.40 = ', ROUND(utilization_rate * 0.40, 1)) as utilization_contribution,
    CONCAT(storage_efficiency, '% × 0.35 = ', ROUND(storage_efficiency * 0.35, 1)) as storage_contribution,
    CONCAT(access_freshness, '% × 0.25 = ', ROUND(access_freshness * 0.25, 1)) as freshness_contribution
FROM v_datalake_health_metrics;

-- 4. Create historical tracking table
CREATE TABLE IF NOT EXISTS fact_health_score_history (
    snapshot_date DATE PRIMARY KEY,
    health_score DECIMAL(5,1),
    health_status VARCHAR(20),
    utilization_rate DECIMAL(5,2),
    storage_efficiency DECIMAL(5,2),
    access_freshness DECIMAL(5,2),
    total_tables INT,
    active_tables INT,
    total_storage_tb DECIMAL(10,2),
    waste_storage_tb DECIMAL(10,2),
    monthly_savings_usd DECIMAL(12,2),
    zombie_tables INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
