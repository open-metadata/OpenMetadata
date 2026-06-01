#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL CLI E2E v2 tests.

Covers metadata, profiler, auto-classification, view lineage, four filter
scenarios, FK constraints, stored-procedure bodies, mark-deleted, and error
containment. DQ is deferred to post-MVP.

MySQL FK constraints produce ``tableConstraints``, not lineage edges. View-to-table
lineage is derived from the view's DDL body via SQL parsing.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from sqlalchemy import text

from metadata.generated.schema.configuration.profilerConfiguration import MetricType

from ..core.config.pipelines import (
    AutoClassificationPipeline,
    LineagePipeline,
    MetadataPipeline,
    ProfilerPipeline,
)
from ..core.expected.differ import MatchMode, assert_service_matches
from ..core.filter_scenarios import (
    COMMON_FILTER_SCENARIOS,
    FilterScenario,
    expected_tables_for,
)
from .connector import build_mysql_config, mysql_service_name
from .expected import mysql_expected

if TYPE_CHECKING:
    from collections.abc import Callable

    from sqlalchemy.engine import Engine

    from ..core.config.builder import WorkflowConfig
    from ..core.config.server import ServerConfig
    from ..core.expected.types import ExpectedService
    from ..core.fluent.om_client import OmClient
    from ..core.runner.cli_runner import CliRunner
    from ..core.source.orchestrator import EnforcementPolicy

# ---------------------------------------------------------------------------
# Structural (metadata pipeline) — full Expected* tree walk
# ---------------------------------------------------------------------------


def test_vanilla_ingest_structural(
    om_client: OmClient,
    mysql_expected_factory: Callable[..., ExpectedService],
    # `mysql_metadata_ingested: None` triggers the fixture side-effect; value is always None.
    mysql_metadata_ingested: None,
) -> None:
    """Metadata ingest produces the full declared catalog (SUPERSET match)."""
    assert_service_matches(mysql_expected_factory(), om_client)


# ---------------------------------------------------------------------------
# Profiler — exhaustive metric coverage on representative columns
# ---------------------------------------------------------------------------


