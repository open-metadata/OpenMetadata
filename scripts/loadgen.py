#!/usr/bin/env python3
#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Configurable bulk load generator for OpenMetadata. Designed for performance and
soak testing on large instances — produces a realistic mix of asset types with
inline enrichment (tags, certification, glossary terms), domain assignment,
data quality test cases, and incidents at various lifecycle stages.

Key design decisions vs. the older per-entity scripts:

1. **Bulk endpoints** — uses ``PUT /{entity}/bulk`` where available (tables,
   containers, pipelines, charts, dashboard/datamodels, databases,
   databaseSchemas, apiCollections, apiEndpoints, storedProcedures). One HTTP
   call writes 100-200 entities, one ChangeEvent per batch, one search bulk
   request. Roughly 5-10x throughput vs. single PUTs.

2. **Inline enrichment** — tags, certification, and glossary terms ride in the
   initial create body. No follow-up PATCH wave. The PATCH-per-entity pattern
   in earlier scripts saturated the search bulk pipeline; inline avoids that.

3. **Bulk domain/dataProduct assignment** — uses
   ``PUT /domains/{name}/assets/add`` with a batch of entity references after
   creation. One call per domain instead of per-entity PATCHes.

4. **Adaptive throttling** — monitors 5xx and timeout rate over a sliding
   window. If failure rate > ``--max-error-rate``, halves concurrency for
   ``--backoff-seconds`` and resumes. Prevents the death spiral where client
   retries pile on top of an already-saturated server.

5. **Configurable distribution** — ``--total N --mix tables:0.55,...`` derives
   per-entity counts from a single target. Defaults sum to 1.0 and span the
   main entity types.

Usage::

    python scripts/loadgen.py --server http://localhost:8585/api --token "$JWT" \\
        --total 500000 --include-tests 0.05

    # Custom mix:
    python scripts/loadgen.py --total 1000000 \\
        --mix tables:0.5,containers:0.25,topics:0.05,dashboards:0.05,\\
              pipelines:0.05,dashboardDataModels:0.05,mlmodels:0.025,charts:0.025 \\
        --enrich-inline tag-pct:0.1,cert-pct:0.05,glossary-pct:0.05 \\
        --bulk-size 150 --concurrency 12

    # Username/password auth (uses login flow):
    python scripts/loadgen.py --server http://localhost:8585/api \\
        --email admin@open-metadata.org --password admin --total 100000

The script is idempotent: re-running with the same ``--prefix`` upserts and
will not duplicate. Bump ``--prefix`` for an independent dataset.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import random
import sys
import time
from collections import Counter, deque
from dataclasses import dataclass, field
from typing import Any

try:
    import aiohttp
except ImportError:
    print("aiohttp is required: pip install aiohttp", file=sys.stderr)
    sys.exit(1)


# ---------- Configuration ----------


# Bulk-capable entity types and their endpoint paths.
BULK_ENDPOINTS: dict[str, str] = {
    "tables": "/tables/bulk",
    "containers": "/containers/bulk",
    "topics": None,  # No bulk; uses single PUT
    "dashboards": None,
    "pipelines": "/pipelines/bulk",
    "charts": "/charts/bulk",
    "dashboardDataModels": "/dashboard/datamodels/bulk",
    "mlmodels": None,
    "searchIndexes": None,
    "apiEndpoints": "/apiEndpoints/bulk",
    "storedProcedures": "/storedProcedures/bulk",
}

# Single-PUT (non-bulk) endpoints for entity types missing /bulk
SINGLE_ENDPOINTS: dict[str, str] = {
    "topics": "/topics",
    "dashboards": "/dashboards",
    "mlmodels": "/mlmodels",
    "searchIndexes": "/searchIndexes",
    "tables": "/tables",
    "containers": "/containers",
    "pipelines": "/pipelines",
    "charts": "/charts",
    "dashboardDataModels": "/dashboard/datamodels",
    "apiEndpoints": "/apiEndpoints",
    "storedProcedures": "/storedProcedures",
}

# Bulk endpoints accept a raw JSON array of create requests (no wrapper object).
# Kept here for clarity; previously this map wrapped the body which the server
# rejected with HTTP 400.

# Default volume distribution — sums to 1.0.
DEFAULT_MIX: dict[str, float] = {
    "tables": 0.55,
    "containers": 0.15,
    "topics": 0.05,
    "dashboards": 0.04,
    "pipelines": 0.04,
    "dashboardDataModels": 0.04,
    "mlmodels": 0.03,
    "charts": 0.04,
    "searchIndexes": 0.03,
    "apiEndpoints": 0.02,
    "storedProcedures": 0.01,
}

DEFAULT_ENRICH = {
    "tag-pct": 0.10,
    "cert-pct": 0.05,
    "glossary-pct": 0.05,
}

