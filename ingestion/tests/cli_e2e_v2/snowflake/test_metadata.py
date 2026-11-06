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
"""Real Snowflake source to CLI to persisted metadata scenarios.

Routines live in ACCOUNT_USAGE only, so these runs set `includeStoredProcedures=False`
and leave routine coverage to the shim-backed `procedure.code` scenario.
"""

import re

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.utils import model_str

from ..features.database.catalog.differ import catalog_matches
from ..features.database.entities import (
    column_has_no_tag,
    column_has_tag,
    entity_exists,
    table_has_foreign_key,
    table_is_deleted,
)
from ..features.database.lineage import lineage_has_columns, lineage_has_edge, lineage_query
from ..features.database.pipelines import AutoClassificationPipeline, LineagePipeline, MetadataPipeline
from ..features.database.samples import sample_query
from ..runtime import expect
from .checks import indexed_schema_definition_contains, indexed_table_query, native_sample_rows
from .expected import snowflake_expected, snowflake_schema


def _expected(snowflake, *, tables=None):
    database = snowflake.instance.database
    return snowflake_expected(
        snowflake.service_name, database, snowflake_schema(database, snowflake.source.schema, tables=tables)
    )


def _metadata(**options):
    return MetadataPipeline(includeDDL=True, includeStoredProcedures=False, **options)


@pytest.mark.e2e_contract("catalog.metadata")
def test_catalog(cli, snowflake):
    cli.run(snowflake.invocation(_metadata()))
    expect.poll(snowflake.catalog_query()).satisfies(catalog_matches(_expected(snowflake)))


@pytest.mark.e2e_contract("fk.relationships")
def test_foreign_key(cli, snowflake):
    """Snowflake keeps foreign keys only as metadata, and ingestion must still persist the relationship."""
    cli.run(snowflake.invocation(_metadata()))
    expect.poll(snowflake.table_query("TRANSACTIONS")).satisfies(
        table_has_foreign_key(("CUSTOMER_ID",), (snowflake.column_fqn("CUSTOMERS", "ID"),))
    )


@pytest.mark.e2e_contract("lineage.view")
def test_lineage_view_references_tables(cli, snowflake):
    cli.run(snowflake.invocation(_metadata()))
    for name in ("CUSTOMERS", "TRANSACTIONS"):
        expect.poll(snowflake.table_query(name)).satisfies(entity_exists)
    view = snowflake.table_fqn("CUSTOMER_TXN_SUMMARY")
    expect.poll(indexed_table_query(snowflake.om, view)).satisfies(indexed_schema_definition_contains("LEFT JOIN"))
    # v1 asserted only view lineage. Query-log lineage reads ACCOUNT_USAGE and stays out of scope.
    cli.run(
        snowflake.invocation(
            LineagePipeline(processViewLineage=True, processQueryLineage=False, processStoredProcedureLineage=False)
        )
    )

    def check(graph):
        lineage_has_edge(snowflake.table_fqn("CUSTOMERS"), view)(graph)
        lineage_has_edge(snowflake.table_fqn("TRANSACTIONS"), view)(graph)
        lineage_has_columns(
            (snowflake.column_fqn("CUSTOMERS", "ID"), snowflake.column_fqn("TRANSACTIONS", "AMOUNT")),
            (
                snowflake.column_fqn("CUSTOMER_TXN_SUMMARY", "CUSTOMER_ID"),
                snowflake.column_fqn("CUSTOMER_TXN_SUMMARY", "TOTAL_AMOUNT"),
            ),
        )(graph)

    expect.poll(lineage_query(snowflake.om, view)).satisfies(check)


@pytest.mark.e2e_contract("classification.tags")
def test_auto_classification_tags_pii_columns(cli, snowflake):
    cli.run(snowflake.invocation(_metadata()))
    expect.poll(snowflake.table_query("CUSTOMERS")).satisfies(entity_exists)
    cli.run(
        snowflake.invocation(
            AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=True, confidence=60)
        )
    )

    def check(table):
        column_has_tag("EMAIL", "PII.Sensitive")(table)
        column_has_tag("DATE_OF_BIRTH", "PII.NonSensitive")(table)
        for name in ("ID", "STATUS"):
            for tag in ("PII.Sensitive", "PII.NonSensitive"):
                column_has_no_tag(name, tag)(table)

    expect.poll(snowflake.table_query("CUSTOMERS")).satisfies(check)


@pytest.mark.e2e_contract("deletion.tables")
def test_mark_deleted_tables_on_reingest(cli, snowflake):
    invocation = snowflake.invocation(_metadata(markDeletedTables=True))
    cli.run(invocation)
    removed = snowflake.table_query("ALL_TYPES")
    retained = snowflake.table_query("CUSTOMERS")
    before = expect.poll(removed).satisfies(table_is_deleted(deleted=False))
    sibling = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    snowflake.source.drop_table("ALL_TYPES")
    cli.run(invocation)
    after = expect.poll(removed).satisfies(table_is_deleted(deleted=True))
    survivor = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    assert after.id == before.id
    assert survivor.id == sibling.id


