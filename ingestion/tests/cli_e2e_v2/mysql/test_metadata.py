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
"""Real MySQL source → CLI → persisted OpenMetadata metadata scenarios."""

import pytest
from sqlalchemy import text

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.utils import model_str

from ..features.database.entities import (
    column_has_no_tag,
    column_has_tag,
    entity_exists,
    table_has_foreign_key,
    table_has_schema_definition,
    table_is_deleted,
)
from ..features.database.lineage import lineage_has_columns, lineage_has_edge, lineage_query
from ..features.database.pipelines import AutoClassificationPipeline, LineagePipeline, MetadataPipeline
from ..features.database.samples import sample_query
from ..runtime import expect
from .checks import mysql_catalog_matches, native_sample_rows, procedures_have_bodies
from .expected import mysql_expected
from .source import fresh_mysql_source


@pytest.mark.e2e_contract("catalog.metadata")
def test_catalog(cli, mysql):
    cli.run(mysql.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=True)))
    expected = mysql_expected(mysql.service_name, schema=mysql.source.schema)
    expect.poll(mysql.catalog_query()).satisfies(mysql_catalog_matches(expected))


@pytest.mark.e2e_contract("procedure.code")
def test_stored_procedure_bodies(cli, mysql):
    cli.run(mysql.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=True)))
    expect.poll(mysql.catalog_query()).satisfies(procedures_have_bodies)


@pytest.mark.e2e_contract("fk.relationships")
def test_foreign_key(cli, mysql):
    cli.run(mysql.invocation(MetadataPipeline()))
    expect.poll(mysql.table_query("transactions")).satisfies(
        table_has_foreign_key(("customer_id",), (mysql.column_fqn("customers", "id"),))
    )


@pytest.mark.e2e_contract("lineage.view")
def test_lineage_view_references_tables(cli, mysql):
    cli.run(mysql.invocation(MetadataPipeline(includeDDL=True)))
    for name in ("customers", "transactions"):
        expect.poll(mysql.table_query(name)).satisfies(entity_exists)
    view = mysql.table_fqn("customer_txn_summary")
    expect.poll(mysql.table_query("customer_txn_summary")).satisfies(table_has_schema_definition("LEFT JOIN"))
    cli.run(mysql.invocation(LineagePipeline(processQueryLineage=False)))

    def check(graph):
        lineage_has_edge(mysql.table_fqn("customers"), view)(graph)
        lineage_has_edge(mysql.table_fqn("transactions"), view)(graph)
        lineage_has_columns(
            (mysql.column_fqn("customers", "id"), mysql.column_fqn("transactions", "amount")),
            (
                mysql.column_fqn("customer_txn_summary", "customer_id"),
                mysql.column_fqn("customer_txn_summary", "total_amount"),
            ),
        )(graph)

    expect.poll(lineage_query(mysql.om, view)).satisfies(check)


@pytest.mark.e2e_contract("classification.tags")
def test_auto_classification_tags_pii_columns(cli, mysql):
    cli.run(mysql.invocation(MetadataPipeline()))
    expect.poll(mysql.table_query("customers")).satisfies(entity_exists)
    cli.run(
        mysql.invocation(AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=True, confidence=60))
    )

    def check(table):
        column_has_tag("email", "PII.Sensitive")(table)
        column_has_tag("date_of_birth", "PII.NonSensitive")(table)
        for name in ("id", "status"):
            for tag in ("PII.Sensitive", "PII.NonSensitive"):
                column_has_no_tag(name, tag)(table)

    expect.poll(mysql.table_query("customers")).satisfies(check)


@pytest.mark.e2e_contract("deletion.tables")
def test_mark_deleted_tables_on_reingest(cli, mysql):
    invocation = mysql.invocation(MetadataPipeline(markDeletedTables=True, includeStoredProcedures=False))
    cli.run(invocation)
    removed = mysql.table_query("all_types")
    retained = mysql.table_query("customers")
    before = expect.poll(removed).satisfies(table_is_deleted(deleted=False))
    sibling = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    mysql.source.drop_table("all_types")
    cli.run(invocation)
    after = expect.poll(removed).satisfies(table_is_deleted(deleted=True))
    survivor = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    assert after.id == before.id
    assert survivor.id == sibling.id


