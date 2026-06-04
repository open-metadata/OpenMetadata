#!/usr/bin/env python3
"""Validate heal-on-read for legacy-corrupt nested FQNs (no migration).

1. Create a valid pipeline `heal-test` with one task.
2. Corrupt the task directly in Postgres to the old, unparseable FQN form
   (name keeps its raw quotes; FQN uses the backslash-mangled legacy form) —
   simulating data that entered before the fix/guards existed.
3. Read it back via the API with tasks+tags (the path that used to 500) and
   confirm it returns 200 with the task FQN repaired on the fly.
"""

import json
import subprocess
from urllib import error, request
from urllib.parse import quote

BASE = "http://localhost:8585/api"
SERVICE_FQN = "pech-shiva-dev "
PIPELINE = "heal-test"
CORRUPT_NAME = 'task_"x"'
LEGACY_FQN = 'pech-shiva-dev .heal-test.task_\\"x\\"'  # literal backslash-quote (old bug output)


def token() -> str:
    with open("ingestion/pipelines/sample_data.json") as f:
        cfg = json.load(f)
    return cfg["workflowConfig"]["openMetadataServerConfig"]["securityConfig"]["jwtToken"]


def api(method: str, path: str, tok: str, payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    req = request.Request(f"{BASE}{path}", data=body, method=method)
    req.add_header("Authorization", f"Bearer {tok}")
    req.add_header("Content-Type", "application/json")
    try:
        with request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read() or "{}")
    except error.HTTPError as exc:
        return exc.code, exc.read().decode(errors="replace")


def psql(sql: str) -> str:
    proc = subprocess.run(
        ["docker", "exec", "-i", "openmetadata_postgresql", "psql", "-U",
         "openmetadata_user", "-d", "openmetadata_db", "-tA"],
        input=sql.encode(), capture_output=True,
    )
    return (proc.stdout + proc.stderr).decode().strip()


def main():
    tok = token()

    fqn = quote(f"{SERVICE_FQN}.{PIPELINE}", safe="")
    code, existing = api("GET", f"/v1/pipelines/name/{fqn}?fields=", tok)
    if code == 200:
        api("DELETE", f"/v1/pipelines/{existing['id']}?hardDelete=true&recursive=true", tok)

    code, created = api("POST", "/v1/pipelines", tok, {
        "name": PIPELINE, "service": SERVICE_FQN, "tasks": [{"name": "task_x"}],
    })
    print(f"1. create valid pipeline -> {code}")
    pid = created["id"]

    sql = (
        "UPDATE pipeline_entity SET json = jsonb_set(jsonb_set("
        f"json, '{{tasks,0,name}}', to_jsonb('{CORRUPT_NAME}'::text)),"
        f" '{{tasks,0,fullyQualifiedName}}', to_jsonb('{LEGACY_FQN}'::text)) "
        f"WHERE id='{pid}';"
    )
    print("2. corrupt task FQN in DB:", psql(sql))
    stored = psql(f"SELECT json->'tasks'->0->>'fullyQualifiedName' FROM pipeline_entity WHERE id='{pid}';")
    print("   stored (corrupt) task FQN:", stored)
    print("   parseable?", "no (unescaped quote)" )

    code, result = api("GET", f"/v1/pipelines/{pid}?fields=tasks,tags", tok)
    print(f"3. read with tasks,tags -> {code}")
    if code == 200:
        t = result["tasks"][0]
        print("   task name        :", t["name"])
        print("   task FQN (healed):", t["fullyQualifiedName"])
    else:
        print("   body:", result[:300])


if __name__ == "__main__":
    main()
