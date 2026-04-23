import time
from config import ZOMBIE_TAG, GRACE_PERIOD_DAYS

def is_zombie(table, has_upstream):
    """
    Evaluates zombie conditions safely:
    1. monthlyCount == 0
    2. Table has upstream lineage (derived table)
    3. Table is older than GRACE_PERIOD_DAYS
    4. Table is NOT already tagged with FinOps.Zombie
    """
    try:
        if not isinstance(table, dict):
            return False, "Malformed table payload (not a dict)"

        # 4. Check if already tagged (Idempotency check)
        tags = table.get("tags", [])
        if isinstance(tags, list) and any(isinstance(t, dict) and t.get("tagFQN") == ZOMBIE_TAG for t in tags):
            return False, f"Already tagged with {ZOMBIE_TAG}"

        # 1. Check usage safely
        usage_summary = table.get("usageSummary")
        if not usage_summary or not isinstance(usage_summary, dict):
            return False, "Missing usageSummary"
            
        monthly_stats = usage_summary.get("monthlyStats")
        if not monthly_stats or not isinstance(monthly_stats, dict):
            return False, "Missing monthlyStats"
            
        count = monthly_stats.get("count")
        if count is None or count != 0:
            return False, f"Has usage (count = {count})"
            
        # 3. Check age (> GRACE_PERIOD_DAYS)
        updated_at = table.get("updatedAt")
        if not isinstance(updated_at, (int, float)):
            return False, "Missing or invalid updatedAt"
            
        now_ms = int(time.time() * 1000)
        day_ms = 86400000
        
        if (now_ms - updated_at) <= (GRACE_PERIOD_DAYS * day_ms):
            return False, f"Recently created/updated (<= {GRACE_PERIOD_DAYS} days)"

        # 2. Check lineage
        if not has_upstream:
            return False, "No upstream lineage"

        return True, "All zombie criteria met"
    except Exception as e:
        return False, f"Evaluation error: {e}"