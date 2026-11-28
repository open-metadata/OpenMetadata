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
"""Athena metadata, partitions, filters, deletion, classification and view lineage."""

import pytest

from metadata.generated.schema.entity.data.table import PartitionIntervalTypes, Table
from metadata.ingestion.ometa.utils import model_str

from ..features.database.catalog.differ import catalog_matches
from ..features.database.entities import (
    column_has_no_tag,
    column_has_tag,
    entity_exists,
    has_description,
    table_has_schema_definition,
    table_is_deleted,
)
from ..features.database.lineage import lineage_has_columns, lineage_has_edge, lineage_query
from ..features.database.pipelines import AutoClassificationPipeline, LineagePipeline, MetadataPipeline
from ..runtime import expect
from .baseline import DATABASE_DESCRIPTION, VIEW_COLUMNS
from .checks import schema_has_exact_description, table_partitioned_by
from .connector import OM_DATABASE
from .expected import athena_expected, athena_schema


def _expected(athena, *, tables=None):
    return athena_expected(athena.service_name, OM_DATABASE, athena_schema(athena.source.database, tables=tables))


@pytest.mark.e2e_contract("catalog.metadata")
def test_catalog(cli, athena):
    cli.run(athena.invocation(MetadataPipeline(includeDDL=True)))
    expect.poll(athena.catalog_query()).satisfies(catalog_matches(_expected(athena)))


@pytest.mark.e2e_contract("schema.description")
def test_glue_database_description_becomes_schema_description(cli, athena):
    cli.run(athena.invocation(MetadataPipeline(), filters={"tableFilterPattern": {"includes": ["^customers$"]}}))
    expect.poll(athena.schema_query()).satisfies(schema_has_exact_description(DATABASE_DESCRIPTION))


@pytest.mark.e2e_contract("partition.columns")
def test_hive_partition_columns(cli, athena):
    cli.run(athena.invocation(MetadataPipeline(), filters={"tableFilterPattern": {"includes": ["^sales$"]}}))
    expect.poll(athena.partition_query("sales")).satisfies(
        table_partitioned_by((("sale_date", PartitionIntervalTypes.COLUMN_VALUE),))
    )


@pytest.mark.e2e_contract("lineage.view")
def test_view_lineage_covers_every_column(cli, athena):
    cli.run(athena.invocation(MetadataPipeline(includeDDL=True)))
    source = athena.table_fqn("customers")
    view = athena.table_fqn("view_customers")
    expect.poll(athena.table_query("customers")).satisfies(entity_exists)
    expect.poll(athena.table_query("view_customers")).satisfies(table_has_schema_definition("SELECT"))
    cli.run(athena.invocation(LineagePipeline(processQueryLineage=False)))

    def check(graph):
        lineage_has_edge(source, view)(graph)
        lineage_has_columns(
            tuple(athena.column_fqn("customers", name) for name in VIEW_COLUMNS),
            tuple(athena.column_fqn("view_customers", name) for name in VIEW_COLUMNS),
        )(graph)

    expect.poll(lineage_query(athena.om, view)).satisfies(check)


@pytest.mark.e2e_contract("classification.tags")
def test_auto_classification_tags_pii_columns(cli, athena):
    only = {"tableFilterPattern": {"includes": ["^customers$"]}}
    cli.run(athena.invocation(MetadataPipeline(), filters=only))
    expect.poll(athena.table_query("customers")).satisfies(entity_exists)
    cli.run(
        athena.invocation(
            AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=True, confidence=60),
            filters=only,
        )
    )

    def check(table):
        column_has_tag("email", "PII.Sensitive")(table)
        column_has_tag("date_of_birth", "PII.NonSensitive")(table)
        for name in ("id", "status"):
            for tag in ("PII.Sensitive", "PII.NonSensitive"):
                column_has_no_tag(name, tag)(table)

    expect.poll(athena.table_query("customers")).satisfies(check)


