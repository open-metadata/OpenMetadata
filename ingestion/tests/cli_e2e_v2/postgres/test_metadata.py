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
"""Postgres metadata, filters, deletion, classification, and view lineage."""

import pytest
from sqlalchemy import text

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.utils import model_str

from ..features.database.catalog.differ import catalog_matches
from ..features.database.entities import (
    column_has_no_tag,
    column_has_tag,
    entity_exists,
    has_description,
    table_has_foreign_key,
    table_has_schema_definition,
    table_is_deleted,
)
from ..features.database.lineage import lineage_has_columns, lineage_has_edge, lineage_query
from ..features.database.pipelines import AutoClassificationPipeline, LineagePipeline, MetadataPipeline
from ..runtime import expect
from .checks import NATIVE_COLUMN_NAMES
from .expected import postgres_expected
from .source import fresh_postgres_source


@pytest.mark.e2e_contract("catalog.metadata")
def test_catalog(cli, postgres):
    cli.run(postgres.invocation(MetadataPipeline(includeDDL=True)))
    expected = postgres_expected(
        postgres.service_name, database=postgres.source.database, schema=postgres.source.schema
    )
    expect.poll(postgres.catalog_query()).satisfies(catalog_matches(expected))


@pytest.mark.e2e_contract("fk.relationships")
def test_foreign_key(cli, postgres):
    cli.run(postgres.invocation(MetadataPipeline()))
    expect.poll(postgres.table_query("transactions")).satisfies(
        table_has_foreign_key(("customer_id",), (postgres.column_fqn("customers", "id"),))
    )


@pytest.mark.e2e_contract("lineage.view")
def test_view_lineage_covers_all_native_columns(cli, postgres):
    cli.run(postgres.invocation(MetadataPipeline(includeDDL=True)))
    source = postgres.table_fqn("all_datatypes")
    view = postgres.table_fqn("view_all_datatypes")
    expect.poll(postgres.table_query("all_datatypes")).satisfies(entity_exists)
    expect.poll(postgres.table_query("view_all_datatypes")).satisfies(table_has_schema_definition("SELECT"))
    cli.run(postgres.invocation(LineagePipeline(processQueryLineage=False)))

    def check(graph):
        lineage_has_edge(source, view)(graph)
        lineage_has_columns(
            tuple(postgres.column_fqn("all_datatypes", name) for name in NATIVE_COLUMN_NAMES),
            tuple(postgres.column_fqn("view_all_datatypes", name) for name in NATIVE_COLUMN_NAMES),
        )(graph)

    expect.poll(lineage_query(postgres.om, view)).satisfies(check)


@pytest.mark.e2e_contract("classification.tags")
def test_auto_classification_tags_pii_columns(cli, postgres):
    cli.run(postgres.invocation(MetadataPipeline()))
    expect.poll(postgres.table_query("customers")).satisfies(entity_exists)
    cli.run(
        postgres.invocation(
            AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=True, confidence=60)
        )
    )

    def check(table):
        column_has_tag("email", "PII.Sensitive")(table)
        column_has_tag("date_of_birth", "PII.NonSensitive")(table)
        for name in ("id", "status"):
            for tag in ("PII.Sensitive", "PII.NonSensitive"):
                column_has_no_tag(name, tag)(table)

    expect.poll(postgres.table_query("customers")).satisfies(check)


@pytest.mark.e2e_contract("deletion.tables")
def test_removed_table_and_view_are_marked_deleted(cli, postgres):
    invocation = postgres.invocation(MetadataPipeline(markDeletedTables=True))
    cli.run(invocation)
    removed = postgres.table_query("all_datatypes")
    removed_view = postgres.table_query("view_all_datatypes")
    retained = postgres.table_query("customers")
    before = expect.poll(removed).satisfies(table_is_deleted(deleted=False))
    before_view = expect.poll(removed_view).satisfies(table_is_deleted(deleted=False))
    sibling = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    postgres.source.drop_table("all_datatypes")
    cli.run(invocation)
    after = expect.poll(removed).satisfies(table_is_deleted(deleted=True))
    after_view = expect.poll(removed_view).satisfies(table_is_deleted(deleted=True))
    survivor = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    assert after.id == before.id
    assert after_view.id == before_view.id
    assert survivor.id == sibling.id