COL_TYPES = ["INT", "BIGINT", "VARCHAR", "STRING", "DOUBLE", "BOOLEAN", "DATE", "TIMESTAMP", "DECIMAL", "FLOAT"]
TIER_TAGS = ["Tier.Tier1", "Tier.Tier2", "Tier.Tier3"]
CERT_TAGS = ["Certification.Gold", "Certification.Silver", "Certification.Bronze"]
PII_TAGS = ["PII.Sensitive", "PII.NonSensitive"]
DOMAIN_TYPES = ["Source-aligned", "Consumer-aligned", "Aggregate"]
FAILURE_REASONS = ["FalsePositive", "MissingData", "Duplicates", "OutOfBounds", "Other"]
SEVERITIES = ["Severity1", "Severity2", "Severity3", "Severity4", "Severity5"]


@dataclass
class Config:
    server: str
    token_file: str
    email: str | None
    password: str | None
    total: int
    mix: dict[str, float]
    enrich: dict[str, float]
    bulk_domain_pct: float
    include_tests_pct: float
    failed_fraction: float
    bulk_size: int
    concurrency: int
    max_error_rate: float
    backoff_seconds: int
    prefix: str
    domains: int
    glossaries: int
    terms_per_glossary: int
    data_products_per_domain: int
    seed: int


# ---------- Throttle + client ----------


class AdaptiveThrottle:
    """Sliding-window 5xx/timeout rate detector. Halves concurrency on breach."""

    def __init__(self, max_error_rate: float, backoff_seconds: int, window: int = 200):
        self.max_error_rate = max_error_rate
        self.backoff_seconds = backoff_seconds
        self.outcomes: deque[bool] = deque(maxlen=window)  # True == error
        self.cooldown_until: float = 0.0

    def record(self, is_error: bool):
        self.outcomes.append(is_error)

    def should_backoff(self) -> tuple[bool, float]:
        now = time.time()
        if now < self.cooldown_until:
            return True, self.cooldown_until - now
        if len(self.outcomes) < 50:
            return False, 0.0
        err_rate = sum(self.outcomes) / len(self.outcomes)
        if err_rate > self.max_error_rate:
            self.cooldown_until = now + self.backoff_seconds
            self.outcomes.clear()
            return True, float(self.backoff_seconds)
        return False, 0.0


class Client:
    """Async HTTP client with token refresh + adaptive throttling."""

    def __init__(self, cfg: Config, session: aiohttp.ClientSession, throttle: AdaptiveThrottle):
        self.cfg = cfg
        self.session = session
        self.throttle = throttle
        self.stats: Counter[str] = Counter()
        self._token_cache: str | None = None
        self._token_cached_at: float = 0.0

    def _read_token(self) -> str:
        # Re-read from file each call so external refresher can rotate it.
        # Cache for 30s to avoid file IO on every request.
        now = time.time()
        if self._token_cache and (now - self._token_cached_at) < 30:
            return self._token_cache
        try:
            with open(self.cfg.token_file) as fh:
                self._token_cache = fh.read().strip()
                self._token_cached_at = now
                return self._token_cache
        except FileNotFoundError:
            return ""

    def _headers(self, json_patch: bool = False) -> dict:
        ctype = "application/json-patch+json" if json_patch else "application/json"
        return {
            "Authorization": f"Bearer {self._read_token()}",
            "Content-Type": ctype,
        }

    async def request(
        self,
        method: str,
        path: str,
        body: Any = None,
        expected: tuple[int, ...] = (200, 201, 202, 409),
        json_patch: bool = False,
        retries: int = 2,
    ) -> dict | None:
        url = f"{self.cfg.server.rstrip('/')}/v1{path}"
        for attempt in range(retries + 1):
            backoff, wait = self.throttle.should_backoff()
            if backoff:
                await asyncio.sleep(min(wait, self.cfg.backoff_seconds))
            try:
                async with self.session.request(
                    method, url, json=body, headers=self._headers(json_patch=json_patch)
                ) as resp:
                    key = f"{method}_{resp.status}"
                    self.stats[key] += 1
                    is_err = resp.status >= 500
                    self.throttle.record(is_err)
                    if resp.status in expected:
                        ctype = resp.headers.get("Content-Type", "")
                        if "json" in ctype:
                            try:
                                return await resp.json()
                            except Exception:
                                return {}
                        await resp.read()
                        return {}
                    text = await resp.text()
                    errkey = f"err_{key}_logged"
                    if self.stats[errkey] < 3:
                        self.stats[errkey] += 1
                        print(
                            f"  ! {method} {path} -> {resp.status}: {text[:200]}",
                            file=sys.stderr,
                        )
                    # 5xx → retry with exponential backoff
                    if is_err and attempt < retries:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    return None
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                self.stats[f"{method}_EXC"] += 1
                self.throttle.record(True)
                if attempt < retries:
                    await asyncio.sleep(2 ** attempt)
                    continue
                return None
        return None

    async def get(self, path: str):
        return await self.request("GET", path)

    async def put(self, path: str, body):
        return await self.request("PUT", path, body)

    async def post(self, path: str, body):
        return await self.request("POST", path, body)

    async def patch(self, path: str, body):
        return await self.request("PATCH", path, body, json_patch=True)


