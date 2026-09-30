#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Real Oracle source → CLI → persisted OpenMetadata metadata scenarios."""

import pytest
from sqlalchemy import text

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.utils import model_str

from ..features.database.catalog.differ import catalog_matches
from ..features.database.entities import (
    column_has_no_tag,
    column_has_tag,
    entity_exists,
    table_has_foreign_key,
    table_has_schema_definition,
    table_is_deleted,
)
from ..features.database.lineage import lineage_has_columns, lineage_has_edge, lineage_query
from ..features.database.pipelines import (
    AutoClassificationPipeline,
    LineagePipeline,
    MetadataPipeline,
)
from ..runtime import expect
from .checks import procedures_have_bodies
from .expected import oracle_expected
from .source import fresh_oracle_source


@pytest.mark.e2e_contract("catalog.metadata")
def test_catalog(cli, oracle):
    cli.run(oracle.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=True)))
    expected = oracle_expected(oracle.service_name, schema=oracle.source.schema)
    expect.poll(oracle.catalog_query()).satisfies(catalog_matches(expected))


@pytest.mark.e2e_contract("procedure.code")
def test_stored_procedure_bodies(cli, oracle):
    cli.run(oracle.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=True)))
    expect.poll(oracle.catalog_query()).satisfies(procedures_have_bodies)


@pytest.mark.e2e_contract("fk.relationships")
def test_foreign_key(cli, oracle):
    cli.run(oracle.invocation(MetadataPipeline()))
    expect.poll(oracle.table_query("TRANSACTIONS")).satisfies(
        table_has_foreign_key(("customer_id",), (oracle.column_fqn("CUSTOMERS", "id"),))
    )


@pytest.mark.e2e_contract("deletion.tables")
def test_mark_deleted_tables_on_reingest(cli, oracle):
    invocation = oracle.invocation(MetadataPipeline(markDeletedTables=True, includeStoredProcedures=False))
    cli.run(invocation)
    removed = oracle.table_query("ALL_TYPES")
    retained = oracle.table_query("CUSTOMERS")
    before = expect.poll(removed).satisfies(table_is_deleted(deleted=False))
    sibling = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    oracle.source.drop_table("all_types")
    cli.run(invocation)
    after = expect.poll(removed).satisfies(table_is_deleted(deleted=True))
    survivor = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    assert after.id == before.id
    assert survivor.id == sibling.id


@pytest.mark.e2e_contract("ingest.repeat")
def test_repeat_ingest_preserves_ids_and_updates_metadata(cli, oracle):
    expected = oracle_expected(oracle.service_name, schema=oracle.source.schema)
    options = MetadataPipeline(includeDDL=True, includeStoredProcedures=True)
    cli.run(oracle.invocation(options))
    before = expect.poll(oracle.catalog_query()).satisfies(catalog_matches(expected))
    original_ids = {model_str(table.fullyQualifiedName): table.id for table in before.tables}
    with oracle.source.admin_engine.begin() as connection:
        connection.execute(
            text(f"COMMENT ON TABLE {oracle.source.schema}.all_types IS 'Updated native values fixture'")
        )
    oracle.source.set_value("all_types", 1, "number_int_col", 654321)
    cli.run(
        oracle.invocation(
            MetadataPipeline(includeDDL=True, includeStoredProcedures=True, overrideMetadata=True),
        )
    )

    def updated(snapshot):
        catalog_matches(expected)(snapshot)
        assert len(snapshot.tables) == len(original_ids)
        assert {model_str(table.fullyQualifiedName): table.id for table in snapshot.tables} == original_ids
        table = snapshot.find(Table, oracle.table_fqn("ALL_TYPES"))
        assert model_str(table.description) == "Updated native values fixture"

    expect.poll(oracle.catalog_query()).satisfies(updated)


