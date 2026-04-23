import requests
import time
from config import OM_URL, JWT_TOKEN

def get_headers():
    return {
        "Authorization": f"Bearer {JWT_TOKEN}",
        "Content-Type": "application/json"
    }

def create_classification():
    """Create FinOps classification if it doesn't exist."""
    payload = {
        "name": "FinOps",
        "displayName": "FinOps",
        "description": "FinOps related tags"
    }
    res = requests.post(f"{OM_URL}/classifications", headers=get_headers(), json=payload)
    if res.status_code in (200, 201):
        print("✅ Created FinOps classification.")
    elif res.status_code == 409:
        print("ℹ️ FinOps classification already exists.")
    else:
        print(f"❌ Error creating classification: {res.text}")

def create_tag():
    """Create FinOps.Zombie tag if it doesn't exist."""
    payload = {
        "name": "Zombie",
        "classification": "FinOps",
        "description": "Unused table wasting resources"
    }
    res = requests.post(f"{OM_URL}/tags", headers=get_headers(), json=payload)
    if res.status_code in (200, 201):
        print("✅ Created FinOps.Zombie tag.")
    elif res.status_code == 409:
        print("ℹ️ FinOps.Zombie tag already exists.")
    else:
        print(f"❌ Error creating tag: {res.text}")

def create_table(name, schema_fqn):
    payload = {
        "name": name,
        "databaseSchema": schema_fqn,
        "columns": [{"name": "id", "dataType": "INT"}]
    }
    res = requests.post(f"{OM_URL}/tables", headers=get_headers(), json=payload)
    if res.status_code in (200, 201):
        return res.json()["id"]
    elif res.status_code == 409:
        res = requests.get(f"{OM_URL}/tables/name/{schema_fqn}.{name}", headers=get_headers())
        if res.status_code == 200:
            return res.json()["id"]
    print(f"Error creating {name}: {res.text}")
    return None

def add_usage(table_id, count, days_ago=0):
    past_date = time.strftime("%Y-%m-%d", time.localtime(time.time() - days_ago*86400))
    payload = {
        "date": past_date,
        "count": count
    }
    requests.post(f"{OM_URL}/usage/table/{table_id}", headers=get_headers(), json=payload)

def add_lineage(from_id, to_id):
    payload = {
        "edge": {
            "fromEntity": {"id": from_id, "type": "table"},
            "toEntity": {"id": to_id, "type": "table"}
        }
    }
    requests.put(f"{OM_URL}/lineage", headers=get_headers(), json=payload)

def verify_usage_rollup(table_id, expected_usage):
    """Wait for usage data to roll up in OpenMetadata."""
    print("Waiting for usage data to roll up (max 30s)...")
    for _ in range(15):
        time.sleep(2)
        res = requests.get(f"{OM_URL}/tables/{table_id}?fields=usageSummary", headers=get_headers())
        if res.status_code == 200:
            stats = res.json().get("usageSummary", {}).get("monthlyStats", {})
            if stats.get("count", 0) >= expected_usage:
                print("Usage data successfully rolled up!")
                return True
    print("Warning: Usage data rollup timed out.")
    return False

def seed():
    print("Running Seeder Script for FinOps Demo...")
    
    create_classification()
    create_tag()
    
    schema_fqn = "sample_data.ecommerce_db.shopify"
    
    # Deterministic structure: 2 Healthy Tables, 3 Zombie Tables
    tables = [
        {"name": "finops_healthy_table_1", "usage": 150},
        {"name": "finops_healthy_table_2", "usage": 200},
        {"name": "finops_zombie_table_1", "usage": 0},
        {"name": "finops_zombie_table_2", "usage": 0},
        {"name": "finops_zombie_table_3", "usage": 0}
    ]
    
    ids = {}
    for t in tables:
        tid = create_table(t["name"], schema_fqn)
        if tid:
            ids[t["name"]] = tid
            # Inject usage explicitly across two consecutive days to guarantee it propagates to monthlyStats
            add_usage(tid, t["usage"], days_ago=0)
            add_usage(tid, t["usage"], days_ago=1)
            print(f"✅ Created/Updated {t['name']} with {t['usage']} usage.")
            
    # Add lineage: healthy -> zombie to satisfy the upstream dependency rule
    healthy_source = "finops_healthy_table_1"
    if healthy_source in ids:
        for i in range(1, 4):
            zombie_name = f"finops_zombie_table_{i}"
            if zombie_name in ids:
                add_lineage(ids[healthy_source], ids[zombie_name])
                print(f"✅ Added lineage to {zombie_name}")

    if healthy_source in ids:
        verify_usage_rollup(ids[healthy_source], 150)

    print("\nSeeding Complete! 🎉")
    print("Verify in OpenMetadata UI that usage and lineage are visible.")

if __name__ == "__main__":
    seed()