async def gather_bounded(client: Client, coros, label: str, batch: int = 200) -> list:
    """Run coroutines with bounded concurrency + periodic progress."""
    sem = asyncio.Semaphore(client.cfg.concurrency)

    async def wrap(c):
        async with sem:
            return await c

    wrapped = [wrap(c) for c in coros]
    total = len(wrapped)
    done = 0
    results: list = []
    t0 = time.time()
    log_every = max(1, batch * 5)
    last_log = 0
    for i in range(0, total, batch):
        chunk = wrapped[i : i + batch]
        rs = await asyncio.gather(*chunk)
        results.extend(rs)
        done += len(chunk)
        if done - last_log >= log_every or done == total:
            elapsed = time.time() - t0
            rate = done / max(elapsed, 0.01)
            print(
                f"  [{label}] {done}/{total}  ({rate:.0f}/s)  elapsed={elapsed:.1f}s",
                flush=True,
            )
            last_log = done
    return results


# ---------- Token bootstrap ----------


async def login_and_save_token(cfg: Config):
    """If --email + --password given, exchange them for a token and write to token_file."""
    if not (cfg.email and cfg.password):
        return
    url = f"{cfg.server.rstrip('/')}/v1/users/login"
    # OM expects base64-encoded password
    body = {"email": cfg.email, "password": base64.b64encode(cfg.password.encode()).decode()}
    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(url, json=body) as resp:
            if resp.status != 200:
                print(
                    f"Login failed: {resp.status} {await resp.text()[:200]}",
                    file=sys.stderr,
                )
                sys.exit(2)
            data = await resp.json()
            token = data.get("accessToken")
            if not token:
                print("Login returned no accessToken", file=sys.stderr)
                sys.exit(2)
            with open(cfg.token_file, "w") as fh:
                fh.write(token)
            print(f"Token written to {cfg.token_file}")


# ---------- Distribution planning ----------


def plan_volumes(cfg: Config) -> dict[str, int]:
    """Translate total + mix into per-entity counts. Validates mix sums to ~1.0."""
    total = sum(cfg.mix.values())
    if abs(total - 1.0) > 0.01:
        print(f"Warning: mix sums to {total:.3f}, normalizing", file=sys.stderr)
        cfg.mix = {k: v / total for k, v in cfg.mix.items()}
    plan = {k: max(1, int(cfg.total * v)) for k, v in cfg.mix.items()}
    print("\n=== Volume plan ===")
    for k, v in sorted(plan.items(), key=lambda kv: -kv[1]):
        print(f"  {k:30s} {v:>9,}")
    print(f"  {'TOTAL':30s} {sum(plan.values()):>9,}")
    return plan


# ---------- Tag/cert/glossary inlining ----------


def maybe_tag_label(tag_fqn: str, source: str = "Classification") -> dict:
    return {"tagFQN": tag_fqn, "source": source, "labelType": "Manual", "state": "Confirmed"}


def build_inline_tags(
    cfg: Config, glossary_terms: list[str], idx: int
) -> list[dict] | None:
    """Decide tags to include in the initial create body. ``CreateTable`` and
    siblings accept ``tags`` inline (Tier/PII/Glossary). Certification is NOT
    accepted on create — applied post-hoc in :func:`apply_certifications`.

    Deterministic by ``idx`` so re-runs hit the same entities."""
    rng = random.Random(cfg.seed + idx)
    tags: list[dict] = []
    if rng.random() < cfg.enrich.get("tag-pct", 0.0):
        tags.append(maybe_tag_label(rng.choice(TIER_TAGS)))
        tags.append(maybe_tag_label(rng.choice(PII_TAGS)))
    if glossary_terms and rng.random() < cfg.enrich.get("glossary-pct", 0.0):
        tags.append(maybe_tag_label(rng.choice(glossary_terms), source="Glossary"))
    return tags or None


def rand_columns(idx: int, seed: int) -> list[dict]:
    rng = random.Random(seed + idx)
    n = rng.randint(5, 50)
    return [
        {"name": f"col_{i}", "dataType": rng.choice(COL_TYPES), "dataLength": 50}
        for i in range(n)
    ]


# ---------- Phase implementations ----------


