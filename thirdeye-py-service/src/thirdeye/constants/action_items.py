"""
Action Item Categories and Query Mappings
"""
from typing import TypedDict, List


class ActionItemCategory(TypedDict):
    id: str
    title: str
    description: str
    subtitle: str
    icon: str
    color: str
    category: str
    priority: str
    action: str
    query: str


ACTION_ITEM_CATEGORIES: List[ActionItemCategory] = [
    {
        "id": "safe_to_purge",
        "title": "Safe to Purge",
        "description": "Tables Ready for Deletion",
        "subtitle": "Risk Level: Low",
        "icon": "trash-2",
        "color": "green",
        "category": "table",
        "priority": "high",
        "action": "DELETE",
        "query": "SELECT COUNT(*) as count, SUM(COALESCE(monthly_cost_usd, 0)) as cost FROM v_table_purge_scores WHERE purge_score >= 9"
    },
    {
        "id": "convert_to_transient",
        "title": "Convert to Transient",
        "description": "Snowflake Transient Tables",
        "subtitle": "Risk Level: Medium",
        "icon": "clock",
        "color": "yellow",
        "category": "table",
        "priority": "medium",
        "action": "CONVERT_TRANSIENT",
        "query": "SELECT COUNT(*) as count, SUM(COALESCE(monthly_cost_usd, 0)) as cost FROM v_table_purge_scores WHERE purge_score >= 8 AND purge_score < 9"
    },
    {
        "id": "review_required",
        "title": "Review Required",
        "description": "Manual Review Needed",
        "subtitle": "Risk Level: Medium",
        "icon": "eye",
        "color": "orange",
        "category": "table",
        "priority": "medium",
        "action": "REVIEW",
        "query": "SELECT COUNT(*) as count, SUM(COALESCE(monthly_cost_usd, 0)) as cost FROM v_table_purge_scores WHERE purge_score >= 7 AND purge_score < 8"
    },
    {
        "id": "most_expensive",
        "title": "Most Expensive Tables",
        "description": "Top 10 by Storage Cost",
        "subtitle": "Highest Impact Optimization",
        "icon": "dollar-sign",
        "color": "red",
        "category": "table",
        "priority": "high",
        "action": "OPTIMIZE",
        "query": "SELECT 10 as count, SUM(COALESCE(monthly_cost_usd, 0)) as cost FROM (SELECT monthly_cost_usd FROM v_table_purge_scores ORDER BY monthly_cost_usd DESC LIMIT 10) as top_tables"
    },
    {
        "id": "zombie_tables",
        "title": "Zombie Tables",
        "description": "Zero Activity Tables",
        "subtitle": "No Queries or Users",
        "icon": "ghost",
        "color": "purple",
        "category": "table",
        "priority": "high",
        "action": "INVESTIGATE",
        "query": "SELECT COUNT(*) as count, SUM(COALESCE(monthly_cost_usd, 0)) as cost FROM v_table_purge_scores WHERE COALESCE(ROLL_30D_TBL_QC, 0) = 0 AND COALESCE(ROLL_30D_TBL_UC, 0) = 0 AND COALESCE(days_since_access, 9999) > 90"
    },
    {
        "id": "refresh_waste",
        "title": "Refresh Waste",
        "description": "Unnecessary ETL Jobs",
        "subtitle": "Refreshed but Unused",
        "icon": "refresh-cw",
        "color": "blue",
        "category": "table",
        "priority": "medium",
        "action": "STOP_REFRESH",
        "query": "SELECT COUNT(*) as count, SUM(COALESCE(monthly_cost_usd, 0)) as cost FROM v_table_purge_scores WHERE LAST_REFRESHED_DATE > LAST_ACCESSED_DATE AND COALESCE(days_since_access, 9999) > 30"
    },
    {
        "id": "large_unused",
        "title": "Large Unused Tables",
        "description": "High Storage, Low Usage",
        "subtitle": "Size > 100GB, Rarely Used",
        "icon": "hard-drive",
        "color": "indigo",
        "category": "table",
        "priority": "high",
        "action": "ARCHIVE",
        "query": "SELECT COUNT(*) as count, SUM(COALESCE(monthly_cost_usd, 0)) as cost FROM v_table_purge_scores WHERE COALESCE(SIZE_GB, 0) > 100 AND COALESCE(days_since_access, 9999) > 60"
    },
    {
        "id": "stale_tables",
        "title": "Stale Tables",
        "description": "Not Accessed Recently",
        "subtitle": "90+ Days Since Access",
        "icon": "calendar-x",
        "color": "gray",
        "category": "table",
        "priority": "low",
        "action": "REVIEW_ACCESS",
        "query": "SELECT COUNT(*) as count, SUM(COALESCE(monthly_cost_usd, 0)) as cost FROM v_table_purge_scores WHERE COALESCE(days_since_access, 9999) > 90"
    },
    {
        "id": "automated_queries",
        "title": "Automated Queries",
        "description": "High Queries, Few Users",
        "subtitle": "Potential ETL Optimization",
        "icon": "cpu",
        "color": "cyan",
        "category": "table",
        "priority": "medium",
        "action": "OPTIMIZE_ETL",
        "query": "SELECT COUNT(*) as count, SUM(COALESCE(monthly_cost_usd, 0)) as cost FROM v_table_purge_scores WHERE COALESCE(ROLL_30D_TBL_QC, 0) > 1000 AND COALESCE(ROLL_30D_TBL_UC, 0) < 3"
    }
]


