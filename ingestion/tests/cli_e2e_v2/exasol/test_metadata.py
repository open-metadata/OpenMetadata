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
"""Real Exasol source → CLI → persisted OpenMetadata metadata, lineage and usage scenarios."""

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
from .baseline import (
    JOIN_TABLE,
    NATIVE_COLUMN_NAMES,
    NATIVE_TABLE,
    NATIVE_TABLE_UPDATED_DESCRIPTION,
    NATIVE_VIEW,
    usage_join_query,
)
from .checks import at_least, audited_select_query, table_has_join_usage, usage_query
from .expected import exasol_expected
from .source import fresh_exasol_source


def _expected(exasol, **overrides):
    return exasol_expected(exasol.service_name, schema=exasol.source.schema, **overrides)


@pytest.mark.e2e_contract("catalog.metadata")
def test_catalog(cli, exasol):
    """v1 checked one table's comments and column order; here the whole owned catalog is exact."""
    cli.run(exasol.invocation(MetadataPipeline(includeDDL=True)))
    expect.poll(exasol.catalog_query()).satisfies(catalog_matches(_expected(exasol)))


@pytest.mark.e2e_contract("fk.relationships")
def test_foreign_key(cli, exasol):
    cli.run(exasol.invocation(MetadataPipeline()))
    expect.poll(exasol.table_query("transactions")).satisfies(
        table_has_foreign_key(("customer_id",), (exasol.column_fqn("customers", "id"),))
    )


@pytest.mark.e2e_contract("lineage.view")
def test_view_lineage_covers_all_native_columns(cli, exasol):
    """v1 checked 6 column edges from the view; here every projected column is named."""
    cli.run(exasol.invocation(MetadataPipeline(includeDDL=True)))
    source = exasol.table_fqn(NATIVE_TABLE)
    view = exasol.table_fqn(NATIVE_VIEW)
    expect.poll(exasol.table_query(NATIVE_TABLE)).satisfies(entity_exists)
    # Prove the stored definition landed first, so a missing-DDL regression stays
    # distinguishable from a parser regression.
    expect.poll(exasol.table_query(NATIVE_VIEW)).satisfies(table_has_schema_definition("SELECT"))
    cli.run(exasol.invocation(LineagePipeline(processQueryLineage=False, processStoredProcedureLineage=False)))

    def check(graph):
        lineage_has_edge(source, view)(graph)
        lineage_has_columns(
            tuple(exasol.column_fqn(NATIVE_TABLE, name) for name in NATIVE_COLUMN_NAMES),
            tuple(exasol.column_fqn(NATIVE_VIEW, name) for name in NATIVE_COLUMN_NAMES),
        )(graph)

    expect.poll(lineage_query(exasol.om, view)).satisfies(check)


@pytest.mark.e2e_contract("usage.queries")
def test_usage_records_query_and_column_join(cli, exasol, tmp_path):
    """v1's usage scenario: a SELECT joining two owned tables reaches both through the query log."""
    cli.run(exasol.invocation(MetadataPipeline()))
    for name in (NATIVE_TABLE, JOIN_TABLE):
        expect.poll(exasol.table_query(name)).satisfies(entity_exists)
    with exasol.source.admin_engine.begin() as connection:
        assert len(connection.execute(text(usage_join_query(exasol.source.schema))).all()) == 4
    expect.poll(
        audited_select_query(exasol.source.admin_engine, exasol.source.schema), timeout=120, interval=5
    ).satisfies(at_least(1))
    cli.run(exasol.usage_invocation(tmp_path / "usage"))
    expect.poll(usage_query(exasol.om, exasol.table_fqn(NATIVE_TABLE)), timeout=60).satisfies(
        table_has_join_usage("col_boolean", exasol.column_fqn(JOIN_TABLE, "col_boolean"))
    )