@pytest.mark.e2e_contract("ingest.repeat")
def test_repeat_ingest_preserves_ids_and_updates_metadata(cli, mysql):
    expected = mysql_expected(mysql.service_name, schema=mysql.source.schema)
    cli.run(mysql.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=True)))
    before = expect.poll(mysql.catalog_query()).satisfies(mysql_catalog_matches(expected))
    original_ids = {model_str(table.fullyQualifiedName): table.id for table in before.tables}
    quoted = mysql.source.admin_engine.dialect.identifier_preparer.quote_identifier(mysql.source.schema)
    with mysql.source.admin_engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {quoted}.all_types COMMENT = 'Updated native values fixture'"))
    mysql.source.set_value("all_types", 1, "int_col", 654321)
    cli.run(mysql.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=True, overrideMetadata=True)))

    def updated(snapshot):
        mysql_catalog_matches(expected)(snapshot)
        assert len(snapshot.tables) == len(original_ids)
        assert {model_str(table.fullyQualifiedName): table.id for table in snapshot.tables} == original_ids
        table = snapshot.find(Table, mysql.table_fqn("all_types"))
        assert model_str(table.description) == "Updated native values fixture"

    expect.poll(mysql.catalog_query()).satisfies(updated)
    table = expect.poll(mysql.table_query("all_types")).satisfies(entity_exists)
    cli.run(
        mysql.invocation(
            AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=False, sampleDataCount=10),
            filters={"tableFilterPattern": {"includes": ["all_types"]}},
        )
    )

    def updated_values(sampled):
        rows = native_sample_rows(sampled)
        assert {key: row["int_col"] for key, row in rows.items()} == {1: 654321, 2: None, 3: None}

    expect.poll(sample_query(mysql.om, table)).satisfies(updated_values)


@pytest.mark.e2e_contract("error.containment")
def test_error_containment_one_broken_view(cli, mysql):
    quoted = mysql.source.admin_engine.dialect.identifier_preparer.quote_identifier(mysql.source.schema)
    with mysql.source.admin_engine.begin() as connection:
        connection.execute(text(f"CREATE TABLE {quoted}._helper_for_broken_view (id INT PRIMARY KEY, doomed_col INT)"))
        connection.execute(
            text(f"CREATE VIEW {quoted}._broken_view AS SELECT id, doomed_col FROM {quoted}._helper_for_broken_view")
        )
        connection.execute(text(f"ALTER TABLE {quoted}._helper_for_broken_view DROP COLUMN doomed_col"))
    invocation = mysql.invocation(MetadataPipeline(includeStoredProcedures=False))
    # Ten successes out of eleven pass the default 90%; require every record to succeed.
    invocation.config["workflowConfig"].update(successThreshold=100, raiseOnError=True)
    result = cli.run(invocation, expected_exit=1, expected_success=False, expected_errors=1)
    assert result.status.total_errors == 1
    assert len(result.status.all_failures) == 1
    assert result.status.all_failures[0]["name"] == "_broken_view"
    for name in ("customers", "transactions", "all_types"):
        expect.poll(mysql.table_query(name)).satisfies(table_is_deleted(deleted=False))


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
def test_table_filter(filters, expected_tables, cli, mysql):
    cli.run(mysql.invocation(MetadataPipeline(includeDDL=True, includeStoredProcedures=True), filters=filters))
    expected = mysql_expected(mysql.service_name, schema=mysql.source.schema, tables=expected_tables)
    expect.poll(mysql.catalog_query()).satisfies(mysql_catalog_matches(expected))


@pytest.mark.parametrize(
    "filter_kind",
    [
        pytest.param("include-one", marks=pytest.mark.e2e_contract("filter.schema.include-one")),
        pytest.param("exclude-wins", marks=pytest.mark.e2e_contract("filter.schema.exclude-wins")),
    ],
)
def test_schema_filter(filter_kind, cli, mysql, mysql_admin_engine, mysql_ingestion_engine):
    with fresh_mysql_source(mysql_admin_engine) as excluded:
        for source in (mysql.source, excluded):
            quoted = mysql_ingestion_engine.dialect.identifier_preparer.quote_identifier(source.schema)
            with mysql_ingestion_engine.connect() as connection:
                assert connection.execute(text(f"SELECT COUNT(*) FROM {quoted}.customers")).scalar_one() == 5
        pattern = {"includes": [mysql.source.schema]}
        if filter_kind == "exclude-wins":
            pattern = {"includes": [mysql.source.schema, excluded.schema], "excludes": [excluded.schema]}
        invocation = mysql.invocation(
            MetadataPipeline(includeDDL=True, includeStoredProcedures=True),
            sources=(mysql.source, excluded),
            filters={"schemaFilterPattern": pattern},
        )
        assert "databaseSchema" not in invocation.config["source"]["serviceConnection"]["config"]
        cli.run(invocation)
        expected = mysql_expected(mysql.service_name, schema=mysql.source.schema)
        expect.poll(mysql.catalog_query()).satisfies(mysql_catalog_matches(expected))
