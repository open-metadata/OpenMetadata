#!/usr/bin/env python3
"""
Lineage and Impact Analysis performance benchmark for OpenMetadata.

The script is intentionally self-contained so it can be run by anyone with:
- a reachable OpenMetadata instance
- a JWT or personal access token
- Python 3 standard library only
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
import os
import pathlib
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from typing import Any, Callable

DEFAULT_SEARCH_INDEXES = [
    "table",
    "topic",
    "dashboard",
    "pipeline",
    "mlmodel",
    "container",
    "searchIndex",
    "dashboardDataModel",
    "storedProcedure",
    "apiEndpoint",
    "metric",
    "chart",
]

DEFAULT_RESULTS_ROOT = pathlib.Path("perf-tests/results")


class BenchmarkFailure(RuntimeError):
    """Raised when a benchmark request cannot complete successfully."""


@dataclass
class Asset:
    fqn: str
    entity_type: str
    search_index: str | None = None
    name: str | None = None
    upstream_entities: int = 0
    downstream_entities: int = 0
    max_upstream_depth: int = 0
    max_downstream_depth: int = 0
    discovery_error: str | None = None


@dataclass
class RunMeasurement:
    latency_ms: float
    status_code: int
    response_bytes: int
    response_summary: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


@dataclass
class ScenarioResult:
    asset_fqn: str
    entity_type: str
    scenario: str
    category: str
    request_path: str
    request_params: dict[str, Any]
    warmup_runs: int
    measured_runs: int
    measurements: list[RunMeasurement]
    docker_stats: dict[str, Any] | None = None

    def successful_measurements(self) -> list[RunMeasurement]:
        return [measurement for measurement in self.measurements if measurement.error is None]


@dataclass
class DiscoverySummary:
    searched_assets: int
    lineaged_assets: int
    lineaged_by_type: dict[str, int]


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def percentile(values: list[float], percentile_value: float) -> float | None:
    if not values:
        return None

    if len(values) == 1:
        return values[0]

    ordered = sorted(values)
    rank = (len(ordered) - 1) * (percentile_value / 100.0)
    lower = math.floor(rank)
    upper = math.ceil(rank)

    if lower == upper:
        return ordered[int(rank)]

    lower_value = ordered[lower]
    upper_value = ordered[upper]

    return lower_value + (upper_value - lower_value) * (rank - lower)


def summarize_latencies(latencies: list[float]) -> dict[str, float | int | None]:
    if not latencies:
        return {
            "count": 0,
            "min_ms": None,
            "max_ms": None,
            "mean_ms": None,
            "median_ms": None,
            "p95_ms": None,
            "p99_ms": None,
        }

    return {
        "count": len(latencies),
        "min_ms": min(latencies),
        "max_ms": max(latencies),
        "mean_ms": statistics.fmean(latencies),
        "median_ms": statistics.median(latencies),
        "p95_ms": percentile(latencies, 95),
        "p99_ms": percentile(latencies, 99),
    }


def normalize_total_hits(total: Any) -> int | None:
    if total is None:
        return None
    if isinstance(total, int):
        return total
    if isinstance(total, dict):
        value = total.get("value")
        if isinstance(value, int):
            return value
    return None


def stringify_param(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


class OpenMetadataClient:
    def __init__(self, base_url: str, token: str | None, timeout_secs: int) -> None:
        self.api_base = base_url.rstrip("/") + "/api/v1"
        self.token = token
        self.timeout_secs = timeout_secs

    def _build_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        return headers

    def get_json(self, path: str, params: dict[str, Any] | None = None) -> tuple[int, bytes, Any, float]:
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

        request = urllib.request.Request(url, headers=self._build_headers(), method="GET")
        started = time.perf_counter()

        try:
            with urllib.request.urlopen(request, timeout=self.timeout_secs) as response:
                payload = response.read()
                elapsed_ms = (time.perf_counter() - started) * 1000.0
                if not payload:
                    return response.getcode(), payload, {}, elapsed_ms
                return response.getcode(), payload, json.loads(payload.decode("utf-8")), elapsed_ms
        except urllib.error.HTTPError as error:
            payload = error.read()
            elapsed_ms = (time.perf_counter() - started) * 1000.0
            body = payload.decode("utf-8", errors="replace")
            raise BenchmarkFailure(
                f"GET {url} failed with HTTP {error.code}: {body[:500]}"
            ) from error
        except urllib.error.URLError as error:
            elapsed_ms = (time.perf_counter() - started) * 1000.0
            raise BenchmarkFailure(
                f"GET {url} failed after {elapsed_ms:.2f} ms: {error.reason}"
            ) from error


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Benchmark OpenMetadata lineage and Impact Analysis APIs."
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
        "--entities-file",
        help="Optional JSON file with explicit assets to benchmark. Format: [{\"fqn\":..., \"entityType\":...}]",
    )
    parser.add_argument(
        "--search-indexes",
        default=",".join(DEFAULT_SEARCH_INDEXES),
        help="Comma-separated search indexes used for asset discovery.",
    )
    parser.add_argument(
        "--search-page-size",
        type=int,
        default=100,
        help="Search page size used during discovery (default: 100).",
    )
    parser.add_argument(
        "--benchmark-depth",
        type=int,
        default=2,
        help="Depth used for lineage and Impact Analysis benchmarks (default: 2).",
    )
    parser.add_argument(
        "--impact-page-size",
        type=int,
        default=100,
        help="Page size for getLineageByEntityCount requests (default: 100).",
    )
    parser.add_argument(
        "--warmup-runs",
        type=int,
        default=1,
        help="Warmup requests per scenario before measurement (default: 1).",
    )
    parser.add_argument(
        "--measured-runs",
        type=int,
        default=5,
        help="Measured requests per scenario (default: 5).",
    )
    parser.add_argument(
        "--max-assets",
        type=int,
        help="Optional global cap on discovered lineaged assets.",
    )
    parser.add_argument(
        "--max-assets-per-type",
        type=int,
        help="Optional cap per entity type after discovery.",
    )
    parser.add_argument(
        "--query-filter",
        help="Optional query_filter JSON applied to graph and Impact Analysis benchmarks.",
    )
    parser.add_argument(
        "--column-filter",
        help="Optional column_filter used for Impact Analysis column-mode benchmarks.",
    )
    parser.add_argument(
        "--request-timeout-secs",
        type=int,
        default=120,
        help="HTTP timeout per request in seconds (default: 120).",
    )
    parser.add_argument(
        "--pause-ms",
        type=int,
        default=0,
        help="Optional pause between measured requests (default: 0).",
    )
    parser.add_argument(
        "--skip-graph",
        action="store_true",
        help="Skip graph lineage scenarios.",
    )
    parser.add_argument(
        "--skip-impact-table",
        action="store_true",
        help="Skip Impact Analysis table scenarios.",
    )
    parser.add_argument(
        "--skip-impact-column",
        action="store_true",
        help="Skip Impact Analysis column-mode scenarios for tables.",
    )
    parser.add_argument(
        "--discovery-only",
        action="store_true",
        help="Discover lineaged assets and write inventory without running benchmarks.",
    )
    parser.add_argument(
        "--docker-containers",
        help="Optional comma-separated Docker containers to snapshot via `docker stats --no-stream`.",
    )
    parser.add_argument(
        "--output-dir",
        help="Optional output directory. Defaults to perf-tests/results/lineage-<timestamp>.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print per-asset and per-scenario progress.",
    )

    return parser.parse_args()


def ensure_output_dir(output_dir_arg: str | None) -> pathlib.Path:
    if output_dir_arg:
        output_dir = pathlib.Path(output_dir_arg)
    else:
        timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        output_dir = DEFAULT_RESULTS_ROOT / f"lineage-{timestamp}"

    output_dir.mkdir(parents=True, exist_ok=True)

    return output_dir


def log(message: str) -> None:
    print(message, flush=True)


def parse_entities_file(path: str) -> list[Asset]:
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)

    if not isinstance(payload, list):
        raise ValueError("entities file must contain a JSON array")

    assets: list[Asset] = []
    for entry in payload:
        if not isinstance(entry, dict):
            raise ValueError("entities file entries must be objects")
        fqn = entry.get("fqn")
        entity_type = entry.get("entityType") or entry.get("entity_type")
        if not fqn or not entity_type:
            raise ValueError("entities file entries must include fqn and entityType")
        assets.append(
            Asset(
                fqn=fqn,
                entity_type=entity_type,
                search_index=entry.get("searchIndex"),
                name=entry.get("name"),
            )
        )

    return assets


def discover_assets(
    client: OpenMetadataClient,
    search_indexes: list[str],
    page_size: int,
    verbose: bool,
) -> list[Asset]:
    discovered: dict[tuple[str, str], Asset] = {}

    for search_index in search_indexes:
        offset = 0
        while True:
            _, _, payload, _ = client.get_json(
                "/search/query",
                {
                    "q": "*",
                    "index": search_index,
                    "from": offset,
                    "size": page_size,
                    "deleted": False,
                    "track_total_hits": True,
                },
            )

            hits = payload.get("hits", {}).get("hits", [])
            if not isinstance(hits, list):
                hits = []

            if verbose:
                log(f"[discover] index={search_index} offset={offset} hits={len(hits)}")

            for hit in hits:
                source = hit.get("_source", {})
                if not isinstance(source, dict):
                    continue

                entity_type = source.get("entityType")
                fqn = source.get("fullyQualifiedName")
                if not entity_type or not fqn:
                    continue

                key = (entity_type, fqn)
                discovered[key] = Asset(
                    fqn=fqn,
                    entity_type=entity_type,
                    search_index=search_index,
                    name=source.get("displayName") or source.get("name") or fqn,
                )

            if len(hits) < page_size:
                break
            offset += page_size

    return sorted(discovered.values(), key=lambda asset: (asset.entity_type, asset.fqn))


def apply_asset_limits(
    assets: list[Asset],
    max_assets: int | None,
    max_assets_per_type: int | None,
) -> list[Asset]:
    if max_assets_per_type is not None:
        per_type_seen: dict[str, int] = {}
        filtered: list[Asset] = []
        for asset in assets:
            count = per_type_seen.get(asset.entity_type, 0)
            if count >= max_assets_per_type:
                continue
            per_type_seen[asset.entity_type] = count + 1
            filtered.append(asset)
        assets = filtered

    if max_assets is not None:
        assets = assets[:max_assets]

    return assets


def enrich_with_lineage_counts(
    client: OpenMetadataClient,
    assets: list[Asset],
    depth: int,
    verbose: bool,
) -> tuple[list[Asset], DiscoverySummary]:
    lineaged_assets: list[Asset] = []
    lineaged_by_type: dict[str, int] = {}

    for asset in assets:
        try:
            _, _, payload, _ = client.get_json(
                "/lineage/getPaginationInfo",
                {
                    "fqn": asset.fqn,
                    "entityType": asset.entity_type,
                    "upstreamDepth": depth,
                    "downstreamDepth": depth,
                },
            )

            total_upstream = int(payload.get("totalUpstreamEntities") or 0)
            total_downstream = int(payload.get("totalDownstreamEntities") or 0)
            asset.upstream_entities = max(total_upstream - 1, 0)
            asset.downstream_entities = max(total_downstream - 1, 0)
            asset.max_upstream_depth = int(payload.get("maxUpstreamDepth") or 0)
            asset.max_downstream_depth = int(payload.get("maxDownstreamDepth") or 0)

            has_lineage = asset.upstream_entities > 0 or asset.downstream_entities > 0
            if has_lineage:
                lineaged_assets.append(asset)
                lineaged_by_type[asset.entity_type] = lineaged_by_type.get(asset.entity_type, 0) + 1

            if verbose:
                log(
                    f"[counts] {asset.entity_type} {asset.fqn} "
                    f"up={asset.upstream_entities} down={asset.downstream_entities}"
                )
        except BenchmarkFailure as error:
            asset.discovery_error = str(error)
            if verbose:
                log(f"[counts] failed for {asset.entity_type} {asset.fqn}: {error}")

    summary = DiscoverySummary(
        searched_assets=len(assets),
        lineaged_assets=len(lineaged_assets),
        lineaged_by_type=dict(sorted(lineaged_by_type.items())),
    )

    return lineaged_assets, summary


def summarize_lineage_response(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}

    nodes = payload.get("nodes")
    upstream_edges = payload.get("upstreamEdges")
    downstream_edges = payload.get("downstreamEdges")

    return {
        "node_count": len(nodes) if isinstance(nodes, dict) else 0,
        "upstream_edge_count": len(upstream_edges) if isinstance(upstream_edges, dict) else 0,
        "downstream_edge_count": len(downstream_edges) if isinstance(downstream_edges, dict) else 0,
    }


def summarize_pagination_response(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}

    return {
        "total_upstream_entities": int(payload.get("totalUpstreamEntities") or 0),
        "total_downstream_entities": int(payload.get("totalDownstreamEntities") or 0),
        "max_upstream_depth": int(payload.get("maxUpstreamDepth") or 0),
        "max_downstream_depth": int(payload.get("maxDownstreamDepth") or 0),
    }


def capture_docker_stats(containers: list[str]) -> dict[str, Any] | None:
    if not containers:
        return None

    try:
        process = subprocess.run(
            [
                "docker",
                "stats",
                "--no-stream",
                "--format",
                "{{json .}}",
                *containers,
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError) as error:
        return {"error": str(error)}

    snapshots: dict[str, Any] = {}
    for line in process.stdout.splitlines():
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        container_name = entry.get("Container") or entry.get("Name")
        if container_name:
            snapshots[container_name] = entry

    return snapshots


@dataclass
class Scenario:
    name: str
    category: str
    path: str
    applies_to: Callable[[Asset], bool]
    params_builder: Callable[[Asset, argparse.Namespace], dict[str, Any]]
    response_summarizer: Callable[[Any], dict[str, Any]]


def build_scenarios(args: argparse.Namespace) -> list[Scenario]:
    scenarios: list[Scenario] = []

    if not args.skip_graph:
        scenarios.extend(
            [
                Scenario(
                    name="graph_full",
                    category="graph",
                    path="/lineage/getLineage",
                    applies_to=lambda asset: True,
                    params_builder=lambda asset, parsed_args: {
                        "fqn": asset.fqn,
                        "type": asset.entity_type,
                        "upstreamDepth": parsed_args.benchmark_depth,
                        "downstreamDepth": parsed_args.benchmark_depth,
                        "includeDeleted": False,
                        "query_filter": parsed_args.query_filter,
                    },
                    response_summarizer=summarize_lineage_response,
                ),
                Scenario(
                    name="graph_upstream",
                    category="graph",
                    path="/lineage/getLineage/Upstream",
                    applies_to=lambda asset: asset.upstream_entities > 0,
                    params_builder=lambda asset, parsed_args: {
                        "fqn": asset.fqn,
                        "type": asset.entity_type,
                        "upstreamDepth": parsed_args.benchmark_depth,
                        "downstreamDepth": 0,
                        "includeDeleted": False,
                        "query_filter": parsed_args.query_filter,
                    },
                    response_summarizer=summarize_lineage_response,
                ),
                Scenario(
                    name="graph_downstream",
                    category="graph",
                    path="/lineage/getLineage/Downstream",
                    applies_to=lambda asset: asset.downstream_entities > 0,
                    params_builder=lambda asset, parsed_args: {
                        "fqn": asset.fqn,
                        "type": asset.entity_type,
                        "upstreamDepth": 0,
                        "downstreamDepth": parsed_args.benchmark_depth,
                        "includeDeleted": False,
                        "query_filter": parsed_args.query_filter,
                    },
                    response_summarizer=summarize_lineage_response,
                ),
            ]
        )

    if not args.skip_impact_table:
        scenarios.extend(
            [
                Scenario(
                    name="impact_pagination",
                    category="impact_table",
                    path="/lineage/getPaginationInfo",
                    applies_to=lambda asset: True,
                    params_builder=lambda asset, parsed_args: {
                        "fqn": asset.fqn,
                        "entityType": asset.entity_type,
                        "upstreamDepth": parsed_args.benchmark_depth,
                        "downstreamDepth": parsed_args.benchmark_depth,
                        "query_filter": parsed_args.query_filter,
                    },
                    response_summarizer=summarize_pagination_response,
                ),
                Scenario(
                    name="impact_table_upstream",
                    category="impact_table",
                    path="/lineage/getLineageByEntityCount",
                    applies_to=lambda asset: asset.upstream_entities > 0,
                    params_builder=lambda asset, parsed_args: {
                        "fqn": asset.fqn,
                        "entityType": asset.entity_type,
                        "direction": "Upstream",
                        "nodeDepth": parsed_args.benchmark_depth,
                        "maxDepth": parsed_args.benchmark_depth,
                        "from": 0,
                        "size": parsed_args.impact_page_size,
                        "query_filter": parsed_args.query_filter,
                    },
                    response_summarizer=summarize_lineage_response,
                ),
                Scenario(
                    name="impact_table_downstream",
                    category="impact_table",
                    path="/lineage/getLineageByEntityCount",
                    applies_to=lambda asset: asset.downstream_entities > 0,
                    params_builder=lambda asset, parsed_args: {
                        "fqn": asset.fqn,
                        "entityType": asset.entity_type,
                        "direction": "Downstream",
                        "nodeDepth": parsed_args.benchmark_depth,
                        "maxDepth": parsed_args.benchmark_depth,
                        "from": 0,
                        "size": parsed_args.impact_page_size,
                        "query_filter": parsed_args.query_filter,
                    },
                    response_summarizer=summarize_lineage_response,
                ),
            ]
        )

    if not args.skip_impact_column:
        scenarios.extend(
            [
                Scenario(
                    name="impact_column_upstream",
                    category="impact_column",
                    path="/lineage/getLineage/Upstream",
                    applies_to=lambda asset: asset.entity_type == "table" and asset.upstream_entities > 0,
                    params_builder=lambda asset, parsed_args: {
                        "fqn": asset.fqn,
                        "type": asset.entity_type,
                        "upstreamDepth": parsed_args.benchmark_depth,
                        "downstreamDepth": 0,
                        "includeDeleted": False,
                        "query_filter": parsed_args.query_filter,
                        "column_filter": parsed_args.column_filter,
                    },
                    response_summarizer=summarize_lineage_response,
                ),
                Scenario(
                    name="impact_column_downstream",
                    category="impact_column",
                    path="/lineage/getLineage/Downstream",
                    applies_to=lambda asset: asset.entity_type == "table" and asset.downstream_entities > 0,
                    params_builder=lambda asset, parsed_args: {
                        "fqn": asset.fqn,
                        "type": asset.entity_type,
                        "upstreamDepth": 0,
                        "downstreamDepth": parsed_args.benchmark_depth,
                        "includeDeleted": False,
                        "query_filter": parsed_args.query_filter,
                        "column_filter": parsed_args.column_filter,
                    },
                    response_summarizer=summarize_lineage_response,
                ),
            ]
        )

    return scenarios


def run_scenario(
    client: OpenMetadataClient,
    asset: Asset,
    scenario: Scenario,
    args: argparse.Namespace,
    docker_containers: list[str],
) -> ScenarioResult:
    params = scenario.params_builder(asset, args)

    for _ in range(args.warmup_runs):
        try:
            client.get_json(scenario.path, params)
        except BenchmarkFailure:
            break

    measurements: list[RunMeasurement] = []
    for run_index in range(args.measured_runs):
        try:
            status_code, payload_bytes, payload, latency_ms = client.get_json(scenario.path, params)
            measurements.append(
                RunMeasurement(
                    latency_ms=latency_ms,
                    status_code=status_code,
                    response_bytes=len(payload_bytes),
                    response_summary=scenario.response_summarizer(payload),
                )
            )
        except BenchmarkFailure as error:
            measurements.append(
                RunMeasurement(
                    latency_ms=0.0,
                    status_code=0,
                    response_bytes=0,
                    error=str(error),
                )
            )

        if args.pause_ms > 0 and run_index != args.measured_runs - 1:
            time.sleep(args.pause_ms / 1000.0)

    return ScenarioResult(
        asset_fqn=asset.fqn,
        entity_type=asset.entity_type,
        scenario=scenario.name,
        category=scenario.category,
        request_path=scenario.path,
        request_params=params,
        warmup_runs=args.warmup_runs,
        measured_runs=args.measured_runs,
        measurements=measurements,
        docker_stats=capture_docker_stats(docker_containers) if docker_containers else None,
    )


def build_summary(
    assets: list[Asset],
    discovery: DiscoverySummary,
    results: list[ScenarioResult],
) -> dict[str, Any]:
    scenario_rollups: dict[str, list[float]] = {}
    scenario_assets: dict[str, int] = {}
    slowest: list[dict[str, Any]] = []

    for result in results:
        successful = result.successful_measurements()
        latencies = [measurement.latency_ms for measurement in successful]
        scenario_rollups.setdefault(result.scenario, []).extend(latencies)
        scenario_assets[result.scenario] = scenario_assets.get(result.scenario, 0) + 1

        if latencies:
            slowest.append(
                {
                    "asset_fqn": result.asset_fqn,
                    "entity_type": result.entity_type,
                    "scenario": result.scenario,
                    "mean_ms": statistics.fmean(latencies),
                    "p95_ms": percentile(latencies, 95),
                }
            )

    scenario_summary = {
        scenario: {
            **summarize_latencies(latencies),
            "asset_count": scenario_assets.get(scenario, 0),
        }
        for scenario, latencies in sorted(scenario_rollups.items())
    }

    slowest.sort(key=lambda entry: entry["mean_ms"], reverse=True)

    asset_type_summary: dict[str, dict[str, int]] = {}
    for asset in assets:
        summary = asset_type_summary.setdefault(
            asset.entity_type,
            {"assets": 0, "upstream_lineage_assets": 0, "downstream_lineage_assets": 0},
        )
        summary["assets"] += 1
        if asset.upstream_entities > 0:
            summary["upstream_lineage_assets"] += 1
        if asset.downstream_entities > 0:
            summary["downstream_lineage_assets"] += 1

    return {
        "discovery": asdict(discovery),
        "benchmarked_assets": len(assets),
        "asset_type_summary": dict(sorted(asset_type_summary.items())),
        "scenario_summary": scenario_summary,
        "slowest_scenarios": slowest[:15],
    }


def write_assets_json(path: pathlib.Path, assets: list[Asset]) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        json.dump([asdict(asset) for asset in assets], handle, indent=2, sort_keys=True)


def write_results_json(
    path: pathlib.Path,
    *,
    started_at: str,
    finished_at: str,
    base_url: str,
    args: argparse.Namespace,
    assets: list[Asset],
    discovery: DiscoverySummary,
    results: list[ScenarioResult],
    summary: dict[str, Any],
    docker_pre: dict[str, Any] | None,
    docker_post: dict[str, Any] | None,
) -> None:
    payload = {
        "started_at": started_at,
        "finished_at": finished_at,
        "base_url": base_url,
        "argv": sys.argv,
        "config": {
            "search_indexes": args.search_indexes.split(",") if args.search_indexes else [],
            "benchmark_depth": args.benchmark_depth,
            "impact_page_size": args.impact_page_size,
            "warmup_runs": args.warmup_runs,
            "measured_runs": args.measured_runs,
            "max_assets": args.max_assets,
            "max_assets_per_type": args.max_assets_per_type,
            "query_filter": args.query_filter,
            "column_filter": args.column_filter,
            "discovery_only": args.discovery_only,
            "docker_containers": args.docker_containers,
        },
        "docker_pre": docker_pre,
        "docker_post": docker_post,
        "assets": [asdict(asset) for asset in assets],
        "discovery": asdict(discovery),
        "results": [
            {
                **asdict(result),
                "measurements": [asdict(measurement) for measurement in result.measurements],
            }
            for result in results
        ],
        "summary": summary,
    }

    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)


def write_scenario_summary_csv(path: pathlib.Path, summary: dict[str, Any]) -> None:
    rows = summary.get("scenario_summary", {})
    with open(path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "scenario",
                "asset_count",
                "count",
                "min_ms",
                "max_ms",
                "mean_ms",
                "median_ms",
                "p95_ms",
                "p99_ms",
            ]
        )
        for scenario, values in rows.items():
            writer.writerow(
                [
                    scenario,
                    values.get("asset_count"),
                    values.get("count"),
                    values.get("min_ms"),
                    values.get("max_ms"),
                    values.get("mean_ms"),
                    values.get("median_ms"),
                    values.get("p95_ms"),
                    values.get("p99_ms"),
                ]
            )


def write_asset_results_csv(path: pathlib.Path, results: list[ScenarioResult]) -> None:
    with open(path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "entity_type",
                "asset_fqn",
                "scenario",
                "category",
                "successful_runs",
                "mean_ms",
                "median_ms",
                "p95_ms",
                "p99_ms",
            ]
        )
        for result in results:
            latencies = [measurement.latency_ms for measurement in result.successful_measurements()]
            latency_summary = summarize_latencies(latencies)
            writer.writerow(
                [
                    result.entity_type,
                    result.asset_fqn,
                    result.scenario,
                    result.category,
                    latency_summary["count"],
                    latency_summary["mean_ms"],
                    latency_summary["median_ms"],
                    latency_summary["p95_ms"],
                    latency_summary["p99_ms"],
                ]
            )


def write_summary_md(
    path: pathlib.Path,
    *,
    started_at: str,
    finished_at: str,
    base_url: str,
    args: argparse.Namespace,
    summary: dict[str, Any],
) -> None:
    discovery = summary["discovery"]
    lines = [
        "# Lineage Benchmark Summary",
        "",
        f"- Started: `{started_at}`",
        f"- Finished: `{finished_at}`",
        f"- Base URL: `{base_url}`",
        f"- Search indexes: `{args.search_indexes}`",
        f"- Benchmark depth: `{args.benchmark_depth}`",
        f"- Warmup runs: `{args.warmup_runs}`",
        f"- Measured runs: `{args.measured_runs}`",
        "",
        "## Discovery",
        "",
        f"- Searched assets: `{discovery['searched_assets']}`",
        f"- Lineaged assets: `{discovery['lineaged_assets']}`",
        f"- Benchmarked assets: `{summary['benchmarked_assets']}`",
        "",
        "### Lineaged Assets by Type",
        "",
        "| Entity Type | Count |",
        "| --- | ---: |",
    ]

    for entity_type, count in summary["discovery"]["lineaged_by_type"].items():
        lines.append(f"| `{entity_type}` | {count} |")

    lines.extend(
        [
            "",
            "## Scenario Summary",
            "",
            "| Scenario | Assets | Runs | Mean (ms) | P95 (ms) | P99 (ms) |",
            "| --- | ---: | ---: | ---: | ---: | ---: |",
        ]
    )

    for scenario, values in summary["scenario_summary"].items():
        lines.append(
            "| `{}` | {} | {} | {:.2f} | {:.2f} | {:.2f} |".format(
                scenario,
                values.get("asset_count", 0),
                values.get("count", 0),
                values.get("mean_ms") or 0.0,
                values.get("p95_ms") or 0.0,
                values.get("p99_ms") or 0.0,
            )
        )

    lines.extend(
        [
            "",
            "## Slowest Asset + Scenario Combinations",
            "",
            "| Entity Type | Scenario | Asset FQN | Mean (ms) | P95 (ms) |",
            "| --- | --- | --- | ---: | ---: |",
        ]
    )

    for slow in summary["slowest_scenarios"]:
        lines.append(
            "| `{}` | `{}` | `{}` | {:.2f} | {:.2f} |".format(
                slow["entity_type"],
                slow["scenario"],
                slow["asset_fqn"],
                slow["mean_ms"] or 0.0,
                slow["p95_ms"] or 0.0,
            )
        )

    lines.append("")

    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


def check_connectivity(client: OpenMetadataClient) -> None:
    client.get_json("/system/version")


def main() -> int:
    args = parse_args()
    output_dir = ensure_output_dir(args.output_dir)
    search_indexes = [index.strip() for index in args.search_indexes.split(",") if index.strip()]
    docker_containers = [
        container.strip()
        for container in (args.docker_containers or "").split(",")
        if container.strip()
    ]

    client = OpenMetadataClient(args.base_url, args.token, args.request_timeout_secs)

    log(f"[setup] output_dir={output_dir}")
    check_connectivity(client)
    log(f"[setup] connected to {args.base_url}")

    started_at = utc_now()
    docker_pre = capture_docker_stats(docker_containers) if docker_containers else None

    if args.entities_file:
        assets = parse_entities_file(args.entities_file)
        log(f"[discover] loaded {len(assets)} assets from {args.entities_file}")
    else:
        assets = discover_assets(client, search_indexes, args.search_page_size, args.verbose)
        log(f"[discover] found {len(assets)} candidate assets across search")

    lineaged_assets, discovery = enrich_with_lineage_counts(
        client,
        assets,
        args.benchmark_depth,
        args.verbose,
    )
    benchmark_assets = apply_asset_limits(
        lineaged_assets,
        args.max_assets,
        args.max_assets_per_type,
    )

    write_assets_json(output_dir / "assets.json", assets)
    log(
        "[discover] lineaged assets={} types={}".format(
            discovery.lineaged_assets,
            ", ".join(
                f"{entity_type}:{count}"
                for entity_type, count in discovery.lineaged_by_type.items()
            )
            or "none",
        )
    )

    results: list[ScenarioResult] = []
    if not args.discovery_only and benchmark_assets:
        scenarios = build_scenarios(args)
        total_scenarios = sum(
            1
            for asset in benchmark_assets
            for scenario in scenarios
            if scenario.applies_to(asset)
        )
        completed = 0

        log(f"[bench] selected benchmark assets={len(benchmark_assets)}")

        for asset in benchmark_assets:
            for scenario in scenarios:
                if not scenario.applies_to(asset):
                    continue
                completed += 1
                if args.verbose:
                    log(
                        f"[bench] {completed}/{total_scenarios} "
                        f"{scenario.name} {asset.entity_type} {asset.fqn}"
                    )
                result = run_scenario(client, asset, scenario, args, docker_containers)
                results.append(result)

    finished_at = utc_now()
    docker_post = capture_docker_stats(docker_containers) if docker_containers else None
    summary = build_summary(benchmark_assets, discovery, results)

    write_results_json(
        output_dir / "results.json",
        started_at=started_at,
        finished_at=finished_at,
        base_url=args.base_url,
        args=args,
        assets=assets,
        discovery=discovery,
        results=results,
        summary=summary,
        docker_pre=docker_pre,
        docker_post=docker_post,
    )
    write_scenario_summary_csv(output_dir / "scenario_summary.csv", summary)
    write_asset_results_csv(output_dir / "asset_results.csv", results)
    write_summary_md(
        output_dir / "summary.md",
        started_at=started_at,
        finished_at=finished_at,
        base_url=args.base_url,
        args=args,
        summary=summary,
    )

    log(f"[done] results written to {output_dir}")

    if discovery.lineaged_assets == 0:
        log("[done] no lineaged assets were found in the target environment")
        return 2

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BenchmarkFailure as error:
        print(f"Benchmark failed: {error}", file=sys.stderr)
        raise SystemExit(1)
    except KeyboardInterrupt:
        print("Benchmark interrupted.", file=sys.stderr)
        raise SystemExit(130)