@pytest.mark.e2e_contract("classification.tags")
def test_auto_classification_tags_pii_columns(cli, exasol):
    cli.run(exasol.invocation(MetadataPipeline()))
    expect.poll(exasol.table_query("customers")).satisfies(entity_exists)
    cli.run(
        exasol.invocation(
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

    expect.poll(exasol.table_query("customers")).satisfies(check)


@pytest.mark.e2e_contract("deletion.tables")
def test_removed_table_and_view_are_marked_deleted(cli, exasol):
    invocation = exasol.invocation(MetadataPipeline(markDeletedTables=True))
    cli.run(invocation)
    removed = exasol.table_query(NATIVE_TABLE)
    removed_view = exasol.table_query(NATIVE_VIEW)
    retained = exasol.table_query("customers")
    before = expect.poll(removed).satisfies(table_is_deleted(deleted=False))
    before_view = expect.poll(removed_view).satisfies(table_is_deleted(deleted=False))
    sibling = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    exasol.source.drop_table(NATIVE_TABLE)
    cli.run(invocation)
    after = expect.poll(removed).satisfies(table_is_deleted(deleted=True))
    after_view = expect.poll(removed_view).satisfies(table_is_deleted(deleted=True))
    survivor = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    assert after.id == before.id
    assert after_view.id == before_view.id
    assert survivor.id == sibling.id


@pytest.mark.e2e_contract("ingest.repeat")
def test_repeat_ingest_preserves_ids_and_updates_description(cli, exasol):
    cli.run(exasol.invocation(MetadataPipeline(includeDDL=True)))
    before = expect.poll(exasol.catalog_query()).satisfies(catalog_matches(_expected(exasol)))
    original_ids = {model_str(table.fullyQualifiedName): table.id for table in before.tables}
    exasol.source.execute(
        f"COMMENT ON TABLE {exasol.source.schema}.{NATIVE_TABLE} IS '{NATIVE_TABLE_UPDATED_DESCRIPTION}'"
    )
    cli.run(exasol.invocation(MetadataPipeline(includeDDL=True, overrideMetadata=True)))
    updated_expected = _expected(exasol, native_table_description=NATIVE_TABLE_UPDATED_DESCRIPTION)

    def updated(snapshot):
        catalog_matches(updated_expected)(snapshot)
        assert {model_str(table.fullyQualifiedName): table.id for table in snapshot.tables} == original_ids
        has_description(NATIVE_TABLE_UPDATED_DESCRIPTION)(snapshot.find(Table, exasol.table_fqn(NATIVE_TABLE)))

    expect.poll(exasol.catalog_query()).satisfies(updated)


_ALL_TABLES = {"customers", "transactions", NATIVE_TABLE, JOIN_TABLE, NATIVE_VIEW}


@pytest.mark.parametrize(
    "filters, expected_tables",
    [
        pytest.param(
            {"tableFilterPattern": {"includes": [f"^{NATIVE_TABLE}$"]}},
            {NATIVE_TABLE},
            id="include-one",
            marks=pytest.mark.e2e_contract("filter.table.include-one"),
        ),
        pytest.param(
            # v1 excluded IGNORE_TABLE, the join table here.
            {"tableFilterPattern": {"excludes": [f"^{JOIN_TABLE}$"]}},
            _ALL_TABLES - {JOIN_TABLE},
            id="exclude-one",
            marks=pytest.mark.e2e_contract("filter.table.exclude-one"),
        ),
        pytest.param(
            {"tableFilterPattern": {"includes": [f"^{NATIVE_TABLE}$", "^customers$"], "excludes": ["^customers$"]}},
            {NATIVE_TABLE},
            id="mix",
            marks=pytest.mark.e2e_contract("filter.table.mix"),
        ),
        pytest.param(
            {"tableFilterPattern": {"includes": [".*datatypes.*"], "excludes": [f"^{NATIVE_VIEW}$"]}},
            {NATIVE_TABLE, JOIN_TABLE},
            id="regex-exclude-wins",
            marks=pytest.mark.e2e_contract("filter.table.regex-exclude-wins"),
        ),
        pytest.param(
            {
                "tableFilterPattern": {
                    "includes": [".*"],
                    "excludes": [f"^{name}$" for name in _ALL_TABLES - {"customers"}],
                }
            },
            {"customers"},
            id="exclude-wins",
            marks=pytest.mark.e2e_contract("filter.table.exclude-wins"),
        ),
    ],
)
def test_table_filter(filters, expected_tables, cli, exasol):
    cli.run(exasol.invocation(MetadataPipeline(includeDDL=True), filters=filters))
    expect.poll(exasol.catalog_query()).satisfies(catalog_matches(_expected(exasol, tables=expected_tables)))


@pytest.mark.parametrize(
    "filter_kind",
    [
        pytest.param("include-one", marks=pytest.mark.e2e_contract("filter.schema.include-one")),
        pytest.param("exclude-wins", marks=pytest.mark.e2e_contract("filter.schema.exclude-wins")),
    ],
)
def test_schema_filter(filter_kind, cli, exasol, exasol_admin_engine, exasol_ingestion_engine):
    """Only the owned schema is ingested, whether selected by include or by exclude priority."""
    with fresh_exasol_source(exasol_admin_engine) as excluded:
        # Prove both schemas are populated and readable before trusting the exclusion.
        for source in (exasol.source, excluded):
            with exasol_ingestion_engine.connect() as connection:
                assert connection.execute(text(f"SELECT COUNT(*) FROM {source.schema}.customers")).scalar_one() == 5
        pattern = {"includes": [exasol.source.schema]}
        if filter_kind == "exclude-wins":
            pattern = {"includes": [exasol.source.schema, excluded.schema], "excludes": [excluded.schema]}
        cli.run(
            exasol.invocation(
                MetadataPipeline(includeDDL=True),
                sources=(exasol.source, excluded),
                filters={"schemaFilterPattern": pattern},
            )
        )
        expect.poll(exasol.catalog_query()).satisfies(catalog_matches(_expected(exasol)))