@pytest.mark.e2e_contract("lineage.view")
def test_lineage_view_references_tables(cli, oracle):
    """The view's DDL is stored, and parsing it yields table- and column-level edges."""
    cli.run(oracle.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=False)))
    for name in ("CUSTOMERS", "TRANSACTIONS"):
        expect.poll(oracle.table_query(name)).satisfies(entity_exists)
    view = oracle.table_fqn("customer_txn_summary")
    # Prove the DDL landed before asserting on edges parsed from it, so a missing-DDL
    # regression is distinguishable from a parser regression.
    expect.poll(oracle.table_query("customer_txn_summary")).satisfies(table_has_schema_definition("LEFT JOIN"))

    # processQueryLineage=False: the ingestion account has no query-history access, and
    # this asserts view lineage specifically.
    cli.run(oracle.invocation(LineagePipeline(processQueryLineage=False)))

    def check(graph):
        lineage_has_edge(oracle.table_fqn("CUSTOMERS"), view)(graph)
        lineage_has_edge(oracle.table_fqn("TRANSACTIONS"), view)(graph)
        lineage_has_columns(
            (oracle.column_fqn("CUSTOMERS", "id"), oracle.column_fqn("TRANSACTIONS", "amount")),
            (
                oracle.column_fqn("customer_txn_summary", "customer_id"),
                oracle.column_fqn("customer_txn_summary", "total_amount"),
            ),
        )(graph)

    expect.poll(lineage_query(oracle.om, view)).satisfies(check)


@pytest.mark.e2e_contract("classification.tags")
def test_auto_classification_tags_pii_columns(cli, oracle):
    """PII columns are tagged and non-PII columns are left alone."""
    cli.run(oracle.invocation(MetadataPipeline(includeStoredProcedures=False)))
    expect.poll(oracle.table_query("CUSTOMERS")).satisfies(entity_exists)
    cli.run(
        oracle.invocation(
            AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=True, confidence=60)
        )
    )

    def check(table):
        column_has_tag("email", "PII.Sensitive")(table)
        column_has_tag("date_of_birth", "PII.NonSensitive")(table)
        # The negative half matters: without it, a classifier that tags everything passes.
        for name in ("id", "status"):
            for tag in ("PII.Sensitive", "PII.NonSensitive"):
                column_has_no_tag(name, tag)(table)

    expect.poll(oracle.table_query("CUSTOMERS")).satisfies(check)


@pytest.mark.parametrize(
    "filters, expected_tables",
    [
        pytest.param(
            {"tableFilterPattern": {"includes": ["customers"]}},
            {"CUSTOMERS"},
            id="include-one",
            marks=pytest.mark.e2e_contract("filter.table.include-one"),
        ),
        pytest.param(
            {"tableFilterPattern": {"excludes": ["transactions"]}},
            {"CUSTOMERS", "ALL_TYPES", "customer_txn_summary"},
            id="exclude-one",
            marks=pytest.mark.e2e_contract("filter.table.exclude-one"),
        ),
        pytest.param(
            {"tableFilterPattern": {"includes": ["customers", "transactions"], "excludes": ["transactions"]}},
            {"CUSTOMERS"},
            id="mix",
            marks=pytest.mark.e2e_contract("filter.table.mix"),
        ),
    ],
)
def test_table_filter(filters, expected_tables, cli, oracle):
    cli.run(oracle.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=True), filters=filters))
    expected = oracle_expected(oracle.service_name, schema=oracle.source.schema, tables=expected_tables)
    expect.poll(oracle.catalog_query()).satisfies(catalog_matches(expected))


@pytest.mark.e2e_contract("filter.schema.include-one")
def test_schema_filter_include_one(cli, oracle, oracle_admin_engine, oracle_ingestion_engine):
    with fresh_oracle_source(oracle_admin_engine) as excluded:
        # Prove both schemas are populated and readable before trusting the exclusion.
        for source in (oracle.source, excluded):
            with oracle_ingestion_engine.connect() as connection:
                assert connection.execute(text(f"SELECT COUNT(*) FROM {source.schema}.customers")).scalar_one() == 5
        invocation = oracle.invocation(
            MetadataPipeline(includeDDL=True, includeStoredProcedures=True),
            sources=(oracle.source, excluded),
            filters={"schemaFilterPattern": {"includes": [f"^{oracle.source.schema}$"]}},
        )
        cli.run(invocation)
        expected = oracle_expected(oracle.service_name, schema=oracle.source.schema)
        expect.poll(oracle.catalog_query()).satisfies(catalog_matches(expected))
