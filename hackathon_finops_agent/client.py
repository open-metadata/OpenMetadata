import logging
import time
import requests
from config import OM_URL, JWT_TOKEN, DRY_RUN, SLACK_WEBHOOK_URL
from config import TAG_UNDER_REVIEW, TAG_WARNING, TAG_ZOMBIE

logger = logging.getLogger("FinOpsAgent")

def get_headers():
    return {"Authorization": f"Bearer {JWT_TOKEN}", "Content-Type": "application/json"}

def request_with_retry(method, url, **kwargs):
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
            logger.warning(f"Request failed ({e}), retrying in {backoff}s...")
            time.sleep(backoff)
            backoff *= 2
    return None

def fetch_all_tables():
    tables = []
    after = None
    while True:
        params = {"fields": "usageSummary,tags,description,owners,version,profile", "limit": 100}
        if after: params["after"] = after
        try:
            res = request_with_retry("GET", f"{OM_URL}/tables", headers=get_headers(), params=params, timeout=10)
            data = res.json()
            tables.extend(data.get("data", []))
            after = data.get("paging", {}).get("after")
            if not after: break
        except requests.exceptions.RequestException as e:
            logger.error(f"API failure fetching tables: {e}")
            break
        except Exception as e:
            logger.error(f"Unexpected error fetching tables: {e}")
            break
    return tables

def fetch_downstream_lineage(table_id):
    try:
        res = request_with_retry("GET", f"{OM_URL}/lineage/table/{table_id}", headers=get_headers(), params={"upstreamDepth": 0, "downstreamDepth": 1}, timeout=10)
        return res.json().get("downstreamEdges", [])
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch lineage for {table_id}: {e}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error fetching lineage: {e}")
        return []

def post_feed(fqn, state, message):
    """Native OpenMetadata Activity Feed Integration"""
    payload = {
        "message": f"**FinOps Agent ({state})**: {message}",
        "about": f"<#E::table::{fqn}>",
        "from": "admin"
    }
    try:
        request_with_retry("POST", f"{OM_URL}/feed", headers=get_headers(), json=payload, timeout=5)
    except requests.exceptions.RequestException as e:
        logger.error(f"Feed post failed: {e}")

def notify_slack(table_name, state, message, waste_usd):
    """External Webhook Integration"""
    if not SLACK_WEBHOOK_URL: return
    payload = {
        "text": f"[FinOps Alert: {state}]\n*Table:* `{table_name}`\n*Status:* {message}\n*Estimated Cost Impact:* ${waste_usd:.2f}/month"
    }
    try:
        requests.post(SLACK_WEBHOOK_URL, json=payload, timeout=5)
    except requests.exceptions.RequestException:
        pass

def ensure_custom_property():
    """Flex: Dynamically injects a FinOps Custom Property to the OM Schema if it doesn't exist"""
    try:
        res = request_with_retry("GET", f"{OM_URL}/metadata/types/name/table", headers=get_headers(), timeout=5)
        table_type = res.json()
        custom_props = table_type.get("customProperties", [])
        if any(p.get("name") == "monthlyWasteUSD" for p in custom_props):
            return True
            
        logger.info("Creating Custom Property 'monthlyWasteUSD'...")
        types_res = request_with_retry("GET", f"{OM_URL}/metadata/types?category=field", headers=get_headers(), timeout=5)
        number_type_id = next((t["id"] for t in types_res.json().get("data", []) if t["name"] == "number"), None)
        
        if not number_type_id:
            logger.warning("Could not find 'number' property type.")
            return False
            
        payload = {
            "name": "monthlyWasteUSD",
            "description": "Estimated monthly waste in USD computed by the FinOps Agent",
            "propertyType": {"id": number_type_id, "type": "type"}
        }
        # In OpenMetadata, you add custom properties via PUT to /metadata/types/{id}
        request_with_retry("PUT", f"{OM_URL}/metadata/types/{table_type['id']}", headers=get_headers(), json=payload, timeout=5)
        return True
    except Exception as e:
        logger.debug(f"Failed to ensure custom property (might lack admin rights or already exists): {e}")
        return False

def apply_state(table_id, table_name, current_tags, state, current_version, has_description, fqn, waste_usd=0.0, ai_insight=""):
    """Applies tags, descriptions, custom properties, feed posts, and slack notifications using Optimistic Locking"""
    if DRY_RUN:
        logger.info(f"[DRY-RUN] Skipping patch for {table_name}")
        return True

    if state == "WARNING":
        tag_to_apply = TAG_WARNING
        desc_msg = f"WARNING: Prolonged 0 usage. Mark exempt or it will be flagged as Zombie. Estimated Waste: ${waste_usd:.2f}/mo."
    elif state == "ZOMBIE":
        tag_to_apply = TAG_ZOMBIE
        desc_msg = f"ZOMBIE TABLE: Cloud waste confirmed. Deprecation pending. Estimated Waste: ${waste_usd:.2f}/mo."
    else: # UNDER_REVIEW
        tag_to_apply = TAG_UNDER_REVIEW
        desc_msg = f"UNDER REVIEW: 0 usage and 0 downstream detected. Estimated Waste: ${waste_usd:.2f}/mo."

    desc_msg += ai_insight

    patch_ops = []
    tags = current_tags or []
    new_tags = [t for t in tags if not str(t.get("tagFQN", "")).startswith("FinOps.")]
    new_tags.append({"tagFQN": tag_to_apply, "labelType": "Automated", "state": "Confirmed", "source": "Classification"})
    
    patch_ops.append({"op": "replace" if current_tags else "add", "path": "/tags", "value": new_tags})
        
    if has_description:
        patch_ops.append({"op": "replace", "path": "/description", "value": desc_msg})
    else:
        patch_ops.append({"op": "add", "path": "/description", "value": desc_msg})
        
    patch_ops.append({"op": "add", "path": "/extension/monthlyWasteUSD", "value": waste_usd})
    
    headers = get_headers()
    headers["Content-Type"] = "application/json-patch+json"
    
    try:
        res = request_with_retry("PATCH", f"{OM_URL}/tables/{table_id}", headers=headers, json=patch_ops, timeout=10)
        
        if fqn:
            post_feed(fqn, state, desc_msg)
        if state in ["WARNING", "ZOMBIE"]:
            notify_slack(table_name, state, desc_msg, waste_usd)
            
        return True
    except requests.exceptions.HTTPError as e:
        if e.response and e.response.status_code == 412:
            logger.warning(f"Concurrency conflict (412 Precondition Failed) for {table_name}. Another user updated this. Skipping.")
        else:
            logger.error(f"API HTTP Error patching {table_name}: {e}")
        return False
    except requests.exceptions.RequestException as e:
        logger.error(f"API failure patching {table_name}: {e}")
        return False
