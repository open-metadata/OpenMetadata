#!/usr/bin/env python3
"""
Test script for ManualTask loop stage tracking.

Usage:
    export TOKEN=<your_jwt_token>
    python test_manual_task_loop.py deploy       # Deploy the workflow definition
    python test_manual_task_loop.py trigger      # Create a table to trigger the workflow
    python test_manual_task_loop.py task         # Show the task created by the workflow
    python test_manual_task_loop.py patch <status>  # PATCH task status (e.g. InProgress, Completed)
    python test_manual_task_loop.py stages       # Query workflow_instance_state_time_series via API
    python test_manual_task_loop.py db           # Query stage rows directly from MySQL (docker exec)
    python test_manual_task_loop.py full         # Run full test: deploy → trigger → wait → InProgress → Completed → db
"""

import json
import os
import subprocess
import sys
import time

import requests

BASE = "http://localhost:8585/api/v1"
TOKEN = os.environ.get("TOKEN", "")
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
PATCH_HEADERS = {**HEADERS, "Content-Type": "application/json-patch+json"}

WORKFLOW_NAME = "ManualTaskWithActions"
TABLE_NAME = "stage_loop_test_v3"
TABLE_FQN = f"sample_data.ecommerce_db.shopify.{TABLE_NAME}"

WORKFLOW_DEFINITION = {
    "name": WORKFLOW_NAME,
    "displayName": "ManualTask With Action Nodes",
    "description": "Tests ManualTask with action nodes on transitions",
    "config": {"storeStageStatus": True},
    "trigger": {
        "type": "eventBasedEntity",
        "config": {"entityTypes": ["table"], "events": ["Created"], "exclude": []},
        "output": ["relatedEntity"],
    },
    "nodes": [
        {"type": "startEvent", "subType": "startEvent", "name": "start", "displayName": "Start"},
        {
            "type": "manualTask",
            "subType": "manualTask",
            "name": "resolveIncident",
            "displayName": "Resolve Incident",
            "config": {"template": "IncidentResolution"},
            "input": ["relatedEntity"],
            "inputNamespaceMap": {"relatedEntity": "global"},
            "output": ["result"],
            "branches": ["Open", "InProgress", "Pending", "Completed"],
        },
        {
            "type": "automatedTask",
            "subType": "setEntityAttributeTask",
            "name": "markInProgress",
            "displayName": "Mark In Progress",
            "config": {"fieldName": "description", "fieldValue": "INCIDENT: Under investigation"},
            "input": ["relatedEntity", "updatedBy"],
            "inputNamespaceMap": {"relatedEntity": "global"},
            "output": [],
        },
        {
            "type": "automatedTask",
            "subType": "setEntityAttributeTask",
            "name": "markResolved",
            "displayName": "Mark Resolved",
            "config": {"fieldName": "description", "fieldValue": "INCIDENT: Resolved"},
            "input": ["relatedEntity", "updatedBy"],
            "inputNamespaceMap": {"relatedEntity": "global"},
            "output": [],
        },
        {
            "type": "endEvent",
            "subType": "endEvent",
            "name": "resolvedEnd",
            "displayName": "Resolved",
        },
    ],
    "edges": [
        {"from": "start", "to": "resolveIncident"},
        {"from": "resolveIncident", "to": "resolveIncident", "condition": "Open"},
        {"from": "resolveIncident", "to": "markInProgress", "condition": "InProgress"},
        {"from": "markInProgress", "to": "resolveIncident"},
        {"from": "resolveIncident", "to": "resolveIncident", "condition": "Pending"},
        {"from": "resolveIncident", "to": "markResolved", "condition": "Completed"},
        {"from": "markResolved", "to": "resolvedEnd"},
    ],
}


def check_token():
    if not TOKEN:
        print("ERROR: Set TOKEN env var first. e.g. export TOKEN=$(cat /tmp/token.txt)")
        sys.exit(1)


def api_get(path):
    r = requests.get(f"{BASE}{path}", headers=HEADERS)
    return r.status_code, r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text


def api_put(path, body):
    r = requests.put(f"{BASE}{path}", headers=HEADERS, json=body)
    return r.status_code, r.json()


def api_patch(path, body):
    r = requests.patch(f"{BASE}{path}", headers=PATCH_HEADERS, json=body)
    return r.status_code, r.json()


def deploy():
    """Deploy the workflow definition."""
    print(f"Deploying workflow '{WORKFLOW_NAME}'...")
    code, data = api_put(f"/governance/workflowDefinitions", WORKFLOW_DEFINITION)
    if code in (200, 201):
        print(f"  OK: id={data['id']}, deployed={data.get('deployed')}, storeStageStatus={data.get('config', {}).get('storeStageStatus')}")
    else:
        print(f"  FAILED ({code}): {data.get('message', data)}")
        sys.exit(1)


def trigger():
    """Create a table to fire the workflow trigger."""
    print(f"Creating table '{TABLE_FQN}'...")
    code, data = api_put(
        "/tables",
        {
            "name": TABLE_NAME,
            "databaseSchema": "sample_data.ecommerce_db.shopify",
            "columns": [{"name": "id", "dataType": "INT"}],
        },
    )
    if code in (200, 201):
        print(f"  OK: {data['fullyQualifiedName']} (code={code})")
        if code == 200:
            print("  WARNING: Table already existed (200 = update, not create). Workflow may not trigger.")
            print(f"  Delete it first: curl -X DELETE '{BASE}/tables/name/{TABLE_FQN}?hardDelete=true' -H 'Authorization: Bearer $TOKEN'")
    else:
        print(f"  FAILED ({code}): {data.get('message', data)}")


