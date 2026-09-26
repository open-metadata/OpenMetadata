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
"""Real BigQuery source → CLI → persisted OpenMetadata metadata scenarios."""

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
from .checks import (
    indexed_schema_definition_contains,
    indexed_table_query,
    native_sample_rows,
    procedures_have_bodies,
)
from .expected import bigquery_database, bigquery_expected
from .source import fresh_bigquery_source


def _expected(bigquery, *, tables=None):
    return bigquery_expected(
        bigquery.service_name,
        bigquery_database(bigquery.source.project_id, bigquery.source.dataset, tables=tables),
    )


@pytest.mark.e2e_contract("catalog.metadata")
def test_catalog(cli, bigquery):
    cli.run(bigquery.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=True)))
    expect.poll(bigquery.catalog_query()).satisfies(catalog_matches(_expected(bigquery)))


@pytest.mark.e2e_contract("catalog.multi-project")
def test_multi_project_catalog(cli, bigquery, bigquery_secondary_source):
    """A projectId list yields one OM database per project, each holding only its owned dataset."""
    invocation = bigquery.invocation(
        MetadataPipeline(includeDDL=True, includeStoredProcedures=True),
        sources=(bigquery.source, bigquery_secondary_source),
    )
    connection = invocation.config["source"]["serviceConnection"]["config"]
    assert isinstance(connection["credentials"]["gcpConfig"]["projectId"], list)
    assert "billingProjectId" not in connection
    cli.run(invocation)
    expected = bigquery_expected(
        bigquery.service_name,
        bigquery_database(bigquery.source.project_id, bigquery.source.dataset),
        bigquery_database(bigquery_secondary_source.project_id, bigquery_secondary_source.dataset),
    )
    expect.poll(bigquery.catalog_query()).satisfies(catalog_matches(expected))


@pytest.mark.e2e_contract("procedure.code")
def test_stored_procedure_bodies(cli, bigquery):
    cli.run(bigquery.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=True)))
    expect.poll(bigquery.catalog_query()).satisfies(procedures_have_bodies)


@pytest.mark.e2e_contract("fk.relationships")
def test_foreign_key(cli, bigquery):
    """BigQuery keeps NOT ENFORCED keys only as metadata; OM must still persist the relationship."""
    cli.run(bigquery.invocation(MetadataPipeline()))
    expect.poll(bigquery.table_query("transactions")).satisfies(
        table_has_foreign_key(("customer_id",), (bigquery.column_fqn("customers", "id"),))
    )


@pytest.mark.e2e_contract("lineage.view")
def test_lineage_view_references_tables(cli, bigquery):
    cli.run(bigquery.invocation(MetadataPipeline(includeDDL=True)))
    for name in ("customers", "transactions"):
        expect.poll(bigquery.table_query(name)).satisfies(entity_exists)
    view = bigquery.table_fqn("customer_txn_summary")
    expect.poll(indexed_table_query(bigquery.om, view)).satisfies(indexed_schema_definition_contains("LEFT JOIN"))
    # v1 enabled query-log lineage but asserted only view lineage; audit-log lineage stays out of scope.
    cli.run(
        bigquery.invocation(
            LineagePipeline(processViewLineage=True, processQueryLineage=False, processStoredProcedureLineage=False)
        )
    )

    def check(graph):
        lineage_has_edge(bigquery.table_fqn("customers"), view)(graph)
        lineage_has_edge(bigquery.table_fqn("transactions"), view)(graph)
        lineage_has_columns(
            (bigquery.column_fqn("customers", "id"), bigquery.column_fqn("transactions", "amount")),
            (
                bigquery.column_fqn("customer_txn_summary", "customer_id"),
                bigquery.column_fqn("customer_txn_summary", "total_amount"),
            ),
        )(graph)

    expect.poll(lineage_query(bigquery.om, view)).satisfies(check)


@pytest.mark.e2e_contract("classification.tags")
def test_auto_classification_tags_pii_columns(cli, bigquery):
    cli.run(bigquery.invocation(MetadataPipeline()))
    expect.poll(bigquery.table_query("customers")).satisfies(entity_exists)
    cli.run(
        bigquery.invocation(
            AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=True, confidence=60)
        )
    )

    def check(table):
        column_has_tag("email", "PII.Sensitive")(table)
        column_has_tag("date_of_birth", "PII.NonSensitive")(table)
        for name in ("id", "status"):
            for tag in ("PII.Sensitive", "PII.NonSensitive"):
                column_has_no_tag(name, tag)(table)

    expect.poll(bigquery.table_query("customers")).satisfies(check)


@pytest.mark.e2e_contract("deletion.tables")
def test_mark_deleted_tables_on_reingest(cli, bigquery):
    invocation = bigquery.invocation(MetadataPipeline(markDeletedTables=True, includeStoredProcedures=False))
    cli.run(invocation)
    removed = bigquery.table_query("all_types")
    retained = bigquery.table_query("customers")
    before = expect.poll(removed).satisfies(table_is_deleted(deleted=False))
    sibling = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    bigquery.source.drop_table("all_types")
    cli.run(invocation)
    after = expect.poll(removed).satisfies(table_is_deleted(deleted=True))
    survivor = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    assert after.id == before.id
    assert survivor.id == sibling.id


