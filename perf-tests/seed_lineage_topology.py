#!/usr/bin/env python3
"""
Seed a synthetic table-lineage topology into a running OpenMetadata instance.

The script is intentionally self-contained so it can be run by anyone with:
- a reachable OpenMetadata instance
- a JWT or personal access token
- Python 3 standard library only
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from typing import Any


DEFAULT_RESULTS_ROOT = pathlib.Path("perf-tests/results")


class SeedFailure(RuntimeError):
    """Raised when the synthetic topology cannot be created."""


@dataclass
class TableRef:
    id: str
    fqn: str
    name: str


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def log(message: str) -> None:
    print(message, flush=True)


def stringify_param(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


class OpenMetadataClient:
    def __init__(self, base_url: str, token: str | None, timeout_secs: int) -> None:
        self.api_base = base_url.rstrip("/") + "/api/v1"
        self.token = token
        self.timeout_secs = timeout_secs

    def _headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def request_json(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        payload: dict[str, Any] | None = None,
        allow_not_found: bool = False,
    ) -> tuple[int, dict[str, Any]]:
        query = None
        if params:
            query = urllib.parse.urlencode(
                {
                    key: stringify_param(value)
                    for key, value in params.items()
                    if value is not None
                },
                doseq=True,
            )

        url = self.api_base + path
        if query:
            url = f"{url}?{query}"

        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")

        request = urllib.request.Request(
            url,
            data=data,
            headers=self._headers(),
            method=method,
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout_secs) as response:
                raw = response.read()
                if not raw:
                    return response.getcode(), {}
                return response.getcode(), json.loads(raw.decode("utf-8"))
        except urllib.error.HTTPError as error:
            if allow_not_found and error.code == 404:
                return error.code, {}
            body = error.read().decode("utf-8", errors="replace")
            raise SeedFailure(
                f"{method} {url} failed with HTTP {error.code}: {body[:500]}"
            ) from error
        except urllib.error.URLError as error:
            raise SeedFailure(f"{method} {url} failed: {error.reason}") from error

    def get_json(
        self,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        allow_not_found: bool = False,
    ) -> tuple[int, dict[str, Any]]:
        return self.request_json(
            "GET",
            path,
            params=params,
            allow_not_found=allow_not_found,
        )

    def post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        _, response = self.request_json("POST", path, payload=payload)
        return response

    def put_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        _, response = self.request_json("PUT", path, payload=payload)
        return response


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed a synthetic lineage topology into a running OpenMetadata instance."
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:8585",
        help="OpenMetadata server root URL (default: http://localhost:8585)",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("OPENMETADATA_JWT_TOKEN") or os.environ.get("OM_TOKEN"),
        help="JWT or personal access token. Defaults to OPENMETADATA_JWT_TOKEN or OM_TOKEN.",
    )
    parser.add_argument(
        "--depth",
        type=int,
        required=True,
        help="Number of downstream layers from the root table.",
    )
    parser.add_argument(
        "--width",
        type=int,
        required=True,
        help="Number of tables per downstream layer.",
    )
    parser.add_argument(
        "--namespace",
        help="Optional short namespace suffix used in created entity names.",
    )
    parser.add_argument(
        "--host-port",
        default="localhost:5432",
        help="Database service host:port stored in the synthetic Postgres connection.",
    )
    parser.add_argument(
        "--database-name",
        default="benchmark",
        help="Database name stored in the synthetic Postgres connection.",
    )
    parser.add_argument(
        "--db-username",
        default="test",
        help="Database username stored in the synthetic Postgres connection.",
    )
    parser.add_argument(
        "--classification-name",
        default="PII",
        help="Classification used for the tagged benchmark column.",
    )
    parser.add_argument(
        "--tag-name",
        default="Sensitive",
        help="Tag name under the classification used for the tagged benchmark column.",
    )
    parser.add_argument(
        "--glossary-name",
        help="Optional glossary name. Defaults to a unique name derived from the namespace.",
    )
    parser.add_argument(
        "--glossary-term-name",
        default="benchmark_term",
        help="Glossary term name applied to the tagged benchmark column.",
    )
    parser.add_argument(
        "--wait-timeout-secs",
        type=int,
        default=600,
        help="Maximum time to wait for lineage indexing to catch up (default: 600).",
    )
    parser.add_argument(
        "--poll-interval-secs",
        type=int,
        default=5,
        help="Polling interval for lineage availability checks (default: 5).",
    )
    parser.add_argument(
        "--request-timeout-secs",
        type=int,
        default=120,
        help="HTTP timeout per request in seconds (default: 120).",
    )
    parser.add_argument(
        "--output-dir",
        help="Optional output directory. Defaults to perf-tests/results/seed-<timestamp>.",
    )
    return parser.parse_args()


def ensure_output_dir(output_dir_arg: str | None) -> pathlib.Path:
    if output_dir_arg:
        output_dir = pathlib.Path(output_dir_arg)
    else:
        timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        output_dir = DEFAULT_RESULTS_ROOT / f"seed-{timestamp}"

    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def build_namespace(args: argparse.Namespace) -> str:
    if args.namespace:
        return args.namespace

    timestamp = dt.datetime.now().strftime("%m%d%H%M%S")
    return f"lf_{args.depth}x{args.width}_{timestamp}"


def path_name(name: str) -> str:
    return urllib.parse.quote(name, safe="")


def classification_tag_label(tag_fqn: str) -> dict[str, Any]:
    return {
        "tagFQN": tag_fqn,
        "source": "Classification",
        "labelType": "Manual",
        "state": "Confirmed",
    }


def glossary_tag_label(term_fqn: str) -> dict[str, Any]:
    return {
        "tagFQN": term_fqn,
        "source": "Glossary",
        "labelType": "Manual",
        "state": "Confirmed",
    }


def ensure_classification(client: OpenMetadataClient, name: str) -> None:
    status, _ = client.get_json(
        f"/classifications/name/{path_name(name)}",
        allow_not_found=True,
    )
    if status == 404:
        log(f"[seed] creating classification {name}")
        client.post_json(
            "/classifications",
            {
                "name": name,
                "description": f"Synthetic classification for lineage perf benchmarks ({name}).",
            },
        )


def ensure_tag(client: OpenMetadataClient, classification: str, tag_name: str) -> str:
    tag_fqn = f"{classification}.{tag_name}"
    status, _ = client.get_json(f"/tags/name/{path_name(tag_fqn)}", allow_not_found=True)
    if status == 404:
        ensure_classification(client, classification)
        log(f"[seed] creating tag {tag_fqn}")
        client.post_json(
            "/tags",
            {
                "classification": classification,
                "name": tag_name,
                "description": f"Synthetic tag for lineage perf benchmarks ({tag_fqn}).",
            },
        )
    return tag_fqn


def ensure_glossary_term(
    client: OpenMetadataClient,
    glossary_name: str,
    term_name: str,
) -> str:
    glossary_status, glossary = client.get_json(
        f"/glossaries/name/{path_name(glossary_name)}",
        allow_not_found=True,
    )
    if glossary_status == 404:
        log(f"[seed] creating glossary {glossary_name}")
        glossary = client.post_json(
            "/glossaries",
            {
                "name": glossary_name,
                "description": f"Synthetic glossary for lineage perf benchmarks ({glossary_name}).",
            },
        )

    term_fqn = f"{glossary.get('fullyQualifiedName', glossary_name)}.{term_name}"
    term_status, term = client.get_json(
        f"/glossaryTerms/name/{path_name(term_fqn)}",
        allow_not_found=True,
    )
    if term_status == 404:
        log(f"[seed] creating glossary term {term_fqn}")
        term = client.post_json(
            "/glossaryTerms",
            {
                "glossary": glossary["fullyQualifiedName"],
                "name": term_name,
                "description": f"Synthetic glossary term for lineage perf benchmarks ({term_name}).",
            },
        )

    return term["fullyQualifiedName"]


def create_service(client: OpenMetadataClient, namespace: str, args: argparse.Namespace) -> dict[str, Any]:
    service_name = f"svc_{namespace}"
    log(f"[seed] creating database service {service_name}")
    return client.post_json(
        "/services/databaseServices",
        {
            "name": service_name,
            "serviceType": "Postgres",
            "description": f"Synthetic database service for lineage perf benchmarks ({namespace}).",
            "connection": {
                "config": {
                    "type": "Postgres",
                    "scheme": "postgresql+psycopg2",
                    "hostPort": args.host_port,
                    "username": args.db_username,
                    "database": args.database_name,
                }
            },
        },
    )


def create_database(client: OpenMetadataClient, namespace: str, service_fqn: str) -> dict[str, Any]:
    database_name = f"db_{namespace}"
    log(f"[seed] creating database {database_name}")
    return client.post_json(
        "/databases",
        {
            "name": database_name,
            "service": service_fqn,
        },
    )


def create_schema(client: OpenMetadataClient, namespace: str, database_fqn: str) -> dict[str, Any]:
    schema_name = f"sch_{namespace}"
    log(f"[seed] creating schema {schema_name}")
    return client.post_json(
        "/databaseSchemas",
        {
            "name": schema_name,
            "database": database_fqn,
        },
    )


def create_table(
    client: OpenMetadataClient,
    schema_fqn: str,
    table_name: str,
    tag_fqn: str,
    glossary_term_fqn: str,
) -> TableRef:
    payload = {
        "name": table_name,
        "databaseSchema": schema_fqn,
        "columns": [
            {
                "name": "customer_id",
                "dataType": "INT",
                "tags": [
                    classification_tag_label(tag_fqn),
                    glossary_tag_label(glossary_term_fqn),
                ],
            },
            {
                "name": "benchmark_value",
                "dataType": "VARCHAR",
                "dataLength": 128,
            },
            {
                "name": "benchmark_metric",
                "dataType": "DECIMAL",
            },
        ],
    }
    response = client.post_json("/tables", payload)
    return TableRef(
        id=response["id"],
        fqn=response["fullyQualifiedName"],
        name=response["name"],
    )


def add_lineage(client: OpenMetadataClient, from_table: TableRef, to_table: TableRef) -> None:
    client.put_json(
        "/lineage",
        {
            "edge": {
                "fromEntity": {"id": from_table.id, "type": "table"},
                "toEntity": {"id": to_table.id, "type": "table"},
                "lineageDetails": {
                    "source": "Manual",
                    "columnsLineage": [
                        {
                            "fromColumns": [f"{from_table.fqn}.customer_id"],
                            "toColumn": f"{to_table.fqn}.customer_id",
                        },
                        {
                            "fromColumns": [f"{from_table.fqn}.benchmark_metric"],
                            "toColumn": f"{to_table.fqn}.benchmark_metric",
                        },
                    ],
                },
            }
        },
    )


def wait_for_lineage(
    client: OpenMetadataClient,
    root_fqn: str,
    depth: int,
    expected_nodes: int,
    timeout_secs: int,
    poll_interval_secs: int,
) -> dict[str, Any]:
    deadline = time.time() + timeout_secs
    last_payload: dict[str, Any] = {}
    # Current getPaginationInfo behavior requires one extra requested depth from
    # the root to surface the deepest downstream layer in the response.
    requested_depth = depth + 1

    while time.time() < deadline:
        _, payload = client.get_json(
            "/lineage/getPaginationInfo",
            params={
                "fqn": root_fqn,
                "entityType": "table",
                "upstreamDepth": 0,
                "downstreamDepth": requested_depth,
                "includeDeleted": False,
            },
        )
        last_payload = payload
        downstream_entities = max(int(payload.get("totalDownstreamEntities") or 0) - 1, 0)
        max_depth = int(payload.get("maxDownstreamDepth") or 0)

        log(
            "[seed] lineage availability check "
            f"downstream_entities={downstream_entities}/{expected_nodes} "
            f"max_downstream_depth={max_depth}/{depth}"
        )

        if downstream_entities >= expected_nodes and max_depth >= depth:
            return payload

        time.sleep(poll_interval_secs)

    raise SeedFailure(
        "Timed out waiting for lineage indexing to catch up. "
        f"Last pagination payload: {json.dumps(last_payload, sort_keys=True)}"
    )


def write_json(path: pathlib.Path, payload: Any) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)


def main() -> int:
    args = parse_args()
    if not args.token:
        raise SystemExit(
            "A token is required. Set OPENMETADATA_JWT_TOKEN or pass --token explicitly."
        )

    output_dir = ensure_output_dir(args.output_dir)
    namespace = build_namespace(args)
    glossary_name = args.glossary_name or f"gl_{namespace}"
    client = OpenMetadataClient(args.base_url, args.token, args.request_timeout_secs)

    started_at = utc_now()
    expected_nodes = args.depth * args.width

    tag_fqn = ensure_tag(client, args.classification_name, args.tag_name)
    glossary_term_fqn = ensure_glossary_term(client, glossary_name, args.glossary_term_name)

    service = create_service(client, namespace, args)
    database = create_database(client, namespace, service["fullyQualifiedName"])
    schema = create_schema(client, namespace, database["fullyQualifiedName"])

    root = create_table(client, schema["fullyQualifiedName"], "root", tag_fqn, glossary_term_fqn)
    log(f"[seed] created root table {root.fqn}")

    tables_created = 1
    lineages_created = 0
    previous_layer = [root]
    first_layer: list[TableRef] = []

    for depth_index in range(1, args.depth + 1):
        current_layer: list[TableRef] = []
        for node_index in range(args.width):
            table_name = f"l{depth_index:02d}_n{node_index:03d}"
            table = create_table(
                client,
                schema["fullyQualifiedName"],
                table_name,
                tag_fqn,
                glossary_term_fqn,
            )
            current_layer.append(table)
            tables_created += 1

            if tables_created % 50 == 0:
                log(f"[seed] created {tables_created} tables")

        if depth_index == 1:
            first_layer = current_layer
        else:
            for node_index, table in enumerate(current_layer):
                add_lineage(client, previous_layer[node_index], table)
                lineages_created += 1
                if lineages_created % 100 == 0:
                    log(f"[seed] created {lineages_created} lineage edges")

        previous_layer = current_layer

    for table in first_layer:
        add_lineage(client, root, table)
        lineages_created += 1
        if lineages_created % 100 == 0:
            log(f"[seed] created {lineages_created} lineage edges")

    pagination_info = wait_for_lineage(
        client,
        root.fqn,
        args.depth,
        expected_nodes,
        args.wait_timeout_secs,
        args.poll_interval_secs,
    )

    finished_at = utc_now()
    manifest_payload = [{"fqn": root.fqn, "entityType": "table", "name": root.name}]
    topology_payload = {
        "started_at": started_at,
        "finished_at": finished_at,
        "base_url": args.base_url,
        "namespace": namespace,
        "depth": args.depth,
        "pagination_depth_requested": args.depth + 1,
        "width": args.width,
        "expected_nodes": expected_nodes,
        "tables_created": tables_created,
        "lineages_created": lineages_created,
        "service": {
            "id": service["id"],
            "fqn": service["fullyQualifiedName"],
            "name": service["name"],
        },
        "database": {
            "id": database["id"],
            "fqn": database["fullyQualifiedName"],
            "name": database["name"],
        },
        "schema": {
            "id": schema["id"],
            "fqn": schema["fullyQualifiedName"],
            "name": schema["name"],
        },
        "root": asdict(root),
        "classification_tag_fqn": tag_fqn,
        "glossary_name": glossary_name,
        "glossary_term_fqn": glossary_term_fqn,
        "pagination_info": pagination_info,
    }

    manifest_path = output_dir / "manifest.json"
    topology_path = output_dir / "topology.json"
    write_json(manifest_path, manifest_payload)
    write_json(topology_path, topology_payload)

    log(f"[seed] synthetic topology ready: {root.fqn}")
    log(f"[seed] manifest: {manifest_path}")
    log(f"[seed] topology: {topology_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