@pytest.mark.e2e_contract("deletion.tables")
def test_removed_table_is_marked_deleted(cli, athena):
    invocation = athena.invocation(MetadataPipeline(markDeletedTables=True))
    cli.run(invocation)
    removed = athena.table_query("sales")
    retained = athena.table_query("customers")
    before = expect.poll(removed).satisfies(table_is_deleted(deleted=False))
    sibling = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    athena.source.drop_table("sales")
    cli.run(invocation)
    after = expect.poll(removed).satisfies(table_is_deleted(deleted=True))
    survivor = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    assert after.id == before.id
    assert survivor.id == sibling.id


@pytest.mark.e2e_contract("ingest.repeat")
def test_repeat_ingest_preserves_ids_and_updates_description(cli, athena):
    expected = _expected(athena)
    cli.run(athena.invocation(MetadataPipeline(includeDDL=True)))
    before = expect.poll(athena.catalog_query()).satisfies(catalog_matches(expected))
    original_ids = {model_str(table.fullyQualifiedName): table.id for table in before.tables}
    athena.source.set_table_comment("all_datatypes", "Updated native fixture")
    cli.run(athena.invocation(MetadataPipeline(includeDDL=True, overrideMetadata=True)))

    def updated(snapshot):
        catalog_matches(expected)(snapshot)
        assert {model_str(table.fullyQualifiedName): table.id for table in snapshot.tables} == original_ids
        has_description("Updated native fixture")(snapshot.find(Table, athena.table_fqn("all_datatypes")))

    expect.poll(athena.catalog_query()).satisfies(updated)


@pytest.mark.parametrize(
    "filters, expected_tables",
    [
        pytest.param(
            {"tableFilterPattern": {"includes": ["^customers$"]}},
            {"customers"},
            id="include-one",
            marks=pytest.mark.e2e_contract("filter.table.include-one"),
        ),
        pytest.param(
            {"tableFilterPattern": {"excludes": ["^sales$"]}},
            {"customers", "orders", "all_datatypes", "view_customers"},
            id="exclude-one",
            marks=pytest.mark.e2e_contract("filter.table.exclude-one"),
        ),
        pytest.param(
            {"tableFilterPattern": {"includes": [".*customers.*"], "excludes": ["^view_customers$"]}},
            {"customers"},
            id="regex-exclude-wins",
            marks=pytest.mark.e2e_contract("filter.table.regex-exclude-wins"),
        ),
        pytest.param(
            {"tableFilterPattern": {"includes": [".*"], "excludes": ["^customers$", "^orders$", "^view_customers$"]}},
            {"sales", "all_datatypes"},
            id="exclude-wins",
            marks=pytest.mark.e2e_contract("filter.table.exclude-wins"),
        ),
    ],
)
def test_table_filter(filters, expected_tables, cli, athena):
    cli.run(athena.invocation(MetadataPipeline(includeDDL=True), filters=filters))
    expect.poll(athena.catalog_query()).satisfies(catalog_matches(_expected(athena, tables=expected_tables)))


@pytest.mark.parametrize(
    "filter_kind",
    [
        pytest.param("include-one", marks=pytest.mark.e2e_contract("filter.schema.include-one")),
        pytest.param("exclude-wins", marks=pytest.mark.e2e_contract("filter.schema.exclude-wins")),
    ],
)
def test_schema_filter(filter_kind, cli, athena, athena_secondary_source):
    for source in (athena.source, athena_secondary_source):
        assert source.run(f"SELECT COUNT(*) FROM {source.qualified('customers')}") == [(5,)]
    pattern = {"includes": [athena.source.database]}
    if filter_kind == "exclude-wins":
        pattern = {
            "includes": [athena.source.database, athena_secondary_source.database],
            "excludes": [athena_secondary_source.database],
        }
    cli.run(
        athena.invocation(
            MetadataPipeline(includeDDL=True),
            sources=(athena.source, athena_secondary_source),
            filters={"schemaFilterPattern": pattern},
        )
    )
    expect.poll(athena.catalog_query()).satisfies(catalog_matches(_expected(athena)))