@pytest.mark.e2e_contract("ingest.repeat")
def test_repeat_ingest_preserves_ids_and_updates_description(cli, postgres):
    expected = postgres_expected(
        postgres.service_name, database=postgres.source.database, schema=postgres.source.schema
    )
    cli.run(postgres.invocation(MetadataPipeline(includeDDL=True)))
    before = expect.poll(postgres.catalog_query()).satisfies(catalog_matches(expected))
    original_ids = {model_str(table.fullyQualifiedName): table.id for table in before.tables}
    quoted = postgres.source.admin_engine.dialect.identifier_preparer.quote_identifier(postgres.source.schema)
    with postgres.source.admin_engine.begin() as connection:
        connection.execute(text(f"COMMENT ON TABLE {quoted}.all_datatypes IS 'Updated native fixture'"))
    cli.run(postgres.invocation(MetadataPipeline(includeDDL=True, overrideMetadata=True)))

    def updated(snapshot):
        catalog_matches(expected)(snapshot)
        assert {model_str(table.fullyQualifiedName): table.id for table in snapshot.tables} == original_ids
        table = snapshot.find(Table, postgres.table_fqn("all_datatypes"))
        has_description("Updated native fixture")(table)

    expect.poll(postgres.catalog_query()).satisfies(updated)


@pytest.mark.parametrize(
    "filters, expected_tables",
    [
        pytest.param(
            {"tableFilterPattern": {"includes": ["^all_datatypes$"]}},
            {"all_datatypes"},
            id="include-one",
            marks=pytest.mark.e2e_contract("filter.table.include-one"),
        ),
        pytest.param(
            {"tableFilterPattern": {"excludes": ["^all_datatypes$"]}},
            {"customers", "transactions", "view_all_datatypes"},
            id="exclude-one",
            marks=pytest.mark.e2e_contract("filter.table.exclude-one"),
        ),
        pytest.param(
            {"tableFilterPattern": {"includes": [".*all_datatypes.*"], "excludes": ["^view_all_datatypes$"]}},
            {"all_datatypes"},
            id="regex-exclude-wins",
            marks=pytest.mark.e2e_contract("filter.table.regex-exclude-wins"),
        ),
        pytest.param(
            {
                "tableFilterPattern": {
                    "includes": [".*"],
                    "excludes": ["^customers$", "^transactions$", "^view_all_datatypes$"],
                }
            },
            {"all_datatypes"},
            id="exclude-wins",
            marks=pytest.mark.e2e_contract("filter.table.exclude-wins"),
        ),
    ],
)
def test_table_filter(filters, expected_tables, cli, postgres):
    cli.run(postgres.invocation(MetadataPipeline(includeDDL=True), filters=filters))
    expected = postgres_expected(
        postgres.service_name,
        database=postgres.source.database,
        schema=postgres.source.schema,
        tables=expected_tables,
    )
    expect.poll(postgres.catalog_query()).satisfies(catalog_matches(expected))


@pytest.mark.parametrize(
    "filter_kind",
    [
        pytest.param("include-one", marks=pytest.mark.e2e_contract("filter.schema.include-one")),
        pytest.param("exclude-wins", marks=pytest.mark.e2e_contract("filter.schema.exclude-wins")),
    ],
)
def test_schema_filter(filter_kind, cli, postgres, postgres_admin_engine, postgres_ingestion_engine):
    with fresh_postgres_source(postgres_admin_engine) as excluded:
        for source in (postgres.source, excluded):
            quoted = postgres_ingestion_engine.dialect.identifier_preparer.quote_identifier(source.schema)
            with postgres_ingestion_engine.connect() as connection:
                assert connection.execute(text(f"SELECT COUNT(*) FROM {quoted}.customers")).scalar_one() == 5
        pattern = {"includes": [postgres.source.schema]}
        if filter_kind == "exclude-wins":
            pattern = {
                "includes": [postgres.source.schema, excluded.schema],
                "excludes": [excluded.schema],
            }
        cli.run(
            postgres.invocation(
                MetadataPipeline(includeDDL=True),
                sources=(postgres.source, excluded),
                filters={"schemaFilterPattern": pattern},
            )
        )
        expected = postgres_expected(
            postgres.service_name, database=postgres.source.database, schema=postgres.source.schema
        )
        expect.poll(postgres.catalog_query()).satisfies(catalog_matches(expected))