def mysql_query(query):
    """Run a MySQL query via docker exec, returning stdout. Ignores password warnings."""
    result = subprocess.run(
        [
            "docker", "exec", "openmetadata_mysql",
            "mysql", "-uopenmetadata_user", "-popenmetadata_password",
            "-Dopenmetadata_db", "-N", "-e", query,
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        # Filter out the password warning
        errors = [l for l in result.stderr.splitlines() if "Using a password" not in l]
        if errors:
            print(f"  DB error: {' '.join(errors)}")
            return None
    return result.stdout.strip()


def find_task():
    """Find the task created for our table by querying MySQL directly (most reliable)."""
    query = (
        "SELECT JSON_UNQUOTE(JSON_EXTRACT(json, '$.id')) as id "
        "FROM task_entity "
        "WHERE JSON_EXTRACT(json, '$.workflowInstanceId') IS NOT NULL "
        f"AND JSON_EXTRACT(json, '$.description') LIKE '%{TABLE_NAME}%' "
        "ORDER BY JSON_EXTRACT(json, '$.createdAt') DESC LIMIT 1;"
    )
    task_id = mysql_query(query)
    if not task_id:
        return None

    code, data = api_get(f"/tasks/{task_id}")
    if code == 200:
        return data
    print(f"  API fetch failed ({code}): {data.get('message', data)}")
    return None


def task():
    """Show the task associated with our workflow."""
    print("Looking for task...")
    t = find_task()
    if t:
        print(f"  id:     {t['id']}")
        print(f"  taskId: {t.get('taskId', '?')}")
        print(f"  status: {t.get('status', '?')}")
        print(f"  name:   {t['name']}")
        print(f"  wfId:   {t.get('workflowInstanceId', 'none')}")
    else:
        print("  No matching task found. The workflow may not have triggered yet (wait a few seconds).")


def patch(status):
    """PATCH the task to a new status."""
    t = find_task()
    if not t:
        print("ERROR: No task found. Run 'trigger' first and wait a few seconds.")
        sys.exit(1)

    task_id = t["id"]
    print(f"PATCHing task {task_id} to status='{status}'...")
    code, data = api_patch(
        f"/tasks/{task_id}",
        [{"op": "replace", "path": "/status", "value": status}],
    )
    if code == 200:
        print(f"  OK: status={data.get('status')}")
    else:
        print(f"  FAILED ({code}): {data.get('message', data)}")


def stages():
    """Query workflow instance states via the API."""
    t = find_task()
    if not t:
        print("ERROR: No task found.")
        sys.exit(1)

    wf_id = t.get("workflowInstanceId")
    if not wf_id:
        print("ERROR: Task has no workflowInstanceId.")
        sys.exit(1)

    code, data = api_get(
        f"/governance/workflowDefinitions/name/{WORKFLOW_NAME}/workflowInstances/{wf_id}/states?startTs=0&endTs={int(time.time() * 1000)}&limit=50"
    )
    if code == 200:
        print(f"Stages for workflowInstanceId={wf_id}:\n")
        print(f"  {'Stage':<25} {'Status':<12} {'Result':<15} {'StartedAt':<15} {'EndedAt':<15}")
        print(f"  {'-'*25} {'-'*12} {'-'*15} {'-'*15} {'-'*15}")
        for s in data.get("data", []):
            stage = s.get("stage", {})
            print(
                f"  {stage.get('name', '?'):<25} "
                f"{s.get('status', '?'):<12} "
                f"{stage.get('result', '-'):<15} "
                f"{str(stage.get('startedAt', '')):<15} "
                f"{str(stage.get('endedAt', '')):<15}"
            )
    else:
        print(f"  FAILED ({code}): {data.get('message', data)}")


def db():
    """Query the MySQL database directly for stage rows."""
    t = find_task()
    if not t:
        print("ERROR: No task found.")
        sys.exit(1)

    wf_id = t.get("workflowInstanceId")
    if not wf_id:
        print("ERROR: Task has no workflowInstanceId.")
        sys.exit(1)

    query = (
        f"SELECT stage, status, stageResult, "
        f"JSON_EXTRACT(json, '$.stage.startedAt') as startedAt, "
        f"JSON_EXTRACT(json, '$.stage.endedAt') as endedAt "
        f"FROM workflow_instance_state_time_series "
        f"WHERE workflowInstanceId = '{wf_id}' "
        f"ORDER BY timestamp ASC;"
    )

    output = mysql_query(query)
    if output:
        print(f"DB rows for workflowInstanceId={wf_id}:\n")
        print(output)
    else:
        print("No rows found.")


def full():
    """Run the full test sequence."""
    deploy()
    print()
    trigger()
    print()
    print("Waiting 8s for workflow to trigger and create task...")
    time.sleep(8)
    task()
    print()

    t = find_task()
    if not t:
        print("ERROR: Task not created. Check server logs.")
        sys.exit(1)

    print("--- Loop iteration 1: PATCH to InProgress (non-terminal) ---")
    patch("InProgress")
    print("Waiting 3s for workflow to process...")
    time.sleep(3)
    print()

    print("--- Loop iteration 2: PATCH to Completed (terminal) ---")
    patch("Completed")
    print("Waiting 3s for workflow to finish...")
    time.sleep(3)
    print()

    print("=== DB Results ===")
    db()
    print()
    print("=== API Results ===")
    stages()


if __name__ == "__main__":
    check_token()

    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "deploy":
        deploy()
    elif cmd == "trigger":
        trigger()
    elif cmd == "task":
        task()
    elif cmd == "patch":
        if len(sys.argv) < 3:
            print("Usage: python test_manual_task_loop.py patch <status>")
            print("  Statuses: Open, InProgress, Pending, Completed")
            sys.exit(1)
        patch(sys.argv[2])
    elif cmd == "stages":
        stages()
    elif cmd == "db":
        db()
    elif cmd == "full":
        full()
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)
