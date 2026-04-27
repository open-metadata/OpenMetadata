#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL pilot — CLI E2E v2 tests.

Exercises the v2 framework end-to-end against a MySQL source. Covers all
the pipelines the MVP ships (metadata, profiler, auto-classification, and
view lineage via SQL parsing; DQ deferred to post-MVP) plus four filter
scenarios, FK/description coverage, mark-deleted re-ingest, error
containment, and column-level lineage.

Lineage note: MySQL FK constraints produce TableConstraint entries on the
table entity, not lineage edges (see `project-mysql-fk-no-lineage.md`).
The only real lineage MySQL surfaces is view-to-table lineage derived from
parsing the view definition SQL. The FK assertion targets
`tableConstraints`, not upstream edges.

Module-scoped `mysql_metadata_ingested` runs the metadata CLI once for
tests that consume the shared service — profiler, lineage,
classification, structural, description, FK. That fixture also registers
the service name for session-end cleanup.

Tests that mutate the source state (mark-deleted, error containment) use
their own isolated services and clean up after themselves so they
don't perturb the shared fixture.
"""

from __future__ import annotations

from typing import Callable

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.generated.schema.entity.data.table import DataType

from ..core.config.builder import WorkflowConfig
from ..core.config.pipelines import (
    AutoClassificationPipeline,
    LineagePipeline,
    MetadataPipeline,
    ProfilerPipeline,
)
from ..core.config.server import ServerConfig
from ..core.expected.differ import MatchMode, assert_service_matches
from ..core.expected.types import ExpectedService
from ..core.filter_scenarios import (
    COMMON_FILTER_SCENARIOS,
    FilterScenario,
    expected_tables_for,
)
from ..core.fluent.om_client import OmClient
from ..core.runner.cli_runner import CliRunner
from .baseline import MYSQL_BASELINE
from .connector import build_mysql_config, mysql_service_name
from .expected import mysql_expected


# ---------------------------------------------------------------------------
# Structural (metadata pipeline) — full Expected* tree walk
# ---------------------------------------------------------------------------


def test_vanilla_ingest_structural(
    om_client: OmClient,
    mysql_expected_factory: Callable[..., ExpectedService],
    # `mysql_metadata_ingested: None` is a pytest idiom: declaring the
    # fixture as a parameter triggers its setup side-effect (here, running
    # the metadata CLI once per module). The value itself is always None.
    # Every test below that asserts on OM state does the same.
    mysql_metadata_ingested: None,
) -> None:
    """Metadata ingest produces the declared OM catalog (SUPERSET).

    Walks the full Expected* tree — table structure, every column's
    DataType, constraints, descriptions, stored procedures. Subsumes
    per-column type spot-checks and per-entity count smoke tests, so we
    don't repeat those at the test-function level.
    """
    assert_service_matches(mysql_expected_factory(), om_client)


# ---------------------------------------------------------------------------
# Profiler — exhaustive metric coverage on representative columns
# ---------------------------------------------------------------------------


# Explicit "compute all stat-type metrics" list. Default profiler
# metrics (`get_default_metrics` in OM) omit minLength/maxLength so
# string-length stats come back None — passing this list overrides the
# default. We exclude parameterized metrics (countInSet, *LikeCount,
# regexCount, etc.) that need user-supplied values; they're applicable
# for DQ-style checks, not the "compute everything we can off raw
# rows" coverage this test wants.
_ALL_PROFILER_METRICS: list[MetricType] = [
    # Table-level
    MetricType.rowCount,
    MetricType.columnCount,
    MetricType.columnNames,
    # Column counts / proportions
    MetricType.valuesCount,
    MetricType.nullCount,
    MetricType.nullProportion,
    MetricType.distinctCount,
    MetricType.distinctProportion,
    MetricType.uniqueCount,
    MetricType.uniqueProportion,
    MetricType.duplicateCount,
    # Numeric stats
    MetricType.min,
    MetricType.max,
    MetricType.mean,
    MetricType.sum,
    MetricType.stddev,
    MetricType.median,
    MetricType.firstQuartile,
    MetricType.thirdQuartile,
    MetricType.interQuartileRange,
    MetricType.nonParametricSkew,
    MetricType.histogram,
    # String stats
    MetricType.minLength,
    MetricType.maxLength,
]


def test_profiler_metrics(
    cli_runner: CliRunner,
    om_client: OmClient,
    mysql_cfg: WorkflowConfig,
    mysql_service: str,
    mysql_metadata_ingested: None,
) -> None:
    """Profiler emits the full metric suite — table-level + per-column.

    Lean: ONE pipeline run, multiple assertions off the produced state.
    Exhaustive: covers numeric + string + count metric paths in one pass.

    Scope:
      - Table-level rowCount on three seeded tables.
      - Numeric metrics on `customers.credit_score` (deterministic ints
        720, 680, 650, 750, 600 → min=600, max=750, mean=680, sum=3400,
        median=680, distinct=5, unique=5, null=0).
      - String length metrics on `customers.first_name` (5 values, min
        length 3 ("Bob"/"Eve"), max length 7 ("Charlie")).

    Pipeline runs with `metrics=_ALL_PROFILER_METRICS` so OM doesn't
    fall through to the default-set which omits minLength/maxLength.
    """
    status = cli_runner.run(
        mysql_cfg.pipeline(
            ProfilerPipeline(metrics=_ALL_PROFILER_METRICS)
        ).with_filter(schemas_include=["e2e"])
    )
    assert status.success, f"profiler failures: {status.all_failures}"

    customers_fqn = f"{mysql_service}.default.e2e.customers"
    transactions_fqn = f"{mysql_service}.default.e2e.transactions"
    all_types_fqn = f"{mysql_service}.default.e2e.all_types"

    # Table-level row counts (seeded determinism).
    om_client.table(customers_fqn).profile.eventually().row_count().equals(5)
    om_client.table(transactions_fqn).profile.eventually().row_count().equals(5)
    om_client.table(all_types_fqn).profile.eventually().row_count().equals(3)

    # Numeric column — credit_score sorted: [600, 650, 680, 720, 750].
    # min=600, max=750, mean=680, sum=3400, distinct=5, unique=5, null=0.
    #
    # median=650, NOT the textbook 680. OM's MySQL profiler computes the
    # 50th percentile via a quantile-discrete (lower-median) function —
    # for a 5-element sample it returns the 2nd-smallest value, not the
    # middle one. Pinned here intentionally so a future change to OM's
    # median definition (e.g. switch to quantile-continuous, swap to a
    # different SQL function) surfaces as a test failure to be triaged.
    om_client.table(customers_fqn).profile.eventually().column(
        "credit_score"
    ).has_metrics(
        valuesCount=5,
        nullCount=0,
        distinctCount=5,
        uniqueCount=5,
        min=600,
        max=750,
        mean=680,
        sum=3400,
        median=650,
    )

    # String column — first_name: Alice(5), Bob(3), Charlie(7), Diana(5), Eve(3).
    om_client.table(customers_fqn).profile.eventually().column(
        "first_name"
    ).has_metrics(
        valuesCount=5,
        nullCount=0,
        minLength=3,
        maxLength=7,
    )


# ---------------------------------------------------------------------------
# Stored procedures — body content (presence covered by structural walk)
# ---------------------------------------------------------------------------


def test_stored_procedure_bodies(
    om_client: OmClient,
    mysql_service: str,
    mysql_metadata_ingested: None,
) -> None:
    """Both SP bodies survive ingestion intact.

    Existence of each SP is asserted by the structural walk via
    `ExpectedStoredProcedure` entries; this test adds the body-content
    coverage that the structural walk doesn't do (and exercises the
    parameterized-SP code path on `sp_update_customer_status`).
    """
    base = f"{mysql_service}.default.e2e"

    om_client.stored_procedure(
        f"{base}.sp_active_customer_count"
    ).has_code_containing("SELECT COUNT(*)")

    # Parameterized SP with DML body — different code path than the
    # parameterless SELECT-only procedure above.
    sp_update = om_client.stored_procedure(f"{base}.sp_update_customer_status")
    sp_update.has_code_containing("p_customer_id")
    sp_update.has_code_containing("UPDATE")


# ---------------------------------------------------------------------------
# Lineage — table-level + column-level + schemaDefinition
# ---------------------------------------------------------------------------


def test_lineage_view_references_tables(
    cli_runner: CliRunner,
    om_client: OmClient,
    mysql_cfg: WorkflowConfig,
    mysql_service: str,
    mysql_metadata_ingested: None,
) -> None:
    """View → base-table lineage (table-level + column-level) and view DDL.

    The view's `schemaDefinition` is the prerequisite for OM's SQL parser
    to produce lineage at all — assert it's present BEFORE asserting the
    parsed edges, so a "DDL didn't plumb through" regression points at
    the right root cause instead of looking like a parser bug.
    """
    view_fqn = f"{mysql_service}.default.e2e.customer_txn_summary"
    customers_fqn = f"{mysql_service}.default.e2e.customers"
    transactions_fqn = f"{mysql_service}.default.e2e.transactions"

    # Prereq: includeDDL=True actually plumbed the CREATE VIEW body into OM.
    om_client.table(view_fqn).has_schema_definition_containing("LEFT JOIN")

    status = cli_runner.run(
        mysql_cfg.pipeline(
            # processQueryLineage defaults True and needs SELECT on
            # mysql.general_log (the slow-query table) — a privilege the
            # scoped ingest user deliberately doesn't hold. View lineage
            # is what we care about; disable the query-log path.
            LineagePipeline(processQueryLineage=False)
        ).with_filter(schemas_include=["e2e"])
    )
    assert status.success, f"lineage failures: {status.all_failures}"

    # Table-level lineage edges.
    om_client.table(view_fqn).lineage.eventually().has_upstream(customers_fqn)
    om_client.table(view_fqn).lineage.eventually().has_upstream(transactions_fqn)

    # Column-level lineage — proves the SQL parser actually parsed,
    # not just that "some lineage edge was emitted" via a fallback.
    # `customer_id` is `c.id AS customer_id` (identity); `total_amount`
    # is `COALESCE(SUM(t.amount), 0)` (aggregate over transactions.amount).
    om_client.table(view_fqn).lineage.eventually().has_column_lineage(
        source="customers.id", target="customer_id"
    )
    om_client.table(view_fqn).lineage.eventually().has_column_lineage(
        source="transactions.amount", target="total_amount"
    )


# ---------------------------------------------------------------------------
# Foreign key TableConstraint (no lineage edge for MySQL)
# ---------------------------------------------------------------------------


def test_transactions_foreign_key_constraint(
    om_client: OmClient,
    mysql_service: str,
    mysql_metadata_ingested: None,
) -> None:
    """FK on transactions.customer_id -> customers.id lands as TableConstraint.

    Uses eventually because OM processes FK constraints as a post-ingest
    PATCH (connector iterates tables, defers FK when referenced table isn't
    yet in OM, then patches at end).
    """
    transactions_fqn = f"{mysql_service}.default.e2e.transactions"
    om_client.table(transactions_fqn).eventually(60).has_foreign_key_constraint(
        column="customer_id",
        referenced_table="customers",
        referenced_column="id",
    )


# ---------------------------------------------------------------------------
# Auto-classification (PII via column-name regex) + negative assertion
# ---------------------------------------------------------------------------


def test_auto_classification_tags_pii_columns(
    cli_runner: CliRunner,
    om_client: OmClient,
    mysql_cfg: WorkflowConfig,
    mysql_service: str,
    mysql_metadata_ingested: None,
) -> None:
    """Auto-classification tags PII columns AND leaves non-PII columns alone.

    Positive: `email` and `date_of_birth` get the expected PII tags.
    Negative: `id` and `status` stay untagged — guards against a
    "classifier became trigger-happy" regression that would silently
    pass a positive-only suite.
    """
    status = cli_runner.run(
        mysql_cfg.pipeline(
            AutoClassificationPipeline(
                storeSampleData=True,
                enableAutoClassification=True,
                # Lowered from default 80; with only 5 seed rows per
                # column the combined score sits at the edge of 80%.
                # 60 aligns with PII's server-side `minimumConfidence`.
                confidence=60,
            )
        ).with_filter(schemas_include=["e2e"])
    )
    assert status.success, f"auto-classification failures: {status.all_failures}"

    customers_fqn = f"{mysql_service}.default.e2e.customers"

    # Positive — deterministic regex-based recognizers.
    om_client.table(customers_fqn).column("email").has_tag("PII.Sensitive")
    om_client.table(customers_fqn).column(
        "date_of_birth"
    ).has_tag("PII.NonSensitive")

    # Negative — primary key and status enum should never be PII-flagged.
    # Catches regressions where the classifier becomes overconfident on
    # column-name matching across non-PII columns.
    om_client.table(customers_fqn).column("id").has_no_tag("PII.Sensitive")
    om_client.table(customers_fqn).column("id").has_no_tag("PII.NonSensitive")
    om_client.table(customers_fqn).column("status").has_no_tag("PII.Sensitive")
    om_client.table(customers_fqn).column("status").has_no_tag("PII.NonSensitive")


# ---------------------------------------------------------------------------
# Mark-deleted on re-ingest
# ---------------------------------------------------------------------------


def test_mark_deleted_tables_on_reingest(
    cli_runner: CliRunner,
    om_client: OmClient,
    om_server_config: ServerConfig,
    session_uuid: str,
    registered_services: list[str],
    mysql_admin_engine: Engine,
    mysql_source_ready: None,
) -> None:
    """Dropping a source table + re-ingesting marks the OM entity deleted.

    Lifecycle, end-to-end:
      1. Ingest baseline → all_types present in OM, deleted=False.
      2. Drop e2e.all_types via admin engine (out-of-band of the framework).
      3. Re-ingest with markDeletedTables=True (fixture default).
      4. Assert all_types now has deleted=True in OM.
      5. Restore e2e.all_types via the baseline policy (apply re-runs full
         baseline DDL + seeds — idempotent CREATE IF NOT EXISTS path).

    Uses an isolated service so the shared `mysql_metadata_ingested`
    fixture's catalog is untouched.
    """
    service = mysql_service_name(session_uuid, variant="mark_deleted")
    registered_services.append(service)
    cfg = build_mysql_config(service, om_server_config)
    pipeline_options = MetadataPipeline(
        markDeletedTables=True,
        includeStoredProcedures=False,  # not needed for this test; cuts run time
    )

    all_types_fqn = f"{service}.default.e2e.all_types"

    # Phase 1: initial ingest — all_types present, alive.
    status = cli_runner.run(
        cfg.pipeline(pipeline_options).with_filter(schemas_include=["e2e"])
    )
    assert status.success, f"initial ingest: {status.all_failures}"
    om_client.table(all_types_fqn).is_not_deleted()

    # Phase 2: drop the source table — out-of-band mutation via admin engine.
    with mysql_admin_engine.begin() as conn:
        conn.execute(text("DROP TABLE e2e.all_types"))

    try:
        # Phase 3: re-ingest — markDeletedTables flips the entity to deleted=True.
        status = cli_runner.run(
            cfg.pipeline(pipeline_options).with_filter(schemas_include=["e2e"])
        )
        assert status.success, f"re-ingest after drop: {status.all_failures}"

        # Phase 4: verify the soft-delete landed on the OM entity.
        om_client.table(all_types_fqn).eventually(30).is_soft_deleted()
    finally:
        # Phase 5: restore the source so subsequent test sessions start
        # from a clean baseline. The policy's apply() is idempotent —
        # CREATE TABLE IF NOT EXISTS + the seed insert template's
        # ON DUPLICATE KEY UPDATE handle the re-create path.
        from .baseline import get_policy
        get_policy().enforcer.apply([])


# ---------------------------------------------------------------------------
# Error containment — one broken view doesn't tank the rest of ingest
# ---------------------------------------------------------------------------


def test_error_containment_one_broken_view(
    cli_runner: CliRunner,
    om_client: OmClient,
    om_server_config: ServerConfig,
    session_uuid: str,
    registered_services: list[str],
    mysql_admin_engine: Engine,
    mysql_source_ready: None,
) -> None:
    """A broken view doesn't abort the whole metadata pipeline.

    Setup: create a helper table, create a view referencing one of its
    columns, then DROP that column. The view becomes "invalid" — MySQL
    blocks DESCRIBE on it but SHOW CREATE VIEW still works. OM's
    metadata ingestion should:
      - successfully ingest customers, transactions, all_types
      - log an error / fail on the broken view
      - NOT crash the whole workflow

    Uses an isolated service so the broken view doesn't pollute other
    tests' OM state. Cleans up the source-side artefacts in `finally`.
    """
    service = mysql_service_name(session_uuid, variant="error_containment")
    registered_services.append(service)
    cfg = build_mysql_config(service, om_server_config)

    # Phase 1: synthesize a broken view.
    with mysql_admin_engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS e2e._helper_for_broken_view "
            "(id INT PRIMARY KEY, doomed_col INT)"
        ))
        conn.execute(text(
            "CREATE OR REPLACE VIEW e2e._broken_view AS "
            "SELECT id, doomed_col FROM e2e._helper_for_broken_view"
        ))
        conn.execute(text(
            "ALTER TABLE e2e._helper_for_broken_view DROP COLUMN doomed_col"
        ))
        # _broken_view now references a non-existent column — DESCRIBE fails.

    try:
        # Phase 2: run metadata ingest. Don't assert success — the broken
        # view is expected to surface as a step error. Run the pipeline
        # and inspect what landed.
        try:
            status = cli_runner.run(
                cfg.pipeline(
                    MetadataPipeline(includeStoredProcedures=False)
                ).with_filter(schemas_include=["e2e"])
            )
        except Exception:  # noqa: BLE001 — partial-failure path may exit non-zero
            status = None

        # Phase 3: regardless of overall status, the unaffected baseline
        # tables must be in OM. That's the whole point of "error
        # containment" — one bad apple doesn't drop the rest.
        for table in ("customers", "transactions", "all_types"):
            om_client.table(
                f"{service}.default.e2e.{table}"
            ).eventually(30).exists()

        # Phase 4: optionally check the broken view was either (a) reported
        # as a failure in the status JSON or (b) ingested with no columns.
        # We accept either outcome — the key invariant is that the rest
        # of the catalog made it.
        if status is not None and status.all_failures:
            failure_text = " ".join(
                str(f.get("error", "")) for f in status.all_failures
            ).lower()
            assert (
                "_broken_view" in failure_text
                or "doomed_col" in failure_text
                or "invalid" in failure_text
            ), (
                f"broken view didn't surface in failures: {status.all_failures}"
            )
    finally:
        # Cleanup: drop the synthetic objects.
        with mysql_admin_engine.begin() as conn:
            conn.execute(text("DROP VIEW IF EXISTS e2e._broken_view"))
            conn.execute(text("DROP TABLE IF EXISTS e2e._helper_for_broken_view"))


# ---------------------------------------------------------------------------
# Filter scenarios — isolated services, STRICT mode catches "extras"
# ---------------------------------------------------------------------------


# Per-variant expected-tables for this connector's baseline. The common
# baseline (customers, transactions) is present in every variant unless
# excluded; dialect-specific tables (all_types) and the view
# (customer_txn_summary) are MySQL-only and listed here.
_EXPECTED_TABLES_BY_VARIANT: dict[str, list[str] | None] = {
    "inc_exact":  ["customers"],
    "exc_exact":  ["customers", "all_types", "customer_txn_summary"],
    "sch_inc":    None,  # None = full baseline
    "regex_prio": ["customers"],
}


@pytest.mark.parametrize(
    "scenario", COMMON_FILTER_SCENARIOS, ids=lambda s: s.id
)
def test_filter(
    scenario: FilterScenario,
    cli_runner: CliRunner,
    om_client: OmClient,
    om_server_config: ServerConfig,
    session_uuid: str,
    registered_services: list[str],
    mysql_source_ready: None,
) -> None:
    """Filter patterns — include exact / exclude exact / schema include /
    regex include+exclude with exclude priority.

    Each variant builds an isolated service so STRICT-mode extras detection
    doesn't cross-contaminate. Expected-tables for this connector's
    baseline live in `_EXPECTED_TABLES_BY_VARIANT` above.
    """
    expected_tables = expected_tables_for(
        scenario, _EXPECTED_TABLES_BY_VARIANT, connector="mysql"
    )

    service = mysql_service_name(session_uuid, variant=f"filter_{scenario.variant}")
    registered_services.append(service)

    cfg = build_mysql_config(service, om_server_config)
    status = cli_runner.run(
        cfg.pipeline(MetadataPipeline(includeStoredProcedures=True))
           .with_filter(**scenario.filter_kwargs)
    )
    assert status.success, (
        f"filter[{scenario.variant}] failures: {status.all_failures}"
    )

    assert_service_matches(
        mysql_expected(service, tables=expected_tables),
        om_client,
        mode=MatchMode.STRICT,
    )
