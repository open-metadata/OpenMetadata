import logging
import time
import requests
from config import OM_URL, JWT_TOKEN, DRY_RUN

logger = logging.getLogger("FinOpsAgent")

def get_headers():
    return {
        "Authorization": f"Bearer {JWT_TOKEN}",
        "Content-Type": "application/json"
    }

def request_with_retry(method, url, **kwargs):
    """Executes HTTP requests with basic exponential backoff."""
    max_retries = 3
    backoff = 1
    for attempt in range(max_retries):
        try:
            res = requests.request(method, url, **kwargs)
            res.raise_for_status()
            return res
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(backoff)
            backoff *= 2
    return None

def fetch_all_tables():
    """Fetches all tables using pagination with robust retry."""
    tables = []
    after = None
    
    while True:
        params = {"fields": "usageSummary,tags,description", "limit": 100}
        if after:
            params["after"] = after
            
        try:
            res = request_with_retry("GET", f"{OM_URL}/tables", headers=get_headers(), params=params, timeout=10)
            data = res.json()
            tables.extend(data.get("data", []))
            
            after = data.get("paging", {}).get("after")
            if not after:
                break
        except Exception as e:
            logger.error(f"API failure fetching tables: {e}")
            break
            
    return tables

def fetch_lineage(table_id):
    """Fetches upstream lineage for a table."""
    try:
        res = request_with_retry("GET", f"{OM_URL}/lineage/table/{table_id}", 
            headers=get_headers(), params={"upstreamDepth": 1, "downstreamDepth": 0}, timeout=10)
        return res.json().get("upstreamEdges", [])
    except Exception as e:
        logger.error(f"API failure fetching lineage for {table_id}: {e}")
    return []

def apply_zombie_tag(table_id, current_tags, has_description, description_update, current_version):
    """Applies FinOps tag and updates description via JSON PATCH (RFC 6902)."""
    if DRY_RUN:
        logger.info(f"[DRY-RUN] Skipping patch for {table_id}")
        return True

    patch_ops = []
    if current_tags is None or len(current_tags) == 0:
        patch_ops.append({"op": "add", "path": "/tags", "value": [{"tagFQN": "FinOps.Zombie"}]})
    else:
        # Check if tag already exists (idempotency)
        if any(isinstance(t, dict) and t.get("tagFQN") == "FinOps.Zombie" for t in current_tags):
            return True
        patch_ops.append({"op": "add", "path": "/tags/-", "value": {"tagFQN": "FinOps.Zombie"}})
        
    # Add or replace description
    if has_description:
        patch_ops.append({"op": "replace", "path": "/description", "value": description_update})
    else:
        patch_ops.append({"op": "add", "path": "/description", "value": description_update})
    
    headers = get_headers()
    headers["Content-Type"] = "application/json-patch+json"
    
    try:
        res = request_with_retry("PATCH", f"{OM_URL}/tables/{table_id}", headers=headers, json=patch_ops, timeout=10)
        res.raise_for_status()
        return True
    except Exception as e:
        # Re-fetch and check if concurrently updated
        try:
            get_res = request_with_retry("GET", f"{OM_URL}/tables/{table_id}?fields=tags", headers=get_headers(), timeout=10)
            latest_tags = get_res.json().get("tags", [])
            if any(isinstance(t, dict) and t.get("tagFQN") == "FinOps.Zombie" for t in latest_tags):
                return True
        except:
            pass
        logger.error(f"API failure patching table {table_id}: {e}")
        return False
