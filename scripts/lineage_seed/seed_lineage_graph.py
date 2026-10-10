#!/usr/bin/env python3
"""Seed a realistic, hierarchical lineage graph — up to millions of assets — into OpenMetadata.

Builds a fictional company's data platform: ten business domains with data products and owning
teams; operational databases; CDC topics; a raw / staging / core / mart warehouse in five accounts;
BI semantic models and dashboards; ML models. Every table and column has a real description, PII
columns are tagged, models are tiered, and lineage flows end to end with column-level mappings,
SQL and the Fivetran / dbt / Airflow pipelines that carry it. Hub dimensions fan out to thousands
of consumers, the shape that stresses the lineage map.

    # what would be created, without a server
    ./scripts/lineage_seed/seed_lineage_graph.py plan --assets 2000000

    # create it; re-run the same command after any interruption to resume
    ./scripts/lineage_seed/seed_lineage_graph.py seed --server http://localhost:8585 --assets 2000000

    # delete everything it created
    ./scripts/lineage_seed/seed_lineage_graph.py cleanup --server http://localhost:8585 --yes

Standard library only. See README.md in this directory for sizing and timing.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
from collections.abc import Callable, Iterator
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from catalog import (  # noqa: E402
    DASHBOARD,
    DATA_MODEL,
    LAYER_BY_KEY,
    LAYERS,
    ML_MODEL,
    TABLE,
    TABLE_LAYERS,
    AssetRef,
    Catalog,
)
from client import ApiError, Credentials, OpenMetadataClient, encode_fqn  # noqa: E402
from payloads import Payloads  # noqa: E402

STATE_VERSION = 1
CONTAINER_BATCH = 100
TOPIC_UNIT = 50
LINEAGE_UNIT = 100
PROGRESS_SECONDS = 15
STATE_SAVE_SECONDS = 10
VIEWER_NAME = "lineage_viewer"
VIEWER_PASSWORD = "Lineage#Viewer2026"
VIEWER_EMAIL_DOMAIN = "open-metadata.org"
CONFLICT = 409
SERVICE_COLLECTIONS = (
    "databaseServices",
    "messagingServices",
    "pipelineServices",
    "dashboardServices",
    "mlmodelServices",
)
BULK_PATHS = {
    TABLE: "/v1/tables/bulk",
    DATA_MODEL: "/v1/dashboard/datamodels/bulk",
    DASHBOARD: "/v1/dashboards/bulk",
    ML_MODEL: "/v1/mlmodels/bulk",
}
ASSET_PHASES = ("tables", "topics", "data_models", "dashboards", "ml_models")
BENCHMARK_FOCUS_KEYS = (
    "serviceFqn",
    "databaseFqn",
    "schemaFqn",
    "hubTableFqn",
    "leafTableFqn",
    "hubColumnFqn",
)
PHASES = ("databases", "schemas", "pipelines", *ASSET_PHASES, "lineage")
PHASE_LAYERS = {
    "tables": TABLE_LAYERS,
    "topics": ("stream",),
    "data_models": ("bi_model",),
    "dashboards": ("dashboard",),
    "ml_models": ("ml_model",),
}


# ---------------------------------------------------------------- state and progress


class State:
    """Which units are done, so a re-run resumes instead of re-sending millions of requests."""

    def __init__(self, path: Path, identity: dict[str, Any], fresh: bool) -> None:
        self.path = path
        self.identity = identity
        self.done: dict[str, set[str]] = {}
        self.failures: dict[str, int] = {}
        self._lock = threading.Lock()
        self._saved_at = 0.0
        if path.exists() and not fresh:
            self._load()

    def _load(self) -> None:
        data = json.loads(self.path.read_text())
        if data.get("identity") != self.identity:
            raise SystemExit(
                f"{self.path} belongs to a different seed {data.get('identity')}; "
                "pass --fresh to start over, or a different --state-dir"
            )
        self.done = {phase: set(keys) for phase, keys in data.get("done", {}).items()}
        self.failures = data.get("failures", {})

    def is_done(self, phase: str, key: str) -> bool:
        return key in self.done.get(phase, ())

    def mark(self, phase: str, key: str, failed: int) -> None:
        """A unit with any failure stays pending, so the next run retries just those units."""
        with self._lock:
            if failed:
                self.failures[phase] = self.failures.get(phase, 0) + failed
            else:
                self.done.setdefault(phase, set()).add(key)
        if time.monotonic() - self._saved_at > STATE_SAVE_SECONDS:
            self.save()

    def save(self) -> None:
        with self._lock:
            payload = {
                "version": STATE_VERSION,
                "identity": self.identity,
                "done": {phase: sorted(keys) for phase, keys in self.done.items()},
                "failures": self.failures,
            }
            self._saved_at = time.monotonic()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(payload))
        os.replace(temporary, self.path)


@dataclass
class Progress:
    phase: str
    total_units: int
    total_items: int
    started: float = field(default_factory=time.monotonic)
    units: int = 0
    items: int = 0
    failed: int = 0
    first_error: str | None = None
    lock: threading.Lock = field(default_factory=threading.Lock)

    def add(self, items: int, failed: int, error: str | None) -> None:
        with self.lock:
            self.units += 1
            self.items += items
            self.failed += failed
            self.first_error = self.first_error or error

    def line(self) -> str:
        elapsed = max(1e-6, time.monotonic() - self.started)
        rate = self.items / elapsed
        remaining = (self.total_items - self.items) / rate if rate > 0 else float("inf")
        return (
            f"[{self.phase}] {self.units:,}/{self.total_units:,} units · {self.items:,}/{self.total_items:,} items · "
            f"{rate:,.0f}/s · elapsed {_duration(elapsed)} · ETA {_duration(remaining)}"
            + (f" · {self.failed:,} failed" if self.failed else "")
        )


@dataclass(frozen=True)
class Unit:
    key: str
    items: int
    run: Callable[[], tuple[int, str | None]]


def _duration(seconds: float) -> str:
    if seconds == float("inf"):
        return "?"
    minutes, secs = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours}h{minutes:02d}m" if hours else f"{minutes}m{secs:02d}s"


# ---------------------------------------------------------------- seeding


class Seeder:
    def __init__(
        self, client: OpenMetadataClient, catalog: Catalog, args: argparse.Namespace, state: State
    ) -> None:
        self.client = client
        self.catalog = catalog
        self.args = args
        self.state = state
        self.team_ids: dict[str, str] = {}
        self.pipeline_ids: dict[str, str] = {}
        self.payloads = Payloads(catalog, self.team_ids)

    def run(self) -> None:
        self._preflight()
        self._roots()
        for phase in PHASES:
            if phase in self.args.skip:
                print(f"[{phase}] skipped")
                continue
            self._run_phase(phase, list(self._units(phase)))
        self.state.save()
        write_manifest(self.catalog, self.client, self.args, self.state)

    # ------------------------------------------------------------ preflight and roots

    def _preflight(self) -> None:
        self.client.ensure_authenticated()
        version = self.client.get("/v1/system/version")
        print(f"Connected to OpenMetadata {version.get('version')} at {self.client.ui_root}")
        try:
            self.client.get("/v1/lineage/scene", {"lens": "service", "band": "LAYER", "size": 1})
        except ApiError as error:
            print(
                f"warning: the hierarchical lineage scene API is not available here ({error.status}); "
                "the graph will still load, but the lineage map needs a server built from main"
            )

    def _roots(self) -> None:
        """Teams, domains, data products, services and the viewer user. Idempotent, always run."""
        started = time.monotonic()
        for domain in self.catalog.domains:
            team = self.client.put("/v1/teams", self.payloads.team(domain))
            self.team_ids[domain.name] = team["id"]
        for domain in self.catalog.domains:
            self.client.put("/v1/domains", self.payloads.domain(domain))
        for domain in self.catalog.domains:
            for name, description in domain.data_products:
                self.client.put("/v1/dataProducts", self.payloads.data_product(domain, name, description))
        self._services()
        if not self.args.no_viewer:
            self._viewer()
        print(
            f"[roots] teams, domains, data products and services ready in {_duration(time.monotonic() - started)}"
        )

    def _services(self) -> None:
        domains_by_name = {domain.name: domain for domain in self.catalog.domains}
        for name, engine, description, domain_name in self.catalog.database_services():
            body: dict[str, Any] = {"name": name, "serviceType": engine, "description": description}
            if domain_name is not None:
                body["domains"] = [self.payloads.domain_fqn(domains_by_name[domain_name])]
                body["owners"] = self.payloads.owners(domains_by_name[domain_name])
            self.client.put("/v1/services/databaseServices", body)
        for collection, name, kind, description in self.catalog.other_services():
            self.client.put(
                f"/v1/services/{collection}", {"name": name, "serviceType": kind, "description": description}
            )

    def _viewer(self) -> None:
        body = {
            "name": VIEWER_NAME,
            "email": f"{VIEWER_NAME.replace('_', '.')}@{VIEWER_EMAIL_DOMAIN}",
            "displayName": "Lineage Viewer",
            "description": "Non-admin user for checking the lineage map: its root scene skips the admin cache.",
            "password": VIEWER_PASSWORD,
            "confirmPassword": VIEWER_PASSWORD,
            "createPasswordType": "ADMIN_CREATE",
        }
        try:
            # POST, not PUT: only the create path applies an admin-chosen password.
            self.client.request("POST", "/v1/users", body=body)
        except ApiError as error:
            if error.status != CONFLICT:
                print(f"warning: could not create the non-admin viewer user ({error}); continuing")

    # ------------------------------------------------------------ phases

    def _run_phase(self, phase: str, units: list[Unit]) -> None:
        pending = [unit for unit in units if not self.state.is_done(phase, unit.key)]
        progress = Progress(phase, len(pending), sum(unit.items for unit in pending))
        if not pending:
            print(f"[{phase}] already complete")
            return
        if phase == "lineage":
            self._load_pipeline_ids()
        workers = self.args.edge_workers if phase == "lineage" else self.args.workers
        print(f"[{phase}] {len(pending):,} units, {progress.total_items:,} items, {workers} workers")
        stop = threading.Event()
        reporter = threading.Thread(target=_report, args=(progress, stop), daemon=True)
        reporter.start()
        try:
            _execute(pending, workers, lambda unit, result: self._finish(phase, unit, result, progress))
        finally:
            stop.set()
            self.state.save()
        print(progress.line() + " · done")
        if progress.first_error:
            print(f"[{phase}] first failure: {progress.first_error}")

    def _finish(self, phase: str, unit: Unit, result: tuple[int, str | None], progress: Progress) -> None:
        failed, error = result
        self.state.mark(phase, unit.key, failed)
        progress.add(unit.items, failed, error)

    def _units(self, phase: str) -> Iterator[Unit]:
        if phase == "databases":
            yield from self._container_units("databases", self._database_bodies(), "/v1/databases/bulk")
        elif phase == "schemas":
            yield from self._container_units("schemas", self._schema_bodies(), "/v1/databaseSchemas/bulk")
        elif phase == "pipelines":
            yield Unit("pipelines", len(self.catalog.pipelines()), self._create_pipelines)
        elif phase == "topics":
            yield from self._topic_units()
        elif phase == "lineage":
            yield from self._lineage_units()
        else:
            yield from self._asset_units(phase)

    def _database_bodies(self) -> list[dict[str, Any]]:
        by_service = {name: domain for name, _, _, domain in self.catalog.database_services()}
        domains = {domain.name: domain for domain in self.catalog.domains}
        return [
            self.payloads.database(service, database, text, domains.get(by_service.get(service) or ""))
            for service, database, text in self.catalog.databases()
        ]

    def _schema_bodies(self) -> list[dict[str, Any]]:
        return [
            self.payloads.schema(service, database, schema, self.catalog.domains[domain], layer)
            for service, database, schema, domain, layer in self.catalog.schemas()
        ]

    def _container_units(self, name: str, bodies: list[dict[str, Any]], path: str) -> Iterator[Unit]:
        for start in range(0, len(bodies), CONTAINER_BATCH):
            batch = bodies[start : start + CONTAINER_BATCH]
            yield Unit(f"{name}/{start}", len(batch), lambda batch=batch: self._bulk(path, batch))

    def _asset_units(self, phase: str) -> Iterator[Unit]:
        for layer, domain, start, end in self._ranges(PHASE_LAYERS[phase], self.args.batch_size):
            yield Unit(
                f"{layer}/{domain}/{start}",
                end - start,
                lambda span=(layer, domain, start, end): self._create_assets(*span),
            )

    def _ranges(self, layers: tuple[str, ...], size: int) -> Iterator[tuple[str, int, int, int]]:
        """(layer, domain, start, end) slices — units hold these, not millions of AssetRefs."""
        for layer in layers:
            for domain in range(len(self.catalog.domains)):
                count = self.catalog.count(layer, domain)
                for start in range(0, count, size):
                    yield layer, domain, start, min(count, start + size)

    def _create_assets(self, layer: str, domain: int, start: int, end: int) -> tuple[int, str | None]:
        entity_type = LAYER_BY_KEY[layer].entity_type
        builder = {
            TABLE: self.payloads.table,
            DATA_MODEL: self.payloads.data_model,
            DASHBOARD: self.payloads.dashboard,
            ML_MODEL: self.payloads.ml_model,
        }[entity_type]
        bodies = [builder(AssetRef(layer, domain, index)) for index in range(start, end)]
        return self._bulk(BULK_PATHS[entity_type], bodies)

    def _bulk(self, path: str, bodies: list[dict[str, Any]]) -> tuple[int, str | None]:
        try:
            result = self.client.put(path, bodies) or {}
        except ApiError as error:
            return len(bodies), str(error)
        failed = int(result.get("numberOfRowsFailed") or 0)
        failures = result.get("failedRequest") or []
        message = failures[0].get("message") if failures else None
        return failed, (f"{path}: {message}" if message else None)

    def _topic_units(self) -> Iterator[Unit]:
        for layer, domain, start, end in self._ranges(("stream",), TOPIC_UNIT):
            yield Unit(
                f"{layer}/{domain}/{start}",
                end - start,
                lambda span=(domain, start, end): self._create_topics(*span),
            )

    def _create_topics(self, domain: int, start: int, end: int) -> tuple[int, str | None]:
        """Topics have no bulk endpoint, so one PUT each."""
        refs = [AssetRef("stream", domain, index) for index in range(start, end)]
        return _each(refs, lambda ref: self.client.put("/v1/topics", self.payloads.topic(ref)))

    def _create_pipelines(self) -> tuple[int, str | None]:
        domains = {domain.name: domain for domain in self.catalog.domains}
        bodies = [
            self.payloads.pipeline(service, name, description, domains[domain])
            for service, name, description, domain in self.catalog.pipelines()
        ]
        return self._bulk("/v1/pipelines/bulk", bodies)

    def _load_pipeline_ids(self) -> None:
        """Edge carriers are referenced by id, so read back what the pipelines phase created."""
        for service_key in ("fivetran", "dbt_cloud", "airflow_prod"):
            service = self.catalog.service_name(service_key)
            after = None
            while True:
                query = {"service": service, "limit": 1000, **({"after": after} if after else {})}
                page = self.client.get("/v1/pipelines", query)
                for pipeline in page.get("data", []):
                    self.pipeline_ids[pipeline["fullyQualifiedName"]] = pipeline["id"]
                after = page.get("paging", {}).get("after")
                if not after:
                    break

    def _lineage_units(self) -> Iterator[Unit]:
        """Round-robin over (layer, domain) slices, so concurrent units write different service
        and data-product edges instead of queueing on the same refcount rows."""
        downstream_layers = tuple(layer.key for layer in LAYERS if layer.key != "source")
        for layer, domain, start, end in _interleaved(self._ranges(downstream_layers, LINEAGE_UNIT)):
            edges = sum(
                len(self.catalog.upstreams(AssetRef(layer, domain, index))) for index in range(start, end)
            )
            yield Unit(
                f"{layer}/{domain}/{start}",
                edges,
                lambda span=(layer, domain, start, end): self._create_edges(*span),
            )

    def _create_edges(self, layer: str, domain: int, start: int, end: int) -> tuple[int, str | None]:
        edges = [
            edge for index in range(start, end) for edge in self.catalog.edges(AssetRef(layer, domain, index))
        ]
        return _each(edges, self._put_edge)

    def _put_edge(self, edge) -> None:
        upstream = self.catalog.placement(edge.upstream)
        downstream = self.catalog.placement(edge.downstream)
        path = (
            f"/v1/lineage/{LAYER_BY_KEY[edge.upstream.layer].entity_type}/name/{encode_fqn(upstream.fqn)}"
            f"/{LAYER_BY_KEY[edge.downstream.layer].entity_type}/name/{encode_fqn(downstream.fqn)}"
        )
        self.client.put(path, self.payloads.lineage_details(edge, self.pipeline_ids))


def _interleaved(spans: Iterator[tuple[str, int, int, int]]) -> list[tuple[str, int, int, int]]:
    groups: dict[tuple[str, int], list[tuple[str, int, int, int]]] = {}
    for span in spans:
        groups.setdefault(span[:2], []).append(span)
    order = []
    queues = list(groups.values())
    while queues:
        order.extend(queue.pop(0) for queue in queues)
        queues = [queue for queue in queues if queue]
    return order


def _each(items: list[Any], action: Callable[[Any], Any]) -> tuple[int, str | None]:
    failed = 0
    first_error = None
    for item in items:
        try:
            action(item)
        except ApiError as error:
            failed += 1
            first_error = first_error or str(error)
    return failed, first_error


def _execute(
    units: list[Unit], workers: int, on_done: Callable[[Unit, tuple[int, str | None]], None]
) -> None:
    """Runs units with at most 2x`workers` in flight, so payloads are built just in time."""
    queue = iter(units)
    in_flight: dict[Future, Unit] = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for unit in queue:
            in_flight[pool.submit(unit.run)] = unit
            if len(in_flight) >= workers * 2:
                break
        while in_flight:
            finished, _ = wait(in_flight, return_when=FIRST_COMPLETED)
            for future in finished:
                unit = in_flight.pop(future)
                on_done(unit, future.result())
                following = next(queue, None)
                if following is not None:
                    in_flight[pool.submit(following.run)] = following


def _report(progress: Progress, stop: threading.Event) -> None:
    while not stop.wait(PROGRESS_SECONDS):
        print(progress.line(), flush=True)


# ---------------------------------------------------------------- plan, manifest, cleanup


def plan(catalog: Catalog, sample_every: int) -> dict[str, Any]:
    """Counts of what `seed` would create. Edges are estimated from every `sample_every`-th asset."""
    layers = {layer.key: catalog.layer_total(layer.key) for layer in LAYERS}
    edges = 0
    column_mappings = 0
    for layer in LAYERS:
        for domain in range(len(catalog.domains)):
            for index in range(0, catalog.count(layer.key, domain), sample_every):
                for edge in catalog.edges(AssetRef(layer.key, domain, index)):
                    edges += sample_every
                    column_mappings += sample_every * len(catalog.column_lineage(edge))
    return {
        "assets": sum(layers.values()),
        "byLayer": layers,
        "tables": sum(layers[key] for key in TABLE_LAYERS),
        "services": len(catalog.database_services()) + len(catalog.other_services()),
        "databases": len(catalog.databases()),
        "schemas": len(catalog.schemas()),
        "pipelines": len(catalog.pipelines()),
        "domains": len(catalog.domains),
        "dataProducts": sum(len(domain.data_products) for domain in catalog.domains),
        "edgesEstimate": edges,
        "columnMappingsEstimate": column_mappings,
    }


def focus_points(catalog: Catalog) -> dict[str, str]:
    """Named assets worth opening first: the busiest hub, a deep leaf, and their containers.

    The keys up to hubColumnFqn are the ones LineageScenePerformanceScaleIT focuses on when
    attached to this graph with -Djpw.lineage.seedManifest.
    """
    hub = AssetRef("core", 0, 0)
    hub_placement = catalog.placement(hub)
    # The newest mart is the one the skewed upstream picks reach last: the likeliest table leaf.
    leaf_table = AssetRef("mart", 0, catalog.count("mart", 0) - 1)
    leaf_dashboard = AssetRef("dashboard", 0, max(0, catalog.count("dashboard", 0) - 1))
    return {
        "serviceFqn": hub_placement.service,
        "databaseFqn": f"{hub_placement.service}.{hub_placement.database}",
        "schemaFqn": hub_placement.container_fqn,
        "hubTableFqn": hub_placement.fqn,
        "leafTableFqn": catalog.placement(leaf_table).fqn,
        "hubColumnFqn": f"{hub_placement.fqn}.{catalog.columns(hub)[0].name}",
        "leafDashboardFqn": catalog.placement(leaf_dashboard).fqn,
        "sourceTableFqn": catalog.placement(AssetRef("source", 0, 0)).fqn,
    }


def benchmark_section(catalog: Catalog, focus: dict[str, str]) -> dict[str, Any]:
    """What LineageScenePerformanceScaleIT needs to benchmark this graph instead of seeding one."""
    counts = plan(catalog, sample_every=50)
    edges = sum(
        len(catalog.upstreams(AssetRef(layer.key, domain, index)))
        for layer in LAYERS
        if layer.key != "source"
        for domain in range(len(catalog.domains))
        for index in range(catalog.count(layer.key, domain))
    )
    return {
        "cohortFqnPrefix": f"{catalog.prefix}_",
        "services": counts["services"],
        "databases": counts["databases"],
        "schemas": counts["schemas"],
        "tables": counts["tables"],
        "edges": edges,
        "columnEdges": counts["edgesEstimate"],
        "focus": {key: focus[key] for key in BENCHMARK_FOCUS_KEYS},
    }


def write_manifest(
    catalog: Catalog, client: OpenMetadataClient, args: argparse.Namespace, state: State
) -> None:
    focus = focus_points(catalog)
    ui = client.ui_root
    manifest = {
        "identity": state.identity,
        "server": ui,
        "failures": state.failures,
        "focus": focus,
        "benchmark": benchmark_section(catalog, focus),
        "open": {
            "platformLineage": f"{ui}/lineage",
            "hubOnPlatformLineage": f"{ui}/lineage/table/{encode_fqn(focus['hubTableFqn'])}",
            "hubLineageTab": f"{ui}/table/{encode_fqn(focus['hubTableFqn'])}/lineage",
            "leafDashboard": f"{ui}/dashboard/{encode_fqn(focus['leafDashboardFqn'])}/lineage",
        },
        "viewer": None
        if args.no_viewer
        else {"email": f"{VIEWER_NAME.replace('_', '.')}@{VIEWER_EMAIL_DOMAIN}", "password": VIEWER_PASSWORD},
    }
    target = Path(args.state_dir) / "manifest.json"
    target.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"\nManifest: {target}")
    for label, url in manifest["open"].items():
        print(f"  {label:22} {url}")
    if manifest["viewer"]:
        print(f"  non-admin login        {manifest['viewer']['email']} / {VIEWER_PASSWORD}")
    if state.failures:
        print(
            f"  failures by phase      {state.failures} (re-run the same command to retry the failed units)"
        )


def cleanup(client: OpenMetadataClient, catalog: Catalog, confirmed: bool) -> None:
    targets = [(f"/v1/services/{collection}", name) for collection, name in _all_services(catalog)]
    targets += [
        ("/v1/dataProducts", catalog.service_name(name))
        for domain in catalog.domains
        for name, _ in domain.data_products
    ]
    targets += [("/v1/domains", catalog.service_name(domain.name)) for domain in catalog.domains]
    targets += [("/v1/teams", catalog.service_name(f"{domain.name}_team")) for domain in catalog.domains]
    targets.append(("/v1/users", VIEWER_NAME))
    if not confirmed:
        print("Would hard-delete (pass --yes to do it):")
        for path, name in targets:
            print(f"  {path}/name/{name}")
        return
    client.ensure_authenticated()
    for path, name in targets:
        try:
            client.delete(f"{path}/name/{encode_fqn(name)}", {"hardDelete": "true", "recursive": "true"})
            print(f"deleted {path}/name/{name}")
        except ApiError as error:
            if error.status != 404:
                print(f"warning: {error}")


def _all_services(catalog: Catalog) -> list[tuple[str, str]]:
    services = [("databaseServices", name) for name, _, _, _ in catalog.database_services()]
    services += [(collection, name) for collection, name, _, _ in catalog.other_services()]
    return services


# ---------------------------------------------------------------- cli


def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("plan", "seed", "cleanup"):
        command = commands.add_parser(name)
        command.add_argument(
            "--assets", type=int, default=2_000_000, help="data assets to create (default 2M)"
        )
        command.add_argument("--prefix", default="acme", help="prefix of every service, domain and team name")
        command.add_argument(
            "--seed", type=int, default=32050, help="the graph is identical for the same seed"
        )
        if name == "plan":
            command.add_argument("--sample-every", type=int, default=50, help="edge estimate sampling stride")
            continue
        command.add_argument("--server", default=os.environ.get("OM_SERVER", "http://localhost:8585"))
        command.add_argument(
            "--token", default=os.environ.get("OM_TOKEN"), help="JWT, e.g. the ingestion-bot token"
        )
        command.add_argument("--email", default=os.environ.get("OM_EMAIL", "admin@open-metadata.org"))
        command.add_argument("--password", default=os.environ.get("OM_PASSWORD", "admin"))
        if name == "cleanup":
            command.add_argument("--yes", action="store_true", help="really delete")
            continue
        command.add_argument("--workers", type=int, default=16, help="parallel bulk requests (default 16)")
        command.add_argument(
            "--edge-workers", type=int, default=48, help="parallel lineage PUTs (default 48)"
        )
        command.add_argument(
            "--batch-size", type=int, default=100, help="assets per bulk request (default 100)"
        )
        command.add_argument(
            "--state-dir", default=None, help="resume state + manifest (default ~/.cache/...)"
        )
        command.add_argument(
            "--fresh", action="store_true", help="ignore saved progress and send everything again"
        )
        command.add_argument(
            "--skip", action="append", default=[], choices=PHASES, help="skip a phase; repeatable"
        )
        command.add_argument(
            "--no-viewer", action="store_true", help="do not create the non-admin viewer user"
        )
    args = parser.parse_args(argv)
    if getattr(args, "state_dir", "unset") is None:
        args.state_dir = str(
            Path.home() / ".cache" / "openmetadata-lineage-seed" / f"{args.prefix}-{args.assets}-{args.seed}"
        )
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    catalog = Catalog(args.assets, args.prefix, args.seed)
    if args.command == "plan":
        print(json.dumps(plan(catalog, args.sample_every), indent=2))
        return 0
    credentials = Credentials(token=args.token, email=args.email, password=args.password)
    client = OpenMetadataClient(args.server, credentials)
    if args.command == "cleanup":
        cleanup(client, catalog, args.yes)
        return 0
    identity = {"assets": args.assets, "prefix": args.prefix, "seed": args.seed, "server": client.ui_root}
    state = State(Path(args.state_dir) / "state.json", identity, args.fresh)
    try:
        Seeder(client, catalog, args, state).run()
    except KeyboardInterrupt:
        state.save()
        print("\nInterrupted. Progress is saved; re-run the same command to resume.")
        return 130
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(line_buffering=True)
    raise SystemExit(main())
