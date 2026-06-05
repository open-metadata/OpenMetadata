import requests
import time
import math
from config import OM_URL, JWT_TOKEN

def get_headers():
    return {
        "Authorization": f"Bearer {JWT_TOKEN}",
        "Content-Type": "application/json"
    }

def create_classification():
    payload = {"name": "FinOps", "displayName": "FinOps", "description": "FinOps lifecycle tags"}
    res = requests.post(f"{OM_URL}/classifications", headers=get_headers(), json=payload)
    if res.status_code in (200, 201): print("[SUCCESS] Created FinOps Classification.")

def create_tag(name, description):
    payload = {
        "name": name,
        "classification": "FinOps",
        "description": description
    }
    res = requests.post(f"{OM_URL}/tags", headers=get_headers(), json=payload)
    if res.status_code in (200, 201): print(f"[SUCCESS] Created FinOps.{name} tag.")
    elif res.status_code == 409: print(f"[INFO] FinOps.{name} tag already exists.")

def create_table(name, schema_fqn, description):
    payload = {
        "name": name,
        "description": description,
        "databaseSchema": schema_fqn,
        "columns": [
            {"name": "user_id", "dataType": "BIGINT"},
            {"name": "event_timestamp", "dataType": "TIMESTAMP"},
            {"name": "payload", "dataType": "JSON"}
        ]
    }
    res = requests.post(f"{OM_URL}/tables", headers=get_headers(), json=payload)
    if res.status_code in (200, 201): return res.json()["id"]
    elif res.status_code == 409:
        res = requests.get(f"{OM_URL}/tables/name/{schema_fqn}.{name}", headers=get_headers())
        if res.status_code == 200: return res.json()["id"]
    else:
        print(f"Failed to create table {name}: {res.text}")
    return None

def add_usage(table_id, count, days_ago=0):
    if count == 0: return # Don't inject 0 usage records, let it default to 0
    past_date = time.strftime("%Y-%m-%d", time.localtime(time.time() - days_ago*86400))
    payload = {"date": past_date, "count": count}
    requests.post(f"{OM_URL}/usage/table/{table_id}", headers=get_headers(), json=payload)

def add_lineage(from_id, to_id):
    payload = {
        "edge": {"fromEntity": {"id": from_id, "type": "table"}, "toEntity": {"id": to_id, "type": "table"}}
    }
    requests.put(f"{OM_URL}/lineage", headers=get_headers(), json=payload)

def add_table_profile(table_id, size_tb):
    """Flex: Inject massive sizes so the FinOps agent calculates huge dollar amounts."""
    past_date = time.strftime("%Y-%m-%d", time.localtime(time.time()))
    # 1 TB = 1024^4 bytes
    size_bytes = int(size_tb * (1024**4))
    payload = {
        "profileDate": past_date,
        "rowCount": int(size_tb * 50000000), # Fake row count
        "sizeInByte": size_bytes
    }
    res = requests.put(f"{OM_URL}/tables/{table_id}/tableProfile", headers=get_headers(), json=payload)
    if res.status_code in (200, 201): print(f"[SUCCESS] Added {size_tb} TB profile to table.")
    else: print(f"[WARNING] Failed to add profile: {res.text}")

def seed():
    print("Initializing Enterprise FinOps Seeder (The 'MacBook Neo' Dataset)...")
    create_classification()
    create_tag("UnderReview", "Table has 0 usage. Under observation.")
    create_tag("Warning", "Table has prolonged 0 usage. At risk of deprecation.")
    create_tag("Zombie", "Unused table wasting resources. Confirmed waste.")
    
    schema_fqn = "sample_data.ecommerce_db.shopify"
    
    # The ultimate hackathon dataset: High contrast between the "Good" and the "Waste"
    tables = [
        {
            "name": "core_fact_user_events", 
            "usage": 8500, 
            "size_tb": 12.5,
            "desc": "Core production table. Highly utilized.",
            "is_source": True
        },
        {
            "name": "abandoned_ml_features_v1_tmp", 
            "usage": 0, 
            "size_tb": 45.2, # Massive 45TB table costing ~$1,000+/mo!
            "desc": "Created by a data scientist who left the company 6 months ago.",
            "is_source": False
        },
        {
            "name": "deprecated_marketing_campaign_2023", 
            "usage": 0, 
            "size_tb": 18.7, # 18TB costing ~$450/mo
            "desc": "Old marketing data dump. No longer queried by Looker.",
            "is_source": False
        },
        {
            "name": "test_pipeline_output_do_not_use", 
            "usage": 0, 
            "size_tb": 5.1, # 5TB costing ~$137/mo
            "desc": "Accidental pipeline output from Airflow dry-run.",
            "is_source": False
        }
    ]
    
    ids = {}
    source_id = None
    
    for t in tables:
        tid = create_table(t["name"], schema_fqn, t["desc"])
        if tid:
            ids[t["name"]] = tid
            if t["is_source"]: source_id = tid
            
            add_usage(tid, t["usage"], days_ago=0)
            add_usage(tid, t["usage"], days_ago=1)
            add_table_profile(tid, t["size_tb"])
            print(f"[SUCCESS] Provisioned '{t['name']}' (Usage: {t['usage']}, Size: {t['size_tb']} TB).")
            
    # Add lineage: core_fact_user_events -> (the waste tables)
    # This proves that our agent correctly checks DOWNSTREAM lineage.
    # Because these waste tables have an UPSTREAM source, but NO DOWNSTREAM targets.
    if source_id:
        for name, tid in ids.items():
            if name != "core_fact_user_events":
                add_lineage(source_id, tid)
                print(f"[SUCCESS] Attached upstream lineage from core_fact_user_events -> {name}")

    print("\n[COMPLETE] Seeding Complete! The environment is primed for the FinOps Agent Demo.")

if __name__ == "__main__":
    seed()
