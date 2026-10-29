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
"""Real MSSQL source → CLI → persisted OpenMetadata metadata scenarios."""

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
    NATIVE_COLUMN_NAMES,
    NATIVE_TABLE,
    NATIVE_TABLE_UPDATED_DESCRIPTION,
    NATIVE_VIEW,
)
from .checks import procedure_has_body
from .expected import mssql_expected
from .source import fresh_mssql_source


def _metadata_options(**overrides):
    return MetadataPipeline(includeDDL=True, includeStoredProcedures=True, **overrides)


def _expected(mssql, **overrides):
    return mssql_expected(
        mssql.service_name,
        database=mssql.source.database,
        schema=mssql.source.schema,
        reference_date=mssql.source.reference_date,
        **overrides,
    )


@pytest.mark.e2e_contract("catalog.metadata")
def test_catalog(cli, mssql):
    cli.run(mssql.invocation(_metadata_options()))
    expect.poll(mssql.catalog_query()).satisfies(catalog_matches(_expected(mssql)))


@pytest.mark.e2e_contract("procedure.code")
def test_stored_procedure_body(cli, mssql):
    cli.run(mssql.invocation(_metadata_options()))
    expect.poll(mssql.catalog_query()).satisfies(procedure_has_body)


@pytest.mark.e2e_contract("fk.relationships")
def test_foreign_key(cli, mssql):
    cli.run(mssql.invocation(MetadataPipeline()))
    expect.poll(mssql.table_query("transactions")).satisfies(
        table_has_foreign_key(("customer_id",), (mssql.column_fqn("customers", "id"),))
    )


@pytest.mark.e2e_contract("lineage.view")
def test_view_lineage_covers_all_native_columns(cli, mssql):
    """v1 checked 4 column edges on this path; the view here projects every native column."""
    cli.run(mssql.invocation(_metadata_options()))
    source = mssql.table_fqn(NATIVE_TABLE)
    view = mssql.table_fqn(NATIVE_VIEW)
    expect.poll(mssql.table_query(NATIVE_TABLE)).satisfies(entity_exists)
    # Prove the stored definition landed first, so a missing-DDL regression stays
    # distinguishable from a parser regression.
    expect.poll(mssql.table_query(NATIVE_VIEW)).satisfies(table_has_schema_definition("SELECT"))
    # Query-log and stored-procedure lineage both read SQL Server's query history
    # (Query Store or sys.dm_exec_query_stats), which the least-privilege ingestion
    # account cannot see; both stay out of scope, as they do for the sibling suites.
    cli.run(mssql.invocation(LineagePipeline(processQueryLineage=False, processStoredProcedureLineage=False)))

    def check(graph):
        lineage_has_edge(source, view)(graph)
        lineage_has_columns(
            tuple(mssql.column_fqn(NATIVE_TABLE, name) for name in NATIVE_COLUMN_NAMES),
            tuple(mssql.column_fqn(NATIVE_VIEW, name) for name in NATIVE_COLUMN_NAMES),
        )(graph)

    expect.poll(lineage_query(mssql.om, view)).satisfies(check)


@pytest.mark.e2e_contract("classification.tags")
def test_auto_classification_tags_pii_columns(cli, mssql):
    cli.run(mssql.invocation(MetadataPipeline()))
    expect.poll(mssql.table_query("customers")).satisfies(entity_exists)
    cli.run(
        mssql.invocation(AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=True, confidence=60))
    )

    def check(table):
        column_has_tag("email", "PII.Sensitive")(table)
        column_has_tag("date_of_birth", "PII.NonSensitive")(table)
        # The negative half matters: without it, a classifier that tags everything passes.
        for name in ("id", "status"):
            for tag in ("PII.Sensitive", "PII.NonSensitive"):
                column_has_no_tag(name, tag)(table)

    expect.poll(mssql.table_query("customers")).satisfies(check)


@pytest.mark.e2e_contract("deletion.tables")
def test_removed_table_and_view_are_marked_deleted(cli, mssql):
    invocation = mssql.invocation(MetadataPipeline(markDeletedTables=True))
    cli.run(invocation)
    removed = mssql.table_query(NATIVE_TABLE)
    removed_view = mssql.table_query(NATIVE_VIEW)
    retained = mssql.table_query("customers")
    before = expect.poll(removed).satisfies(table_is_deleted(deleted=False))
    before_view = expect.poll(removed_view).satisfies(table_is_deleted(deleted=False))
    sibling = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    mssql.source.drop_table(NATIVE_TABLE)
    cli.run(invocation)
    after = expect.poll(removed).satisfies(table_is_deleted(deleted=True))
    after_view = expect.poll(removed_view).satisfies(table_is_deleted(deleted=True))
    survivor = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    assert after.id == before.id
    assert after_view.id == before_view.id
    assert survivor.id == sibling.id