# Overrides the default metric set, which omits minLength/maxLength.
# Excludes parameterized metrics (countInSet, *LikeCount, regexCount) that require user values.
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
    """Profiler emits correct table-level row counts and per-column numeric/string metrics."""
    status = cli_runner.run(
        mysql_cfg.pipeline(ProfilerPipeline(metrics=_ALL_PROFILER_METRICS)).with_filter(schemas_include=["e2e"])
    )
    assert status.success, f"profiler failures: {status.all_failures}"

    customers_fqn = f"{mysql_service}.default.e2e.customers"
    transactions_fqn = f"{mysql_service}.default.e2e.transactions"
    all_types_fqn = f"{mysql_service}.default.e2e.all_types"

    om_client.table(customers_fqn).profile.eventually().row_count().equals(5)
    om_client.table(transactions_fqn).profile.eventually().row_count().equals(5)
    om_client.table(all_types_fqn).profile.eventually().row_count().equals(3)

    om_client.table(customers_fqn).profile.eventually().column("credit_score").has_metrics(
        valuesCount=5,
        nullCount=0,
        distinctCount=5,
        uniqueCount=5,
        min=600,
        max=750,
        mean=680,
        sum=3400,
        median=680,
    )

    om_client.table(customers_fqn).profile.eventually().column("first_name").has_metrics(
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
    """Both SP bodies are ingested intact (body content, not just existence)."""
    base = f"{mysql_service}.default.e2e"

    om_client.stored_procedure(f"{base}.sp_active_customer_count").has_code_containing("SELECT COUNT(*)")

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
    """View DDL is stored and SQL parsing produces table-level and column-level lineage edges."""
    view_fqn = f"{mysql_service}.default.e2e.customer_txn_summary"
    customers_fqn = f"{mysql_service}.default.e2e.customers"
    transactions_fqn = f"{mysql_service}.default.e2e.transactions"

    # Verify DDL landed before asserting parsed edges, so a missing-DDL regression is obvious.
    om_client.table(view_fqn).has_schema_definition_containing("LEFT JOIN")

    status = cli_runner.run(
        mysql_cfg.pipeline(
            # processQueryLineage=False: om_user lacks SELECT on mysql.general_log.
            LineagePipeline(processQueryLineage=False)
        ).with_filter(schemas_include=["e2e"])
    )
    assert status.success, f"lineage failures: {status.all_failures}"

    om_client.table(view_fqn).lineage.eventually().has_upstream(customers_fqn)
    om_client.table(view_fqn).lineage.eventually().has_upstream(transactions_fqn)

    om_client.table(view_fqn).lineage.eventually().has_column_lineage(source="customers.id", target="customer_id")
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
    """FK on transactions.customer_id → customers.id lands as a TableConstraint entry."""
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
    """Auto-classification tags PII columns (email, date_of_birth) and leaves non-PII columns untagged."""
    status = cli_runner.run(
        mysql_cfg.pipeline(
            AutoClassificationPipeline(
                storeSampleData=True,
                enableAutoClassification=True,
                # 5 seed rows push the combined score near the 80% boundary; 60 aligns with PII minimumConfidence.
                confidence=60,
            )
        ).with_filter(schemas_include=["e2e"])
    )
    assert status.success, f"auto-classification failures: {status.all_failures}"

    customers_fqn = f"{mysql_service}.default.e2e.customers"

    om_client.table(customers_fqn).column("email").has_tag("PII.Sensitive")
    om_client.table(customers_fqn).column("date_of_birth").has_tag("PII.NonSensitive")

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
    mysql_policy: EnforcementPolicy,
    mysql_source_ready: None,
) -> None:
    """Dropping a source table and re-ingesting with markDeletedTables=True soft-deletes the OM entity."""
    service = mysql_service_name(session_uuid, variant="mark_deleted")
    registered_services.append(service)
    cfg = build_mysql_config(service, om_server_config)
    pipeline_options = MetadataPipeline(
        markDeletedTables=True,
        includeStoredProcedures=False,  # not needed for this test; cuts run time
    )

    all_types_fqn = f"{service}.default.e2e.all_types"

    status = cli_runner.run(cfg.pipeline(pipeline_options).with_filter(schemas_include=["e2e"]))
    assert status.success, f"initial ingest: {status.all_failures}"
    om_client.table(all_types_fqn).is_not_deleted()

    with mysql_admin_engine.begin() as conn:
        conn.execute(text("DROP TABLE e2e.all_types"))

    try:
        status = cli_runner.run(cfg.pipeline(pipeline_options).with_filter(schemas_include=["e2e"]))
        assert status.success, f"re-ingest after drop: {status.all_failures}"

        om_client.table(all_types_fqn).eventually(30).is_soft_deleted()
    finally:
        # Restore source baseline so subsequent sessions start clean.
        mysql_policy.enforcer.apply([])


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
    """A broken view does not abort the metadata pipeline — baseline tables are ingested."""
    service = mysql_service_name(session_uuid, variant="error_containment")
    registered_services.append(service)
    cfg = build_mysql_config(service, om_server_config)

    with mysql_admin_engine.begin() as conn:
        conn.execute(
            text("CREATE TABLE IF NOT EXISTS e2e._helper_for_broken_view (id INT PRIMARY KEY, doomed_col INT)")
        )
        conn.execute(
            text("CREATE OR REPLACE VIEW e2e._broken_view AS SELECT id, doomed_col FROM e2e._helper_for_broken_view")
        )
        conn.execute(text("ALTER TABLE e2e._helper_for_broken_view DROP COLUMN doomed_col"))
        # _broken_view now references a non-existent column; DESCRIBE fails on it.

    try:
        try:
            status = cli_runner.run(
                cfg.pipeline(MetadataPipeline(includeStoredProcedures=False)).with_filter(schemas_include=["e2e"])
            )
        except Exception:
            status = None

        for table in ("customers", "transactions", "all_types"):
            om_client.table(f"{service}.default.e2e.{table}").eventually(30).exists()

        if status is not None and status.all_failures:
            failure_text = " ".join(str(f.get("error", "")) for f in status.all_failures).lower()
            assert "_broken_view" in failure_text or "doomed_col" in failure_text or "invalid" in failure_text, (
                f"broken view didn't surface in failures: {status.all_failures}"
            )
    finally:
        with mysql_admin_engine.begin() as conn:
            conn.execute(text("DROP VIEW IF EXISTS e2e._broken_view"))
            conn.execute(text("DROP TABLE IF EXISTS e2e._helper_for_broken_view"))


# ---------------------------------------------------------------------------
# Filter scenarios — isolated services, STRICT mode catches "extras"
# ---------------------------------------------------------------------------


# MySQL-specific per-variant table lists (common tables present in every variant unless excluded).
_EXPECTED_TABLES_BY_VARIANT: dict[str, list[str] | None] = {
    "inc_exact": ["customers"],
    "exc_exact": ["customers", "all_types", "customer_txn_summary"],
    "sch_inc": None,  # None = full baseline
    "regex_prio": ["customers"],
}


@pytest.mark.parametrize("scenario", COMMON_FILTER_SCENARIOS, ids=lambda s: s.id)
def test_filter(
    scenario: FilterScenario,
    cli_runner: CliRunner,
    om_client: OmClient,
    om_server_config: ServerConfig,
    session_uuid: str,
    registered_services: list[str],
    mysql_source_ready: None,
) -> None:
    """Filter variants (include exact / exclude exact / schema include / regex with exclude priority) pass STRICT mode."""
    expected_tables = expected_tables_for(scenario, _EXPECTED_TABLES_BY_VARIANT, connector="mysql")

    service = mysql_service_name(session_uuid, variant=f"filter_{scenario.variant}")
    registered_services.append(service)

    cfg = build_mysql_config(service, om_server_config)
    status = cli_runner.run(
        cfg.pipeline(MetadataPipeline(includeStoredProcedures=True)).with_filter(**scenario.filter_kwargs)
    )
    assert status.success, f"filter[{scenario.variant}] failures: {status.all_failures}"

    assert_service_matches(
        mysql_expected(service, tables=expected_tables),
        om_client,
        mode=MatchMode.STRICT,
    )
