#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL pilot — CLI E2E v2 tests.

Exercises the v2 framework end-to-end against a MySQL source. Covers all
five pipelines (metadata, profiler, auto-classification, and view lineage
via SQL parsing; DQ deferred to post-MVP) plus four filter scenarios.

Lineage note: MySQL FK constraints produce TableConstraint entries on the
table entity, not lineage edges. The only real lineage MySQL surfaces is
view-to-table lineage derived from parsing the view definition SQL. There
is no FK-based lineage test here.

Session-shared tests use the module-scoped mysql_cfg (same service across
tests — ingestion is idempotent; later tests can assume prior ingest ran,
but for safety each test re-runs the metadata pipeline before its
specialized assertion).

Filter tests build isolated variant-named services so per-test "exclude"
assertions can rely on STRICT-mode extras detection without cross-test
state leakage.
"""

from __future__ import annotations

import pytest

from metadata.generated.schema.entity.data.table import DataType

from ..core.config.builder import WorkflowConfig
from ..core.config.server import ServerConfig
from ..core.expected.differ import MatchMode, assert_service_matches
from ..core.fluent.om_client import OmClient
from ..core.runner.cli_runner import CliRunner
from .connector import build_mysql_config, mysql_service_name
from .expected import mysql_expected


# ---------------------------------------------------------------------------
# Structural (metadata pipeline)
# ---------------------------------------------------------------------------


def test_vanilla_ingest_structural(
    cli_runner: CliRunner,
    om_client: OmClient,
    mysql_cfg: WorkflowConfig,
    session_uuid: str,
    registered_services: list[str],
) -> None:
    """Vanilla metadata ingest produces the declared OM catalog (SUPERSET)."""
    service = mysql_service_name(session_uuid)
    registered_services.append(service)

    status = cli_runner.run(
        mysql_cfg.as_metadata(include_stored_procedures=True)
    )
    assert status.success, f"ingest failures: {status.all_failures}"

    assert_service_matches(mysql_expected(service), om_client)


def test_all_types_column_mappings(
    cli_runner: CliRunner,
    om_client: OmClient,
    mysql_cfg: WorkflowConfig,
    session_uuid: str,
    registered_services: list[str],
) -> None:
    """Spot-check representative type mappings in the all_types table.

    Structural diff already walks every column; these drill-downs assert
    specific DataType enum values that Task 25 may need to correct after
    seeing the connector's actual output.
    """
    service = mysql_service_name(session_uuid)
    registered_services.append(service)

    cli_runner.run(mysql_cfg.as_metadata())

    fqn = f"{service}.default.e2e.all_types"
    om_client.table(fqn).exists()
    om_client.table(fqn).column("big_int_col").has_type(DataType.BIGINT)
    om_client.table(fqn).column("json_col").has_type(DataType.JSON)
    om_client.table(fqn).column("date_col").has_type(DataType.DATE)
    om_client.table(fqn).column("bit_col").has_type(DataType.BIT)
    om_client.table(fqn).column("enum_col").has_type(DataType.ENUM)


# ---------------------------------------------------------------------------
# Profiler
# ---------------------------------------------------------------------------


def test_profiler_row_counts(
    cli_runner: CliRunner,
    om_client: OmClient,
    mysql_cfg: WorkflowConfig,
    session_uuid: str,
    registered_services: list[str],
) -> None:
    """Profiler reports exact row counts matching the deterministic seed."""
    service = mysql_service_name(session_uuid)
    registered_services.append(service)

    # Metadata ingest establishes tables so the profiler has targets.
    cli_runner.run(mysql_cfg.as_metadata())
    status = cli_runner.run(mysql_cfg.as_profiler())
    assert status.success, f"profiler failures: {status.all_failures}"

    om_client.table(
        f"{service}.default.e2e.customers"
    ).profile.eventually().row_count().equals(10)
    om_client.table(
        f"{service}.default.e2e.transactions"
    ).profile.eventually().row_count().equals(10)
    om_client.table(
        f"{service}.default.e2e.all_types"
    ).profile.eventually().row_count().equals(3)


# ---------------------------------------------------------------------------
# Stored procedure
# ---------------------------------------------------------------------------


def test_stored_procedure_ingested(
    cli_runner: CliRunner,
    om_client: OmClient,
    mysql_cfg: WorkflowConfig,
    session_uuid: str,
    registered_services: list[str],
) -> None:
    """Stored procedure appears in OM with includeStoredProcedures=True."""
    service = mysql_service_name(session_uuid)
    registered_services.append(service)

    cli_runner.run(mysql_cfg.as_metadata(include_stored_procedures=True))

    sp_fqn = f"{service}.default.e2e.sp_active_customer_count"
    om_client.stored_procedure(sp_fqn).exists()
    om_client.stored_procedure(sp_fqn).has_code_containing("SELECT COUNT(*)")


# ---------------------------------------------------------------------------
# Lineage
# ---------------------------------------------------------------------------


def test_lineage_view_references_tables(
    cli_runner: CliRunner,
    om_client: OmClient,
    mysql_cfg: WorkflowConfig,
    session_uuid: str,
    registered_services: list[str],
) -> None:
    """View definition produces lineage from view → referenced tables."""
    service = mysql_service_name(session_uuid)
    registered_services.append(service)

    cli_runner.run(mysql_cfg.as_metadata())

    view_fqn = f"{service}.default.e2e.customer_txn_summary"
    customers_fqn = f"{service}.default.e2e.customers"
    transactions_fqn = f"{service}.default.e2e.transactions"

    om_client.table(view_fqn).lineage.eventually().has_upstream(customers_fqn)
    om_client.table(view_fqn).lineage.eventually().has_upstream(transactions_fqn)


# ---------------------------------------------------------------------------
# Service level
# ---------------------------------------------------------------------------


def test_service_entity_counts(
    cli_runner: CliRunner,
    om_client: OmClient,
    mysql_cfg: WorkflowConfig,
    session_uuid: str,
    registered_services: list[str],
) -> None:
    """Service-level smoke: ≥4 tables (3 base + 1 view), ≥1 schema."""
    service = mysql_service_name(session_uuid)
    registered_services.append(service)

    cli_runner.run(mysql_cfg.as_metadata())

    om_client.service(service).exists()
    om_client.service(service).eventually().has_entity_count("tables", at_least=4)
    om_client.service(service).has_entity_count("schemas", at_least=1)


# ---------------------------------------------------------------------------
# Auto-classification (PII via column-name regex)
# ---------------------------------------------------------------------------


def test_auto_classification_tags_pii_columns(
    cli_runner: CliRunner,
    om_client: OmClient,
    mysql_cfg: WorkflowConfig,
    session_uuid: str,
    registered_services: list[str],
) -> None:
    """Auto-classification tags PII columns by column name.

    Exercises the column-name pattern recognizers (no Presidio NER here, which
    is value-based and non-deterministic). The exact tag FQNs (PII.Sensitive vs
    PII.NonSensitive) may need adjustment after Task 25 live run confirms what
    the pipeline emits for each column-name recognizer.
    """
    service = mysql_service_name(session_uuid)
    registered_services.append(service)

    # Metadata first so columns exist; auto-classification annotates them.
    cli_runner.run(mysql_cfg.as_metadata())
    status = cli_runner.run(mysql_cfg.as_auto_classification())
    assert status.success, f"auto-classification failures: {status.all_failures}"

    customers_fqn = f"{service}.default.e2e.customers"
    # Sensitive recognizers (per pii/algorithms/tags.py SENSITIVE set)
    om_client.table(customers_fqn).column("email").has_tag("PII.Sensitive")
    om_client.table(customers_fqn).column("ssn").has_tag("PII.Sensitive")
    om_client.table(customers_fqn).column("first_name").has_tag("PII.Sensitive")
    # Non-sensitive recognizers
    om_client.table(customers_fqn).column("phone").has_tag("PII.NonSensitive")
    om_client.table(customers_fqn).column("address").has_tag("PII.NonSensitive")
    om_client.table(customers_fqn).column("date_of_birth").has_tag("PII.NonSensitive")


# ---------------------------------------------------------------------------
# Filter scenarios — isolated services
# ---------------------------------------------------------------------------


def test_filter_tables_include_exact(
    cli_runner: CliRunner,
    om_client: OmClient,
    om_server_config: ServerConfig,
    session_uuid: str,
    registered_services: list[str],
    mysql_source_ready: None,  # ensure source is ready
) -> None:
    """tables_include with exact name: only the named table lands in OM."""
    service = mysql_service_name(session_uuid, variant="filter_inc_exact")
    registered_services.append(service)

    cfg = build_mysql_config(service, om_server_config)
    status = cli_runner.run(
        cfg.as_metadata(include_stored_procedures=True).with_filter(
            tables_include=["customers"],
        )
    )
    assert status.success, f"filter-include failures: {status.all_failures}"

    assert_service_matches(
        mysql_expected(service, tables=["customers"]),
        om_client,
        mode=MatchMode.STRICT,
    )


def test_filter_tables_exclude_exact(
    cli_runner: CliRunner,
    om_client: OmClient,
    om_server_config: ServerConfig,
    session_uuid: str,
    registered_services: list[str],
    mysql_source_ready: None,
) -> None:
    """tables_exclude with exact name: everything except the excluded lands in OM."""
    service = mysql_service_name(session_uuid, variant="filter_exc_exact")
    registered_services.append(service)

    cfg = build_mysql_config(service, om_server_config)
    status = cli_runner.run(
        cfg.as_metadata(include_stored_procedures=True).with_filter(
            tables_exclude=["all_types"],
        )
    )
    assert status.success, f"filter-exclude failures: {status.all_failures}"

    assert_service_matches(
        mysql_expected(
            service,
            tables=["customers", "transactions", "customer_txn_summary"],
        ),
        om_client,
        mode=MatchMode.STRICT,
    )


def test_filter_schemas_include_only_e2e(
    cli_runner: CliRunner,
    om_client: OmClient,
    om_server_config: ServerConfig,
    session_uuid: str,
    registered_services: list[str],
    mysql_source_ready: None,
) -> None:
    """schemas_include restricts ingest to e2e; system schemas absent from OM."""
    service = mysql_service_name(session_uuid, variant="filter_sch_inc")
    registered_services.append(service)

    cfg = build_mysql_config(service, om_server_config)
    status = cli_runner.run(
        cfg.as_metadata(include_stored_procedures=True).with_filter(
            schemas_include=["e2e"],
        )
    )
    assert status.success, f"schema-include failures: {status.all_failures}"

    assert_service_matches(mysql_expected(service), om_client, mode=MatchMode.STRICT)
    om_client.service(service).has_entity_count("schemas", at_least=1)


def test_filter_regex_exclude_has_priority_over_include(
    cli_runner: CliRunner,
    om_client: OmClient,
    om_server_config: ServerConfig,
    session_uuid: str,
    registered_services: list[str],
    mysql_source_ready: None,
) -> None:
    """Regex include + exclude: exclude wins where both patterns match.

    include=['customer.*'] matches `customers` AND `customer_txn_summary`.
    exclude=['customer_txn.*'] matches `customer_txn_summary`.
    Expected: only `customers` survives — exclude takes priority on the
    intersection, verifying OM's documented filter semantic.
    """
    service = mysql_service_name(session_uuid, variant="filter_regex_prio")
    registered_services.append(service)

    cfg = build_mysql_config(service, om_server_config)
    status = cli_runner.run(
        cfg.as_metadata(include_stored_procedures=True).with_filter(
            tables_include=["customer.*"],
            tables_exclude=["customer_txn.*"],
        )
    )
    assert status.success, f"regex-filter failures: {status.all_failures}"

    assert_service_matches(
        mysql_expected(service, tables=["customers"]),
        om_client,
        mode=MatchMode.STRICT,
    )