@pytest.mark.e2e_contract("ingest.repeat")
def test_repeat_ingest_preserves_ids_and_updates_description(cli, mssql):
    cli.run(mssql.invocation(_metadata_options()))
    before = expect.poll(mssql.catalog_query()).satisfies(catalog_matches(_expected(mssql)))
    original_ids = {model_str(table.fullyQualifiedName): table.id for table in before.tables}
    owned = mssql.source.schema
    # sp_updateextendedproperty takes @value as sql_variant, which rejects the
    # nvarchar(max) a bound parameter arrives as; the description is authored here,
    # not user input.
    mssql.source.execute(
        f"EXEC sp_updateextendedproperty @name=N'MS_Description', @value=N'{NATIVE_TABLE_UPDATED_DESCRIPTION}'"
        f", @level0type=N'SCHEMA', @level0name=N'{owned}'"
        f", @level1type=N'TABLE', @level1name=N'{NATIVE_TABLE}'"
    )
    cli.run(mssql.invocation(_metadata_options(overrideMetadata=True)))
    updated_expected = _expected(mssql, native_table_description=NATIVE_TABLE_UPDATED_DESCRIPTION)

    def updated(snapshot):
        catalog_matches(updated_expected)(snapshot)
        assert {model_str(table.fullyQualifiedName): table.id for table in snapshot.tables} == original_ids
        table = snapshot.find(Table, mssql.table_fqn(NATIVE_TABLE))
        has_description(NATIVE_TABLE_UPDATED_DESCRIPTION)(table)

    expect.poll(mssql.catalog_query()).satisfies(updated)


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
            {"customers", "transactions", "persons", "view_all_datatypes"},
            id="exclude-one",
            marks=pytest.mark.e2e_contract("filter.table.exclude-one"),
        ),
        pytest.param(
            {"tableFilterPattern": {"includes": ["^persons$", "^customers$"], "excludes": ["^customers$"]}},
            {"persons"},
            id="mix",
            marks=pytest.mark.e2e_contract("filter.table.mix"),
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
                    "excludes": ["^customers$", "^transactions$", "^persons$", "^view_all_datatypes$"],
                }
            },
            {"all_datatypes"},
            id="exclude-wins",
            marks=pytest.mark.e2e_contract("filter.table.exclude-wins"),
        ),
    ],
)
def test_table_filter(filters, expected_tables, cli, mssql):
    cli.run(mssql.invocation(_metadata_options(), filters=filters))
    expect.poll(mssql.catalog_query()).satisfies(catalog_matches(_expected(mssql, tables=expected_tables)))


@pytest.mark.parametrize(
    "filter_kind",
    [
        pytest.param("include-one", marks=pytest.mark.e2e_contract("filter.schema.include-one")),
        pytest.param("exclude-wins", marks=pytest.mark.e2e_contract("filter.schema.exclude-wins")),
    ],
)
def test_schema_filter(filter_kind, cli, mssql, mssql_admin_engine, mssql_ingestion_engine):
    """Only the owned schema is ingested, whether selected by include or by exclude priority."""
    with fresh_mssql_source(mssql_admin_engine) as excluded:
        # Prove both schemas are populated and readable before trusting the exclusion.
        for source in (mssql.source, excluded):
            quoted = mssql_ingestion_engine.dialect.identifier_preparer.quote_identifier(source.schema)
            with mssql_ingestion_engine.connect() as connection:
                assert connection.execute(text(f"SELECT COUNT(*) FROM {quoted}.customers")).scalar_one() == 5
        pattern = {"includes": [mssql.source.schema]}
        if filter_kind == "exclude-wins":
            pattern = {"includes": [mssql.source.schema, excluded.schema], "excludes": [excluded.schema]}
        cli.run(
            mssql.invocation(
                _metadata_options(),
                sources=(mssql.source, excluded),
                filters={"schemaFilterPattern": pattern},
            )
        )
        expect.poll(mssql.catalog_query()).satisfies(catalog_matches(_expected(mssql)))
