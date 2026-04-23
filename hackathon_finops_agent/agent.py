import logging
from config import DRY_RUN, COST_PER_TABLE
from client import fetch_all_tables, fetch_lineage, apply_zombie_tag
from evaluator import is_zombie

# Ensure logging is set up cleanly for the agent run
logger = logging.getLogger("FinOpsAgent")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    formatter = logging.Formatter('%(message)s')
    ch.setFormatter(formatter)
    logger.addHandler(ch)

def run():
    logger.info("[START] Fetching tables from OpenMetadata...")
    tables = fetch_all_tables()
    
    scanned = 0
    zombies = 0
    
    for table in tables:
        scanned += 1
        name = table.get("name", "unknown")
        table_id = table.get("id")
        version = table.get("version")
        has_description = "description" in table and table.get("description") is not None
        
        if not table_id:
            logger.info(f"[SKIP] {name} (Reason: Missing ID)")
            continue
            
        logger.info(f"[SCAN] {name}")
        
        # Determine upstream lineage safely
        upstream_edges = fetch_lineage(table_id)
        has_upstream = isinstance(upstream_edges, list) and len(upstream_edges) > 0
        
        # Evaluate safely using correct Zombie Logic
        is_zomb, reason = is_zombie(table, has_upstream)
        
        if not is_zomb:
            logger.info(f"[SKIP] {reason}")
            continue
            
        logger.info(f"[ZOMBIE] detected: {name}")
        zombies += 1
        
        # Construct explainable description
        description_update = (
            "⚠️ Zombie Table Detected:\n"
            "- 0 usage in monthly stats\n"
            "- Has upstream lineage (derived compute cost)\n"
            "- Identified by FinOps Agent"
        )
        
        if DRY_RUN:
            logger.info(f"[DRY-RUN] Would tag {name}")
        else:
            success = apply_zombie_tag(table_id, table.get("tags"), has_description, description_update, version)
            if success:
                logger.info("[ACTION] Tag applied successfully")
            else:
                logger.info("[ACTION] Patch failed (API Error or Conflict)")
                
    savings = zombies * COST_PER_TABLE
    logger.info("")
    logger.info(f"[SUMMARY] Tables scanned: {scanned}")
    logger.info(f"[SUMMARY] Zombies found: {zombies}")
    logger.info(f"[SUMMARY] Savings: ${savings:.2f}/month")

if __name__ == "__main__":
    run()