# Query mappings for detailed table reports
class QueryMapping(TypedDict):
    whereClause: str
    orderClause: str


ACTION_ITEM_QUERY_MAPPINGS: dict[str, QueryMapping] = {
    "safe_to_purge": {
        "whereClause": "WHERE purge_score >= 9",
        "orderClause": "ORDER BY purge_score DESC, monthly_cost_usd DESC"
    },
    "convert_to_transient": {
        "whereClause": "WHERE purge_score >= 8 AND purge_score < 9",
        "orderClause": "ORDER BY purge_score DESC, monthly_cost_usd DESC"
    },
    "review_required": {
        "whereClause": "WHERE purge_score >= 7 AND purge_score < 8",
        "orderClause": "ORDER BY purge_score DESC, monthly_cost_usd DESC"
    },
    "most_expensive": {
        "whereClause": "WHERE FQN IN (SELECT FQN FROM v_table_purge_scores WHERE monthly_cost_usd > 0 ORDER BY monthly_cost_usd DESC LIMIT 10)",
        "orderClause": "ORDER BY monthly_cost_usd DESC"
    },
    "zombie_tables": {
        "whereClause": "WHERE COALESCE(ROLL_30D_TBL_QC, 0) = 0 AND COALESCE(ROLL_30D_TBL_UC, 0) = 0 AND COALESCE(days_since_access, 9999) > 90",
        "orderClause": "ORDER BY days_since_access DESC, SIZE_GB DESC"
    },
    "refresh_waste": {
        "whereClause": "WHERE LAST_REFRESHED_DATE > LAST_ACCESSED_DATE AND COALESCE(days_since_access, 9999) > 30",
        "orderClause": "ORDER BY days_since_access DESC, monthly_cost_usd DESC"
    },
    "large_unused": {
        "whereClause": "WHERE COALESCE(SIZE_GB, 0) > 100 AND COALESCE(days_since_access, 9999) > 60",
        "orderClause": "ORDER BY SIZE_GB DESC, days_since_access DESC"
    },
    "stale_tables": {
        "whereClause": "WHERE COALESCE(days_since_access, 9999) > 90",
        "orderClause": "ORDER BY days_since_access DESC, SIZE_GB DESC"
    },
    "automated_queries": {
        "whereClause": "WHERE COALESCE(ROLL_30D_TBL_QC, 0) > 1000 AND COALESCE(ROLL_30D_TBL_UC, 0) < 3",
        "orderClause": "ORDER BY ROLL_30D_TBL_QC DESC, monthly_cost_usd DESC"
    }
}


# Summary tile configuration
SUMMARY_TILE_CONFIG = {
    "id": "cost_savings_summary",
    "title": "Potential Savings",
    "description": "Monthly Cost Reduction",
    "subtitle": "Total Optimization Impact",
    "icon": "trending-down",
    "color": "emerald",
    "category": "summary",
    "priority": "info",
    "action": "CALCULATE_SAVINGS",
    "query": """
        SELECT SUM(COALESCE(monthly_cost_usd, 0)) as total_savings 
        FROM v_table_purge_scores 
        WHERE purge_score >= 8 
           OR (COALESCE(ROLL_30D_TBL_QC, 0) = 0 AND COALESCE(ROLL_30D_TBL_UC, 0) = 0 AND COALESCE(days_since_access, 9999) > 90)
           OR (LAST_REFRESHED_DATE > LAST_ACCESSED_DATE AND COALESCE(days_since_access, 9999) > 30)
    """
}

