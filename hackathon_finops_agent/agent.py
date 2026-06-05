import logging
import time
import os
from config import DRY_RUN, COST_PER_TABLE
from client import fetch_all_tables, fetch_downstream_lineage, apply_state, ensure_custom_property
from evaluator import evaluate_table

logger = logging.getLogger("FinOpsAgent")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    formatter = logging.Formatter('%(message)s')
    ch.setFormatter(formatter)
    logger.addHandler(ch)

def calculate_monthly_waste(table):
    """Calculate waste based on table size (assuming $23/TB/mo S3 standard + $20 compute overhead)"""
    size_bytes = 0
    profile = table.get("profile")
    if profile and isinstance(profile, dict):
        size_bytes = profile.get("sizeInByte", 0)
        
    if size_bytes > 0:
        tb = size_bytes / (1024**4)
        return round((tb * 23.0) + 20.0, 2)
    return float(COST_PER_TABLE) # Configured fallback estimate

def run():
    logger.info("[START] Autonomous FinOps Agent Running...")
    
    # Attempt to bootstrap custom properties for the "Flex"
    ensure_custom_property()
    
    tables = fetch_all_tables()
    
    scanned = 0
    actions = 0
    zombies = 0
    warnings = 0
    under_reviews = 0
    total_waste_found = 0.0
    
    # Calculate current time once for consistency across the run
    time_shift_days = int(os.getenv("DEMO_TIME_SHIFT_DAYS", "0"))
    now_ms = int(time.time() * 1000) + (time_shift_days * 86400000)
    
    for table in tables:
        scanned += 1
        name = table.get("name", "unknown")
        fqn = table.get("fullyQualifiedName")
        table_id = table.get("id")
        version = table.get("version")
        current_description = table.get("description", "")
        
        if not table_id: 
            continue
            
        downstream_edges = fetch_downstream_lineage(table_id)
        has_downstream = isinstance(downstream_edges, list) and len(downstream_edges) > 0
        
        # Calculate age robustly to avoid the state progression bug
        updated_at = table.get("updatedAt")
        ext = table.get("extension", {})
        
        has_base_time = False
        if ext and "finopsFlaggedAt" in ext:
            try:
                base_time = int(ext["finopsFlaggedAt"])
                has_base_time = True
            except ValueError:
                base_time = updated_at
        else:
            base_time = updated_at

        if not base_time:
            logger.info(f"[SKIP] {name} (Missing timing metadata)")
            continue
            
        age_days = int((now_ms - base_time) / 86400000)
        
        # Extract usage safely
        usage_count = None
        usage_summary = table.get("usageSummary")
        if usage_summary and isinstance(usage_summary, dict):
            monthly_stats = usage_summary.get("monthlyStats")
            if monthly_stats and isinstance(monthly_stats, dict):
                usage_count = monthly_stats.get("count")
                
        waste_usd = calculate_monthly_waste(table)
        
        current_tags = [t.get("tagFQN") for t in table.get("tags", []) if isinstance(t, dict)]
        
        state, reason = evaluate_table(usage_count, age_days, has_downstream, current_tags)
        
        if not state:
            logger.info(f"[SKIP] {name} ({reason})")
            continue
            
        logger.info(f"[{state}] Detected: {name} - {reason} (Waste: ${waste_usd:.2f})")
        
        if state == "ZOMBIE": 
            zombies += 1
            total_waste_found += waste_usd
        elif state == "WARNING": 
            warnings += 1
            total_waste_found += waste_usd
        elif state == "UNDER_REVIEW": 
            under_reviews += 1
            
        ai_insight = ""
        if state == "ZOMBIE" and not DRY_RUN:
            from gemini_helper import get_ai_deprecation_insight
            ai_insight = get_ai_deprecation_insight(name, waste_usd, age_days)
            
        if not DRY_RUN:
            success = apply_state(
                table_id, name, table.get("tags"), state, version, 
                current_description, fqn, waste_usd, ai_insight, 
                base_time, has_base_time
            )
            if success:
                actions += 1
                logger.info(f"  └─> [SUCCESS] Applied {state} state to {name}")
            else:
                logger.info(f"  └─> [FAILED] Could not apply state to {name}")
                
    logger.info("\n=== FINOPS REPORT ===")
    logger.info(f"Tables Scanned : {scanned}")
    logger.info(f"Actions Taken  : {actions}")
    logger.info(f"Zombies Found  : {zombies}")
    logger.info(f"Warnings Issued: {warnings}")
    logger.info(f"Under Review   : {under_reviews}")
    logger.info(f"Total Estimated Monthly Waste Identified: ${total_waste_found:.2f}")

if __name__ == "__main__":
    run()
