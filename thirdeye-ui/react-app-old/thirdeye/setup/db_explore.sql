select count(*) from fact_datalake_table_usage_inventory


select fqn, count(*) from fact_datalake_table_usage_inventory
group by 1
order by 2 desc

delete from fact_datalake_table_usage_inventory;
commit;


select * from fact_datalake_table_usage_inventory;

LOAD DATA LOCAL INFILE '/Users/rsharma5/Downloads/snowflake_table_usage_creation_1.csv'
INTO TABLE fact_datalake_table_usage_inventory
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\\n'
IGNORE 1 ROWS
(DATABASE_NAME, DB_SCHEMA, TABLE_NAME, TABLE_TYPE, ROLL_30D_TBL_UC, 
ROLL_30D_SCHEMA_UC, ROLL_30D_DB_UC, ROLL_30D_TBL_QC, CREATE_DATE, 
LAST_ACCESSED_DATE, LAST_REFRESHED_DATE, SIZE_GB, RUN_DATE, START_DATE, 
END_DATE, ROLL_30D_START_DATE, SERVICE, CREATED_BY);

--


CREATE VIEW v_optimization_report AS
SELECT 
    o.opportunity_id,
    o.fqn,
    o.service,
    o.resource_type,
    o.opportunity_type,
    o.detection_date,
    o.current_monthly_cost,
    o.projected_savings,
    o.priority,
    o.status,
    
    -- Current metrics from fact table
    f.ROLL_30D_TBL_QC as queries_30d,
    f.ROLL_30D_TBL_UC as users_30d,
    f.SIZE_GB as storage_gb,
    f.LAST_ACCESSED_DATE,
    DATEDIFF(CURRENT_DATE, f.LAST_ACCESSED_DATE) as days_inactive,
    
    -- Decision if exists
    d.final_decision,
    d.decision_date,
    d.created_by as decided_by,
    
    -- Savings if realized
    ct.cumulative_savings
    
FROM optimization_opportunities o
LEFT JOIN fact_datalake_table_usage_inventory f 
    ON o.fqn = f.FQN 
    AND f.RUN_DATE = (SELECT MAX(RUN_DATE) FROM fact_datalake_table_usage_inventory WHERE FQN = o.fqn)
LEFT JOIN entity_decisions d 
    ON o.decision_id = d.decision_id
LEFT JOIN (
    SELECT decision_id, MAX(cumulative_savings) as cumulative_savings
    FROM cost_tracking
    GROUP BY decision_id
) ct ON d.decision_id = ct.decision_id
WHERE o.status IN ('OPEN', 'IN_REVIEW');



CREATE VIEW v_savings_summary AS
SELECT 
    DATE_FORMAT(d.decision_date, '%Y-%m') as month,
    d.service,
    COUNT(DISTINCT d.decision_id) as decisions_made,
    COUNT(DISTINCT CASE WHEN d.final_decision = 'DELETE' THEN d.decision_id END) as tables_deleted,
    COUNT(DISTINCT CASE WHEN d.final_decision = 'ARCHIVE' THEN d.decision_id END) as tables_archived,
    
    SUM(o.projected_savings) as projected_monthly_savings,
    SUM(ct.realized_savings) as realized_monthly_savings,
    SUM(ct.cumulative_savings) as cumulative_savings_to_date
    
FROM entity_decisions d
JOIN optimization_opportunities o ON d.decision_id = o.decision_id
LEFT JOIN (
    SELECT 
        decision_id,
        SUM(realized_savings) as realized_savings,
        MAX(cumulative_savings) as cumulative_savings
    FROM cost_tracking
    WHERE measurement_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
    GROUP BY decision_id
) ct ON d.decision_id = ct.decision_id
GROUP BY 1, 2;


-- Create notifications for high-priority items
INSERT INTO notifications (opportunity_id, title, message, notification_type, priority, user_id)
SELECT 
    o.opportunity_id,
    CONCAT('Action Required: ', o.opportunity_type, ' - ', 
           SUBSTRING_INDEX(o.fqn, '-', -1)) as title,
    CONCAT('Table has not been accessed for ', 
           DATEDIFF(CURRENT_DATE, f.LAST_ACCESSED_DATE), 
           ' days. Monthly cost: $', ROUND(o.current_monthly_cost, 2),
           '. Potential savings: $', ROUND(o.projected_savings, 2)) as message,
    'COST_ALERT' as notification_type,
    o.priority,
    f.CREATED_BY as user_id
FROM optimization_opportunities o
JOIN fact_datalake_table_usage_inventory f ON o.fqn = f.FQN
WHERE o.status = 'OPEN'
  AND o.priority = 'HIGH'
  AND o.detection_date = CURRENT_DATE
  AND f.RUN_DATE = CURRENT_DATE;



  -- Run weekly to track savings
INSERT INTO cost_tracking (fqn, decision_id, measurement_date, baseline_cost, current_cost, cumulative_savings, days_since_decision)
SELECT 
    d.fqn,
    d.decision_id,
    CURRENT_DATE as measurement_date,
    baseline.monthly_cost as baseline_cost,
    COALESCE(current.monthly_cost, 0) as current_cost,
    COALESCE(prev.cumulative_savings, 0) + (baseline.monthly_cost - COALESCE(current.monthly_cost, 0)),
    DATEDIFF(CURRENT_DATE, d.decision_date) as days_since_decision
FROM entity_decisions d
-- Get baseline cost from before decision
JOIN (
    SELECT FQN, (SIZE_GB * 5.75 / 1024) * 4.3 as monthly_cost
    FROM fact_datalake_table_usage_inventory
    WHERE (FQN, RUN_DATE) IN (
        SELECT FQN, MAX(RUN_DATE)
        FROM fact_datalake_table_usage_inventory f
        JOIN entity_decisions e ON f.FQN = e.fqn
        WHERE f.RUN_DATE <= e.decision_date
        GROUP BY FQN
    )
) baseline ON d.fqn = baseline.FQN
-- Get current cost (might be 0 if deleted)
LEFT JOIN (
    SELECT FQN, (SIZE_GB * 5.75 / 1024) * 4.3 as monthly_cost
    FROM fact_datalake_table_usage_inventory
    WHERE RUN_DATE = CURRENT_DATE
) current ON d.fqn = current.FQN
-- Get previous cumulative savings
LEFT JOIN (
    SELECT decision_id, MAX(cumulative_savings) as cumulative_savings
    FROM cost_tracking
    GROUP BY decision_id
) prev ON d.decision_id = prev.decision_id
WHERE d.final_decision IN ('DELETE', 'ARCHIVE', 'OPTIMIZE')
  AND d.decision_date < CURRENT_DATE
ON DUPLICATE KEY UPDATE
    current_cost = VALUES(current_cost),
    cumulative_savings = VALUES(cumulative_savings);


