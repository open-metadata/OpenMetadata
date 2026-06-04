#!/usr/bin/env python3
"""Recreate the `prc-digitram-dev` Mulesoft pipeline (from ingestPipeline.txt)
in a local OpenMetadata at http://localhost:8585.

It builds the hierarchy bottom-up:
  1. Pipeline service `pech-shiva-dev ` (serviceType=Mulesoft)
  2. Pipeline `prc-digitram-dev` with all its tasks + downstream edges

Auth token is read from ingestion/pipelines/sample_data.json (the admin JWT).
"""

import json
import sys
from pathlib import Path
from urllib import error, request
from urllib.parse import quote

REPO = Path(__file__).resolve().parent
SAMPLE_DATA = REPO / "ingestion" / "pipelines" / "sample_data.json"
SOURCE_ENTITY = REPO / "ingestPipeline.txt"
BASE_URL = "http://localhost:8585/api"


def load_token() -> str:
    cfg = json.loads(SAMPLE_DATA.read_text())
    return cfg["workflowConfig"]["openMetadataServerConfig"]["securityConfig"]["jwtToken"]


def load_source_entity() -> dict:
    return json.loads(SOURCE_ENTITY.read_text())


def api(method: str, path: str, token: str, payload: dict | None = None) -> dict:
    body = json.dumps(payload).encode() if payload is not None else None
    req = request.Request(f"{BASE_URL}{path}", data=body, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with request.urlopen(req) as resp:
            return json.loads(resp.read() or "{}")
    except error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise RuntimeError(f"{method} {path} -> {exc.code}: {detail}") from exc


def extract_tasks(source: dict) -> list[dict]:
    tasks_json = source["changeDescription"]["fieldsAdded"][0]["newValue"]
    raw_tasks = json.loads(tasks_json)
    return [
        {
            "name": t["name"],
            "displayName": t.get("displayName"),
            "taskType": t.get("taskType"),
            "downstreamTasks": t.get("downstreamTasks", []),
            "tags": t.get("tags", []),
        }
        for t in raw_tasks
    ]


def upsert_pipeline_service(source: dict, token: str) -> str:
    service = source["service"]
    name = service["name"]
    payload = {
        "name": name,
        "displayName": service.get("displayName", name),
        "description": service.get("description"),
        "serviceType": source["serviceType"],
        "connection": {
            "config": {
                "type": "Mulesoft",
                "hostPort": "https://eu1.anypoint.mulesoft.com",
                "authentication": {
                    "username": "placeholder",
                    "password": "placeholder",
                },
                "organizationId": "46ae1961-5456-49e4-820e-a6741f26e3d3",
                "environmentId": "7e7d0b14-0312-4c5c-93db-84d9b3cfa505",
            }
        },
    }
    result = api("PUT", "/v1/services/pipelineServices", token, payload)
    print(f"  service: {result['fullyQualifiedName']!r} (id={result['id']})")
    return result["fullyQualifiedName"]


def delete_pipeline_if_exists(service_fqn: str, name: str, token: str) -> None:
    fqn = quote(f"{service_fqn}.{name}", safe="")
    try:
        existing = api("GET", f"/v1/pipelines/name/{fqn}?fields=", token)
    except RuntimeError:
        return
    api("DELETE", f"/v1/pipelines/{existing['id']}?hardDelete=true&recursive=true", token)
    print(f"  deleted stale pipeline id={existing['id']}")


def upsert_pipeline(source: dict, service_fqn: str, token: str) -> dict:
    delete_pipeline_if_exists(service_fqn, source["name"], token)
    payload = {
        "name": source["name"],
        "displayName": source.get("displayName", source["name"]),
        "description": source.get("description"),
        "sourceUrl": source.get("sourceUrl"),
        "service": service_fqn,
        "tasks": extract_tasks(source),
    }
    result = api("POST", "/v1/pipelines", token, payload)
    print(f"  pipeline: {result['fullyQualifiedName']!r} (id={result['id']})")
    print(f"  tasks created: {len(result.get('tasks', []))}")
    return result


def main() -> int:
    token = load_token()
    source = load_source_entity()

    print("Creating pipeline service hierarchy...")
    service_fqn = upsert_pipeline_service(source, token)

    print("Creating pipeline entity...")
    upsert_pipeline(source, service_fqn, token)

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