async def create_services(client: Client, cfg: Config) -> dict[str, list[str]]:
    """Create one service per entity type. Returns map of type -> [service names]."""
    print("\n=== Phase 1: Services ===")
    svcs: dict[str, list[str]] = {}

    async def ps(path, body, kind):
        r = await client.put(path, body)
        svcs.setdefault(kind, []).append(body["name"])

    tasks = []
    p = cfg.prefix
    # 1 of each: enough to host the volume; bump if testing per-service throttling
    tasks.append(ps("/services/databaseServices", {
        "name": f"{p}_db_svc",
        "serviceType": "Mysql",
        "connection": {"config": {"type": "Mysql", "scheme": "mysql+pymysql",
                                  "username": "x", "authType": {"password": "x"},
                                  "hostPort": "h:3306"}},
    }, "database"))
    tasks.append(ps("/services/storageServices", {
        "name": f"{p}_storage_svc",
        "serviceType": "S3",
        "connection": {"config": {"type": "S3", "awsConfig": {"awsRegion": "us-east-1"}}},
    }, "storage"))
    tasks.append(ps("/services/messagingServices", {
        "name": f"{p}_msg_svc",
        "serviceType": "Kafka",
        "connection": {"config": {"type": "Kafka", "bootstrapServers": "h:9092"}},
    }, "messaging"))
    tasks.append(ps("/services/dashboardServices", {
        "name": f"{p}_dash_svc",
        "serviceType": "CustomDashboard",
        "connection": {"config": {"type": "CustomDashboard",
                                  "sourcePythonClass": "metadata.ingestion.source.dashboard.custom_dashboard.CustomDashboardSource"}},
    }, "dashboard"))
    tasks.append(ps("/services/pipelineServices", {
        "name": f"{p}_pipe_svc",
        "serviceType": "CustomPipeline",
        "connection": {"config": {"type": "CustomPipeline",
                                  "sourcePythonClass": "metadata.ingestion.source.pipeline.custom_pipeline.CustomPipelineSource"}},
    }, "pipeline"))
    tasks.append(ps("/services/mlmodelServices", {
        "name": f"{p}_ml_svc",
        "serviceType": "CustomMlModel",
        "connection": {"config": {"type": "CustomMlModel",
                                  "sourcePythonClass": "metadata.ingestion.source.mlmodel.custom_mlmodel.CustomMlModelSource"}},
    }, "mlmodel"))
    tasks.append(ps("/services/searchServices", {
        "name": f"{p}_search_svc",
        "serviceType": "ElasticSearch",
        "connection": {"config": {"type": "ElasticSearch", "hostPort": "http://h:9200"}},
    }, "search"))
    tasks.append(ps("/services/apiServices", {
        "name": f"{p}_api_svc",
        "serviceType": "Rest",
        "connection": {"config": {"type": "Rest",
                                  "openAPISchemaConnection": {"openAPISchemaURL": "http://h/openapi.json"}}},
    }, "api"))
    await asyncio.gather(*tasks)
    return svcs


async def create_governance(client: Client, cfg: Config) -> tuple[list[str], list[str], list[str]]:
    """Create domains, data products, glossaries+terms. Returns (domains, dp_fqns, term_fqns)."""
    print("\n=== Phase 2: Domains + Data Products + Glossaries ===")
    domains: list[str] = []
    coros = []
    for i in range(cfg.domains):
        name = f"{cfg.prefix}_domain_{i}"
        domains.append(name)
        coros.append(client.put("/domains", {
            "name": name,
            "description": f"Auto domain {i}",
            "domainType": random.choice(DOMAIN_TYPES),
        }))
    await gather_bounded(client, coros, "domains", batch=50)

    dp_fqns: list[str] = []
    dp_coros = []
    for d in domains:
        for j in range(cfg.data_products_per_domain):
            name = f"dp_{j}"
            dp_fqns.append(f"{d}.{name}")
            dp_coros.append(client.put("/dataProducts", {
                "name": name,
                "description": f"Data product {j}",
                "domains": [d],
            }))
    await gather_bounded(client, dp_coros, "dataProducts", batch=100)

    g_coros = []
    glossaries = []
    for i in range(cfg.glossaries):
        name = f"{cfg.prefix}_glossary_{i}"
        glossaries.append(name)
        g_coros.append(client.put("/glossaries", {
            "name": name, "description": f"Auto glossary {i}",
        }))
    await gather_bounded(client, g_coros, "glossaries", batch=50)

    t_coros = []
    term_fqns: list[str] = []
    for g in glossaries:
        for j in range(cfg.terms_per_glossary):
            name = f"term_{j}"
            term_fqns.append(f"{g}.{name}")
            t_coros.append(client.put("/glossaryTerms", {
                "name": name, "description": f"Term {j}", "glossary": g,
            }))
    await gather_bounded(client, t_coros, "glossaryTerms", batch=200)
    return domains, dp_fqns, term_fqns


