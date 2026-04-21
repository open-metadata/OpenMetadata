#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL pilot — CLI E2E v2 tests.

Exercises the v2 framework end-to-end against a MySQL source. Covers all
the pipelines the MVP ships (metadata, profiler, auto-classification, and
view lineage via SQL parsing; DQ deferred to post-MVP) plus four filter
scenarios and FK/description coverage.

Lineage note: MySQL FK constraints produce TableConstraint entries on the
table entity, not lineage edges (see `project-mysql-fk-no-lineage.md`).
The only real lineage MySQL surfaces is view-to-table lineage derived from
parsing the view definition SQL. The FK assertion in this module targets
`tableConstraints`, not upstream edges.

Module-scoped `mysql_metadata_ingested` runs the metadata CLI once for all
tests that consume the shared service — profiler, lineage, classification,
structural, description, FK. That fixture also registers the service name
for session-end cleanup.

Filter tests build isolated variant-named services so per-test "exclude"
assertions can rely on STRICT-mode extras detection without cross-test
state leakage. They register their own services.
"""

from __future__ import annotations

from metadata.generated.schema.entity.data.table import DataType

from ..core.config.builder import WorkflowConfig
from ..core.config.pipelines import (
    AutoClassificationPipeline,
    MetadataPipeline,
    ProfilerPipeline,
)
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
    om_client: OmClient,
    session_uuid: str,
    mysql_metadata_ingested: None,
) -> None:
    """Metadata ingest produces the declared OM catalog (SUPERSET).

    Walks the full Expected* tree — table structure, columns, constraints,
    table + column descriptions, stored procedures. Success of the CLI
    subprocess is asserted inside the fixture.
    """
    service = mysql_service_name(session_uuid)
    assert_service_matches(mysql_expected(service), om_client)


def test_all_types_column_mappings(
    om_client: OmClient,
    session_uuid: str,
    mysql_metadata_ingested: None,
) -> None:
    """Spot-check representative type mappings in the all_types table.

    Structural diff already walks every column; these drill-downs assert
    specific DataType enum values that Task 25 may need to correct after
    seeing the connector's actual output.
    """
    service = mysql_service_name(session_uuid)
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
    mysql_metadata_ingested: None,
) -> None:
    """Profiler reports exact row counts matching the deterministic seed.

    Depends on mysql_metadata_ingested to establish tables so the profiler
    has targets; the test itself only runs the profiler pipeline.
    """
    service = mysql_service_name(session_uuid)
    status = cli_runner.run(mysql_cfg.pipeline(ProfilerPipeline()))
    assert status.success, f"profiler failures: {status.all_failures}"

    om_client.table(
        f"{service}.default.e2e.customers"
    ).profile.eventually().row_count().equals(5)
    om_client.table(
        f"{service}.default.e2e.transactions"
    ).profile.eventually().row_count().equals(5)
    om_client.table(
        f"{service}.default.e2e.all_types"
    ).profile.eventually().row_count().equals(3)


# ---------------------------------------------------------------------------
# Stored procedure
# ---------------------------------------------------------------------------


def test_stored_procedure_ingested(
    om_client: OmClient,
    session_uuid: str,
    mysql_metadata_ingested: None,
) -> None:
    """Stored procedure appears in OM with includeStoredProcedures=True."""
    service = mysql_service_name(session_uuid)
    sp_fqn = f"{service}.default.e2e.sp_active_customer_count"
    om_client.stored_procedure(sp_fqn).exists()
    om_client.stored_procedure(sp_fqn).has_code_containing("SELECT COUNT(*)")


# ---------------------------------------------------------------------------
# Lineage
# ---------------------------------------------------------------------------


def test_lineage_view_references_tables(
    om_client: OmClient,
    session_uuid: str,
    mysql_metadata_ingested: None,
) -> None:
    """View definition produces lineage from view → referenced tables."""
    service = mysql_service_name(session_uuid)
    view_fqn = f"{service}.default.e2e.customer_txn_summary"
    customers_fqn = f"{service}.default.e2e.customers"
    transactions_fqn = f"{service}.default.e2e.transactions"

    om_client.table(view_fqn).lineage.eventually().has_upstream(customers_fqn)
    om_client.table(view_fqn).lineage.eventually().has_upstream(transactions_fqn)


# ---------------------------------------------------------------------------
# Foreign key TableConstraint (no lineage edge for MySQL)
# ---------------------------------------------------------------------------


def test_transactions_foreign_key_constraint(
    om_client: OmClient,
    session_uuid: str,
    mysql_metadata_ingested: None,
) -> None:
    """FK on transactions.customer_id -> customers.id lands as TableConstraint.

    MySQL doesn't emit lineage edges from FK declarations (see
    `project-mysql-fk-no-lineage.md`). The connector populates the Table
    entity's tableConstraints list with constraintType=FOREIGN_KEY.
    """
    service = mysql_service_name(session_uuid)
    transactions_fqn = f"{service}.default.e2e.transactions"

    om_client.table(transactions_fqn).has_foreign_key_constraint(
        column="customer_id",
        referenced_table="customers",
        referenced_column="id",
    )


# ---------------------------------------------------------------------------
# Service level
# ---------------------------------------------------------------------------


def test_service_entity_counts(
    om_client: OmClient,
    session_uuid: str,
    mysql_metadata_ingested: None,
) -> None:
    """Service-level smoke: >=4 tables (3 base + 1 view), >=1 schema."""
    service = mysql_service_name(session_uuid)
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
    mysql_metadata_ingested: None,
) -> None:
    """Auto-classification tags PII columns by column name.

    Exercises the column-name pattern recognizers (no Presidio NER here, which
    is value-based and non-deterministic). The exact tag FQNs (PII.Sensitive
    vs PII.NonSensitive) may need adjustment after Task 25 live run confirms
    what the pipeline emits for each column-name recognizer.
    """
    service = mysql_service_name(session_uuid)
    status = cli_runner.run(mysql_cfg.pipeline(AutoClassificationPipeline()))
    assert status.success, f"auto-classification failures: {status.all_failures}"

    customers_fqn = f"{service}.default.e2e.customers"
    om_client.table(customers_fqn).column("email").has_tag("PII.Sensitive")
    om_client.table(customers_fqn).column("ssn").has_tag("PII.Sensitive")
    om_client.table(customers_fqn).column("first_name").has_tag("PII.Sensitive")
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
    mysql_source_ready: None,
) -> None:
    """tables_include with exact name: only the named table lands in OM."""
    service = mysql_service_name(session_uuid, variant="filter_inc_exact")
    registered_services.append(service)

    cfg = build_mysql_config(service, om_server_config)
    status = cli_runner.run(
        cfg.pipeline(MetadataPipeline(includeStoredProcedures=True)).with_filter(
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
        cfg.pipeline(MetadataPipeline(includeStoredProcedures=True)).with_filter(
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
        cfg.pipeline(MetadataPipeline(includeStoredProcedures=True)).with_filter(
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
        cfg.pipeline(MetadataPipeline(includeStoredProcedures=True)).with_filter(
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