@pytest.mark.e2e_contract("ingest.repeat")
def test_repeat_ingest_preserves_ids_and_updates_metadata(cli, snowflake):
    expected = _expected(snowflake)
    cli.run(snowflake.invocation(_metadata()))
    before = expect.poll(snowflake.catalog_query()).satisfies(catalog_matches(expected))
    original_ids = {model_str(table.fullyQualifiedName): table.id for table in before.tables}
    snowflake.source.set_description("ALL_TYPES", "Updated native values fixture")
    snowflake.source.set_value("ALL_TYPES", 1, "INT_COL", 654321)
    cli.run(snowflake.invocation(_metadata(overrideMetadata=True)))

    def updated(snapshot):
        catalog_matches(expected)(snapshot)
        assert len(snapshot.tables) == len(original_ids)
        assert {model_str(table.fullyQualifiedName): table.id for table in snapshot.tables} == original_ids
        table = snapshot.find(Table, snowflake.table_fqn("ALL_TYPES"))
        assert model_str(table.description) == "Updated native values fixture"

    expect.poll(snowflake.catalog_query()).satisfies(updated)
    table = expect.poll(snowflake.table_query("ALL_TYPES")).satisfies(entity_exists)
    cli.run(
        snowflake.invocation(
            AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=False, sampleDataCount=10),
            filters={"tableFilterPattern": {"includes": ["^ALL_TYPES$"]}},
        )
    )

    def updated_values(sampled):
        rows = native_sample_rows(sampled)
        assert {key: row["INT_COL"] for key, row in rows.items()} == {1: 654321, 2: None, 3: None}

    expect.poll(sample_query(snowflake.om, table)).satisfies(updated_values)


@pytest.mark.parametrize(
    "filters, expected_tables",
    [
        pytest.param(
            {"tableFilterPattern": {"includes": ["CUSTOMERS"]}},
            {"CUSTOMERS"},
            id="include-one",
            marks=pytest.mark.e2e_contract("filter.table.include-one"),
        ),
        pytest.param(
            {"tableFilterPattern": {"excludes": ["TRANSACTIONS"]}},
            {"CUSTOMERS", "ALL_TYPES", "CUSTOMER_TXN_SUMMARY"},
            id="exclude-one",
            marks=pytest.mark.e2e_contract("filter.table.exclude-one"),
        ),
        pytest.param(
            {"tableFilterPattern": {"includes": ["CUSTOMER.*"], "excludes": ["CUSTOMER_TXN.*"]}},
            {"CUSTOMERS"},
            id="regex-exclude-wins",
            marks=pytest.mark.e2e_contract("filter.table.regex-exclude-wins"),
        ),
        pytest.param(
            {
                "tableFilterPattern": {
                    "includes": [".*"],
                    "excludes": ["TRANSACTIONS", "ALL_TYPES", "CUSTOMER_TXN_SUMMARY"],
                }
            },
            {"CUSTOMERS"},
            id="exclude-wins",
            marks=pytest.mark.e2e_contract("filter.table.exclude-wins"),
        ),
    ],
)
def test_table_filter(filters, expected_tables, cli, snowflake):
    """Every Snowflake run also carries the owned-schema filter, so these are v1's schema and table mixes."""
    cli.run(snowflake.invocation(_metadata(), filters=filters))
    expect.poll(snowflake.catalog_query()).satisfies(catalog_matches(_expected(snowflake, tables=expected_tables)))


@pytest.mark.parametrize(
    "filter_kind",
    [
        pytest.param("include-one", marks=pytest.mark.e2e_contract("filter.schema.include-one")),
        pytest.param("exclude-wins", marks=pytest.mark.e2e_contract("filter.schema.exclude-wins")),
    ],
)
def test_schema_filter(filter_kind, cli, snowflake, snowflake_secondary_source):
    for source in (snowflake.source, snowflake_secondary_source):
        assert source.run(f"SELECT COUNT(*) FROM {source.qualified}.customers") == [(5,)]
    kept, dropped = (f"^{re.escape(source.schema)}$" for source in (snowflake.source, snowflake_secondary_source))
    pattern = {"includes": [kept]}
    if filter_kind == "exclude-wins":
        pattern = {"includes": [kept, dropped], "excludes": [dropped]}
    cli.run(
        snowflake.invocation(
            _metadata(),
            sources=(snowflake.source, snowflake_secondary_source),
            filters={"schemaFilterPattern": pattern},
        )
    )
    expect.poll(snowflake.catalog_query()).satisfies(catalog_matches(_expected(snowflake)))