@pytest.mark.e2e_contract("ingest.repeat")
def test_repeat_ingest_preserves_ids_and_updates_metadata(cli, bigquery):
    expected = _expected(bigquery)
    cli.run(bigquery.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=True)))
    before = expect.poll(bigquery.catalog_query()).satisfies(catalog_matches(expected))
    original_ids = {model_str(table.fullyQualifiedName): table.id for table in before.tables}
    bigquery.source.set_description("all_types", "Updated native values fixture")
    bigquery.source.set_value("all_types", 1, "int_col", 654321)
    cli.run(bigquery.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=True, overrideMetadata=True)))

    def updated(snapshot):
        catalog_matches(expected)(snapshot)
        assert len(snapshot.tables) == len(original_ids)
        assert {model_str(table.fullyQualifiedName): table.id for table in snapshot.tables} == original_ids
        table = snapshot.find(Table, bigquery.table_fqn("all_types"))
        assert model_str(table.description) == "Updated native values fixture"

    expect.poll(bigquery.catalog_query()).satisfies(updated)
    table = expect.poll(bigquery.table_query("all_types")).satisfies(entity_exists)
    cli.run(
        bigquery.invocation(
            AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=False, sampleDataCount=10),
            filters={"tableFilterPattern": {"includes": ["^all_types$"]}},
        )
    )

    def updated_values(sampled):
        rows = native_sample_rows(sampled)
        assert {key: row["int_col"] for key, row in rows.items()} == {1: 654321, 2: None, 3: None}

    expect.poll(sample_query(bigquery.om, table)).satisfies(updated_values)


@pytest.mark.parametrize(
    "filters, expected_tables",
    [
        pytest.param(
            {"tableFilterPattern": {"includes": ["customers"]}},
            {"customers"},
            id="include-one",
            marks=pytest.mark.e2e_contract("filter.table.include-one"),
        ),
        pytest.param(
            {"tableFilterPattern": {"excludes": ["transactions"]}},
            {"customers", "all_types", "customer_txn_summary"},
            id="exclude-one",
            marks=pytest.mark.e2e_contract("filter.table.exclude-one"),
        ),
        pytest.param(
            {"tableFilterPattern": {"includes": ["customer.*"], "excludes": ["customer_txn.*"]}},
            {"customers"},
            id="regex-exclude-wins",
            marks=pytest.mark.e2e_contract("filter.table.regex-exclude-wins"),
        ),
        pytest.param(
            {
                "tableFilterPattern": {
                    "includes": [".*"],
                    "excludes": ["transactions", "all_types", "customer_txn_summary"],
                }
            },
            {"customers"},
            id="exclude-wins",
            marks=pytest.mark.e2e_contract("filter.table.exclude-wins"),
        ),
    ],
)
def test_table_filter(filters, expected_tables, cli, bigquery):
    """Every BigQuery run also carries the owned-dataset schema filter, so these are v1's schema+table mixes."""
    cli.run(bigquery.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=True), filters=filters))
    expect.poll(bigquery.catalog_query()).satisfies(catalog_matches(_expected(bigquery, tables=expected_tables)))


@pytest.mark.parametrize(
    "filter_kind",
    [
        pytest.param("include-one", marks=pytest.mark.e2e_contract("filter.schema.include-one")),
        pytest.param("exclude-wins", marks=pytest.mark.e2e_contract("filter.schema.exclude-wins")),
    ],
)
def test_schema_filter(filter_kind, cli, bigquery, bigquery_instance):
    with fresh_bigquery_source(bigquery_instance.primary, bigquery_instance.location) as excluded:
        for source in (bigquery.source, excluded):
            rows = source.run(f"SELECT COUNT(*) AS n FROM {source.qualified}.customers").result()
            assert next(iter(rows)).n == 5
        kept, dropped = (f"^{re.escape(source.dataset)}$" for source in (bigquery.source, excluded))
        pattern = {"includes": [kept]}
        if filter_kind == "exclude-wins":
            pattern = {"includes": [kept, dropped], "excludes": [dropped]}
        cli.run(
            bigquery.invocation(
                MetadataPipeline(includeDDL=True, includeStoredProcedures=True),
                sources=(bigquery.source, excluded),
                filters={"schemaFilterPattern": pattern},
            )
        )
        expect.poll(bigquery.catalog_query()).satisfies(catalog_matches(_expected(bigquery)))


@pytest.mark.e2e_contract("filter.database.include-one")
def test_database_filter_selects_one_project(cli, bigquery, bigquery_secondary_source):
    """Both projects hold a populated owned dataset; only the included project may be ingested."""
    rows = bigquery_secondary_source.run(
        f"SELECT COUNT(*) AS n FROM {bigquery_secondary_source.qualified}.customers"
    ).result()
    assert next(iter(rows)).n == 5
    cli.run(
        bigquery.invocation(
            MetadataPipeline(includeDDL=True, includeStoredProcedures=True),
            sources=(bigquery.source, bigquery_secondary_source),
            filters={"databaseFilterPattern": {"includes": [f"^{re.escape(bigquery.source.project_id)}$"]}},
        )
    )
    expect.poll(bigquery.catalog_query()).satisfies(catalog_matches(_expected(bigquery)))
