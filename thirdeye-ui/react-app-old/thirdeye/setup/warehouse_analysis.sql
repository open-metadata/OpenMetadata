-- "Identify Ghost Warehouses - Active but Completely Unused"
-- This query detects warehouses that are consuming credits (costing money) but have zero query activity, indicating they're running idle without serving any business purpose. These are "ghost" warehouses that are active in the system but abandoned by users.

-- Immediate Suspension: Any warehouse with credits > 0 and queries = 0
-- No Review Needed: These have zero queries, so no users will be impacted
-- Quick Win: Easiest optimization with guaranteed savings and zero risk

SELECT
    m.warehouse_name,
    SUM(m.credits_used) as wasted_credits_30d,
    ROUND(SUM(m.credits_used) * 3.00, 2) as wasted_dollars,
    COUNT(DISTINCT DATE(m.start_time)) as active_days,
    MAX(q.start_time) as last_query_executed,
    COUNT(q.query_id) as query_count
FROM snowflake.account_usage.warehouse_metering_history m
         LEFT JOIN snowflake.account_usage.query_history q
                   ON m.warehouse_name = q.warehouse_name
                       AND q.start_time >= DATEADD(day, -7, CURRENT_TIMESTAMP())
WHERE m.start_time >= DATEADD(day, -7, CURRENT_TIMESTAMP())
GROUP BY m.warehouse_name;

-- -------------------------------------------------
-- HAVING SUM(m.credits_used) > 0  -- Used credits
--   AND COUNT(q.query_id) = 0    -- But no queries
--   ORDER BY wasted_credits_30d DESC;