async def create_db_hierarchy(
    client: Client, cfg: Config, svc: str, total_tables: int
) -> list[tuple[str, list[str]]]:
    """Create databases + schemas sized to hold ``total_tables``.

    Returns list of (schema_fqn, [table_name, ...]) for downstream bulk creation.
    """
    if total_tables <= 0:
        return []
    # Distribute: aim for ~2000 tables per schema, 10 schemas per DB.
    target_per_schema = 2000
    schemas_needed = max(1, (total_tables + target_per_schema - 1) // target_per_schema)
    schemas_per_db = 10
    dbs_needed = max(1, (schemas_needed + schemas_per_db - 1) // schemas_per_db)

    db_coros = []
    for d in range(dbs_needed):
        db_coros.append(client.put("/databases", {"name": f"db_{d}", "service": svc}))
    await gather_bounded(client, db_coros, "databases", batch=50)

    schema_coros = []
    schema_fqns: list[str] = []
    for d in range(dbs_needed):
        for k in range(schemas_per_db):
            if len(schema_fqns) >= schemas_needed:
                break
            schema_fqns.append(f"{svc}.db_{d}.schema_{k}")
            schema_coros.append(client.put("/databaseSchemas", {
                "name": f"schema_{k}", "database": f"{svc}.db_{d}",
            }))
    await gather_bounded(client, schema_coros, "schemas", batch=100)

    # Plan table distribution
    plan: list[tuple[str, list[str]]] = []
    remaining = total_tables
    per_schema = total_tables // len(schema_fqns)
    extra = total_tables % len(schema_fqns)
    for i, sfqn in enumerate(schema_fqns):
        n = per_schema + (1 if i < extra else 0)
        plan.append((sfqn, [f"tbl_{j}" for j in range(n)]))
        remaining -= n
    return plan


async def bulk_create_tables(
    client: Client, cfg: Config, plan: list[tuple[str, list[str]]], term_fqns: list[str]
) -> list[str]:
    """Bulk-create tables with inline tags + certification. Returns list of FQNs."""
    print(f"\n=== Phase 3: Tables (bulk) — {sum(len(t) for _, t in plan):,} target ===")
    table_fqns: list[str] = []
    bulk_coros = []
    global_idx = 0
    total_tables = sum(len(t) for _, t in plan)
    for schema_fqn, names in plan:
        for i in range(0, len(names), cfg.bulk_size):
            batch_names = names[i : i + cfg.bulk_size]
            entries = []
            for name in batch_names:
                tags = build_inline_tags(cfg, term_fqns, global_idx)
                entry: dict[str, Any] = {
                    "name": name,
                    "databaseSchema": schema_fqn,
                    "columns": rand_columns(global_idx, cfg.seed),
                }
                if tags:
                    entry["tags"] = tags
                entries.append(entry)
                table_fqns.append(f"{schema_fqn}.{name}")
                global_idx += 1
            bulk_coros.append(client.put("/tables/bulk", entries))
    await gather_bounded(client, bulk_coros, "tables-bulk", batch=20)
    return table_fqns


async def bulk_create_simple(
    client: Client, cfg: Config, kind: str, svc: str, count: int, term_fqns: list[str],
    extra: dict | None = None,
) -> list[str]:
    """Create ``count`` entities of ``kind`` under ``svc`` using bulk endpoint when available."""
    if count <= 0:
        return []
    print(f"\n=== {kind} — {count:,} target ===")
    fqns: list[str] = []
    bulk_path = BULK_ENDPOINTS.get(kind)
    single_path = SINGLE_ENDPOINTS[kind]
    entries_buffer: list[dict] = []
    bulk_coros = []
    single_coros = []
    for i in range(count):
        name = f"{kind}_{i}"
        fqns.append(f"{svc}.{name}")
        tags = build_inline_tags(cfg, term_fqns, i)
        entry: dict[str, Any] = {"name": name}
        # Parent linkage varies per entity type
        if kind in {"containers", "topics", "dashboards", "pipelines", "charts",
                    "dashboardDataModels", "mlmodels", "searchIndexes"}:
            entry["service"] = svc
        if kind == "topics":
            entry["partitions"] = 3
        if kind == "mlmodels":
            entry["algorithm"] = "RandomForest"
        if kind == "charts":
            entry["chartType"] = "Line"
        if kind == "dashboardDataModels":
            entry["dataModelType"] = "TableauDataModel"
            entry["columns"] = [{"name": "col_0", "dataType": "INT"}]
        if kind == "searchIndexes":
            entry["fields"] = [{"name": "f0", "dataType": "TEXT"}]
        if extra:
            entry.update(extra)
        if tags:
            entry["tags"] = tags

        if bulk_path:
            entries_buffer.append(entry)
            if len(entries_buffer) >= cfg.bulk_size:
                bulk_coros.append(client.put(bulk_path, entries_buffer))
                entries_buffer = []
        else:
            single_coros.append(client.put(single_path, entry))

    if entries_buffer and bulk_path:
        bulk_coros.append(client.put(bulk_path, entries_buffer))

    if bulk_coros:
        await gather_bounded(client, bulk_coros, f"{kind}-bulk", batch=20)
    if single_coros:
        await gather_bounded(client, single_coros, kind, batch=200)
    return fqns


async def _resolve_table_ids(
    client: Client, cfg: Config, table_fqns: list[str]
) -> list[tuple[str, str]]:
    """Look up (fqn, id) tuples for the given table FQNs with bounded concurrency."""
    sem = asyncio.Semaphore(max(1, cfg.concurrency // 2))

    async def one(fqn):
        async with sem:
            r = await client.get(f"/tables/name/{fqn}?fields=id")
            return (fqn, (r or {}).get("id"))

    out = await asyncio.gather(*(one(f) for f in table_fqns))
    return [(f, i) for f, i in out if i]


async def bulk_assign_domains(
    client: Client, cfg: Config, table_fqns: list[str], domains: list[str]
):
    """Assign ``bulk_domain_pct`` of tables to a random domain using bulk endpoint.

    The /domains/{name}/assets/add endpoint requires EntityReference with ``id``,
    so we look those up first. Still a big win over per-entity PATCH because the
    server processes the whole batch as one transaction + one search bulk request.
    """
    if not domains or cfg.bulk_domain_pct <= 0:
        return
    print(f"\n=== Phase: Bulk domain assignment ({cfg.bulk_domain_pct*100:.0f}% of tables) ===")
    n = int(len(table_fqns) * cfg.bulk_domain_pct)
    sample = random.Random(cfg.seed).sample(table_fqns, n)
    pairs = await _resolve_table_ids(client, cfg, sample)
    if not pairs:
        print("  no tables resolved, skipping")
        return
    # Group by domain (round-robin)
    by_domain: dict[str, list[tuple[str, str]]] = {d: [] for d in domains}
    for i, fp in enumerate(pairs):
        by_domain[domains[i % len(domains)]].append(fp)

    coros = []
    for d, fps in by_domain.items():
        for i in range(0, len(fps), cfg.bulk_size):
            batch = fps[i : i + cfg.bulk_size]
            assets = [
                {"id": tid, "type": "table", "fullyQualifiedName": tfqn}
                for tfqn, tid in batch
            ]
            coros.append(client.put(f"/domains/{d}/assets/add", {"assets": assets}))
    await gather_bounded(client, coros, "domain-assign", batch=10)


async def apply_certifications(
    client: Client, cfg: Config, table_fqns: list[str]
):
    """Apply Gold/Silver/Bronze certification to a bounded number of tables.

    Certification is not accepted on entity create, so we PATCH after. To avoid
    saturating the search bulk pipeline (which felled earlier scripts), we cap
    at a small absolute count rather than a percentage."""
    cert_pct = cfg.enrich.get("cert-pct", 0.0)
    if cert_pct <= 0:
        return
    # Bound to at most 2000 PATCHes regardless of total — search reindex per PATCH
    # is the bottleneck, not the PATCH itself.
    target = min(int(len(table_fqns) * cert_pct), 2000)
    if target <= 0:
        return
    sample = random.Random(cfg.seed).sample(table_fqns, target)
    print(f"\n=== Phase: Certification ({target} tables) ===")
    now = int(time.time() * 1000)
    one_year = 365 * 24 * 3600 * 1000

    coros = []
    for i, fqn in enumerate(sample):
        tag = CERT_TAGS[i % len(CERT_TAGS)]
        cert = {
            "tagLabel": maybe_tag_label(tag),
            "appliedDate": now,
            "expiryDate": now + one_year,
        }
        coros.append(client.patch(
            f"/tables/name/{fqn}",
            [{"op": "add", "path": "/certification", "value": cert}],
        ))
    # Lower batch + lower implicit concurrency via small batches
    await gather_bounded(client, coros, "certification", batch=50)


async def create_lineage_chains(client: Client, cfg: Config, table_fqns: list[str]):
    """Create lineage chains: shorter pool, lower concurrency to spare _update_by_query."""
    n_chains = max(1, len(table_fqns) // 5000)
    chain_len = 5
    edges_per_chain = chain_len - 1
    total_edges = n_chains * edges_per_chain
    print(f"\n=== Phase: Lineage ({n_chains} chains × {edges_per_chain} edges = {total_edges}) ===")
    pool_size = n_chains * chain_len + 50
    sample = random.Random(cfg.seed).sample(table_fqns, min(len(table_fqns), pool_size))

    # Resolve IDs (with reduced concurrency)
    sem = asyncio.Semaphore(max(1, cfg.concurrency // 2))

    async def resolve(fqn):
        async with sem:
            r = await client.get(f"/tables/name/{fqn}?fields=id")
            return (r or {}).get("id")

    ids = await asyncio.gather(*(resolve(f) for f in sample))
    ids = [i for i in ids if i]
    if len(ids) < chain_len * 2:
        print(f"  not enough IDs resolved ({len(ids)}), skipping lineage")
        return

    coros = []
    cursor = 0
    for _ in range(n_chains):
        if cursor + chain_len > len(ids):
            break
        chain = ids[cursor : cursor + chain_len]
        cursor += chain_len
        for a, b in zip(chain, chain[1:]):
            coros.append(client.put("/lineage", {
                "edge": {
                    "fromEntity": {"id": a, "type": "table"},
                    "toEntity": {"id": b, "type": "table"},
                }
            }))
    await gather_bounded(client, coros, "lineage", batch=20)


async def create_tests_and_incidents(client: Client, cfg: Config, table_fqns: list[str]):
    """Create test cases on a sample of tables, with results + incident state transitions."""
    if cfg.include_tests_pct <= 0:
        return
    n_tests = int(len(table_fqns) * cfg.include_tests_pct)
    sample = random.Random(cfg.seed).sample(table_fqns, n_tests)
    print(f"\n=== Phase: Test cases ({len(sample):,} tables) + incidents ===")

    admin = await client.get("/users/name/admin?fields=id")
    admin_ref = None
    if admin and "id" in admin:
        admin_ref = {"id": admin["id"], "type": "user", "name": "admin",
                     "fullyQualifiedName": "admin"}

    tc_fqns: list[str] = []

    async def create_one(table_fqn: str, idx: int):
        body = {
            "name": f"col_count_check_{idx}",
            "entityLink": f"<#E::table::{table_fqn}>",
            "testDefinition": "tableColumnCountToBeBetween",
            "parameterValues": [
                {"name": "minColValue", "value": "1"},
                {"name": "maxColValue", "value": "200"},
            ],
        }
        r = await client.post("/dataQuality/testCases", body)
        if not r:
            return
        tc_fqn = r.get("fullyQualifiedName")
        if not tc_fqn:
            return
        tc_fqns.append(tc_fqn)
        # Mixed result set
        will_fail = random.Random(cfg.seed + idx).random() < cfg.failed_fraction
        now_ms = int(time.time() * 1000)
        statuses = ["Failed"] + ["Success"] * 4 if will_fail else ["Success"] * 5
        for r_idx, st in enumerate(statuses):
            await client.post(f"/dataQuality/testCases/testCaseResults/{tc_fqn}", {
                "timestamp": now_ms - r_idx * 60_000,
                "testCaseStatus": st,
                "result": f"Result {r_idx} = {st}",
            })

    await gather_bounded(
        client,
        [create_one(fqn, i) for i, fqn in enumerate(sample)],
        "testcases",
        batch=40,
    )

    # Advance ~90% of failed incidents through Ack/Assigned/Resolved (rest stay New)
    failed_subset = random.Random(cfg.seed).sample(
        tc_fqns, min(len(tc_fqns), int(len(tc_fqns) * cfg.failed_fraction * 0.9))
    )

    async def advance(tc_fqn: str, target: str):
        async def post_status(stype: str, details: dict | None):
            body = {
                "testCaseResolutionStatusType": stype,
                "testCaseReference": tc_fqn,
                "severity": random.choice(SEVERITIES),
            }
            if details is not None:
                body["testCaseResolutionStatusDetails"] = details
            await client.post("/dataQuality/testCases/testCaseIncidentStatus", body)

        if target in ("Ack", "Assigned", "Resolved"):
            await post_status("Ack", None)
        if target in ("Assigned", "Resolved") and admin_ref:
            await post_status("Assigned", {"assignee": admin_ref})
        if target == "Resolved" and admin_ref:
            await post_status("Resolved", {
                "testCaseFailureReason": random.choice(FAILURE_REASONS),
                "testCaseFailureComment": "Auto-resolved",
                "resolvedBy": admin_ref,
            })

    n = len(failed_subset)
    q = max(1, n // 4)
    stage_tasks = []
    for i, fqn in enumerate(failed_subset):
        if i < q:
            stage = "Ack"
        elif i < q * 2:
            stage = "Assigned"
        elif i < q * 3:
            stage = "Resolved"
        else:
            stage = "New"
        stage_tasks.append(advance(fqn, stage))
    await gather_bounded(client, stage_tasks, "incidents", batch=30)


# ---------- Orchestration ----------


async def run(cfg: Config):
    random.seed(cfg.seed)
    await login_and_save_token(cfg)
    plan = plan_volumes(cfg)
    throttle = AdaptiveThrottle(cfg.max_error_rate, cfg.backoff_seconds)
    connector = aiohttp.TCPConnector(limit=cfg.concurrency * 2)
    timeout = aiohttp.ClientTimeout(total=120)
    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        client = Client(cfg, session, throttle)
        t0 = time.time()

        svcs = await create_services(client, cfg)
        domains, dp_fqns, term_fqns = await create_governance(client, cfg)

        # Tables (bulk, biggest)
        db_svc = svcs["database"][0]
        db_plan = await create_db_hierarchy(client, cfg, db_svc, plan["tables"])
        table_fqns = await bulk_create_tables(client, cfg, db_plan, term_fqns)

        # Stored procedures (spread across schemas)
        sp_count = plan.get("storedProcedures", 0)
        if sp_count > 0:
            print(f"\n=== Phase: Stored procedures ({sp_count:,}) ===")
            n_schemas = len(db_plan)
            sp_per_schema = (sp_count + n_schemas - 1) // n_schemas
            sp_coros = []
            for schema_fqn, _ in db_plan:
                batch_entries = [
                    {"name": f"sp_{j}", "databaseSchema": schema_fqn,
                     "storedProcedureCode": {"code": "SELECT 1;", "language": "SQL"}}
                    for j in range(sp_per_schema)
                ]
                for i in range(0, len(batch_entries), cfg.bulk_size):
                    sub = batch_entries[i : i + cfg.bulk_size]
                    sp_coros.append(client.put("/storedProcedures/bulk", sub))
            await gather_bounded(client, sp_coros, "storedProcedures-bulk", batch=20)

        # Other top-level entities under their respective service
        await bulk_create_simple(client, cfg, "containers", svcs["storage"][0],
                                 plan.get("containers", 0), term_fqns)
        await bulk_create_simple(client, cfg, "topics", svcs["messaging"][0],
                                 plan.get("topics", 0), term_fqns)
        await bulk_create_simple(client, cfg, "dashboards", svcs["dashboard"][0],
                                 plan.get("dashboards", 0), term_fqns)
        await bulk_create_simple(client, cfg, "charts", svcs["dashboard"][0],
                                 plan.get("charts", 0), term_fqns)
        await bulk_create_simple(client, cfg, "dashboardDataModels", svcs["dashboard"][0],
                                 plan.get("dashboardDataModels", 0), term_fqns)
        await bulk_create_simple(client, cfg, "pipelines", svcs["pipeline"][0],
                                 plan.get("pipelines", 0), term_fqns)
        await bulk_create_simple(client, cfg, "mlmodels", svcs["mlmodel"][0],
                                 plan.get("mlmodels", 0), term_fqns)
        await bulk_create_simple(client, cfg, "searchIndexes", svcs["search"][0],
                                 plan.get("searchIndexes", 0), term_fqns)

        # API collections need to exist before endpoints
        ep_count = plan.get("apiEndpoints", 0)
        if ep_count > 0:
            api_svc = svcs["api"][0]
            # Need apiCollections as parents
            n_collections = max(1, ep_count // 20)
            print(f"\n=== Phase: APICollections ({n_collections}) + Endpoints ({ep_count:,}) ===")
            ac_coros = [
                client.put("/apiCollections", {
                    "name": f"coll_{c}", "service": api_svc, "endpointURL": "http://h/api",
                })
                for c in range(n_collections)
            ]
            await gather_bounded(client, ac_coros, "apiCollections", batch=100)

            ep_coros = []
            ep_per_coll = ep_count // n_collections
            for c in range(n_collections):
                cfqn = f"{api_svc}.coll_{c}"
                entries = [
                    {"name": f"ep_{e}", "apiCollection": cfqn,
                     "endpointURL": f"http://h/api/ep_{e}"}
                    for e in range(ep_per_coll)
                ]
                for i in range(0, len(entries), cfg.bulk_size):
                    sub = entries[i : i + cfg.bulk_size]
                    ep_coros.append(client.put("/apiEndpoints/bulk", sub))
            await gather_bounded(client, ep_coros, "apiEndpoints-bulk", batch=20)

        # Enrichment passes (bulk where possible)
        await bulk_assign_domains(client, cfg, table_fqns, domains)
        await apply_certifications(client, cfg, table_fqns)
        await create_lineage_chains(client, cfg, table_fqns)
        await create_tests_and_incidents(client, cfg, table_fqns)

        elapsed = time.time() - t0
        print(f"\n=== DONE in {elapsed:.1f}s ({elapsed/60:.1f} min) ===")
        print(json.dumps(dict(client.stats), indent=2))


# ---------- CLI ----------


def parse_mix(s: str) -> dict[str, float]:
    out = {}
    for pair in s.split(","):
        k, v = pair.split(":")
        out[k.strip()] = float(v)
    return out


def parse_enrich(s: str) -> dict[str, float]:
    out = {}
    for pair in s.split(","):
        k, v = pair.split(":")
        out[k.strip()] = float(v)
    return out


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0],
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--server", default=os.environ.get("OM_SERVER", "http://localhost:8585/api"))
    p.add_argument("--token-file", default=os.environ.get("OM_TOKEN_FILE", "/tmp/om_token"),
                   help="Path to a file containing the bearer token. Re-read every 30s.")
    p.add_argument("--email", help="Admin email (will exchange for token and write to --token-file)")
    p.add_argument("--password", help="Admin password (paired with --email)")
    p.add_argument("--total", type=int, default=int(os.environ.get("OM_TOTAL", "100000")))
    p.add_argument("--mix", type=parse_mix, default=DEFAULT_MIX,
                   help='Volume distribution e.g. "tables:0.55,containers:0.15,..."')
    p.add_argument("--enrich-inline", type=parse_enrich, default=DEFAULT_ENRICH,
                   help='Inline enrichment percentages: "tag-pct:0.1,cert-pct:0.05,glossary-pct:0.05"')
    p.add_argument("--bulk-domain-pct", type=float, default=0.20,
                   help="Fraction of tables to assign to domains via bulk endpoint")
    p.add_argument("--include-tests", type=float, default=0.05,
                   help="Fraction of tables to create test cases on")
    p.add_argument("--failed-fraction", type=float, default=0.40,
                   help="Of test cases, fraction whose latest result is Failed (opens incident)")
    p.add_argument("--bulk-size", type=int, default=100,
                   help="Entities per bulk request body")
    p.add_argument("--concurrency", type=int, default=10,
                   help="Concurrent in-flight bulk requests")
    p.add_argument("--max-error-rate", type=float, default=0.05,
                   help="Sliding-window 5xx/timeout rate that triggers backoff")
    p.add_argument("--backoff-seconds", type=int, default=30,
                   help="Cooldown when error rate exceeded")
    p.add_argument("--prefix", default="loadgen",
                   help="Name prefix for all created entities (bump for fresh dataset)")
    p.add_argument("--domains", type=int, default=20)
    p.add_argument("--data-products-per-domain", type=int, default=10)
    p.add_argument("--glossaries", type=int, default=10)
    p.add_argument("--terms-per-glossary", type=int, default=200)
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()

    cfg = Config(
        server=args.server,
        token_file=args.token_file,
        email=args.email,
        password=args.password,
        total=args.total,
        mix=args.mix,
        enrich=args.enrich_inline,
        bulk_domain_pct=args.bulk_domain_pct,
        include_tests_pct=args.include_tests,
        failed_fraction=args.failed_fraction,
        bulk_size=args.bulk_size,
        concurrency=args.concurrency,
        max_error_rate=args.max_error_rate,
        backoff_seconds=args.backoff_seconds,
        prefix=args.prefix,
        domains=args.domains,
        glossaries=args.glossaries,
        terms_per_glossary=args.terms_per_glossary,
        data_products_per_domain=args.data_products_per_domain,
        seed=args.seed,
    )
    asyncio.run(run(cfg))


if __name__ == "__main__":
    main()
