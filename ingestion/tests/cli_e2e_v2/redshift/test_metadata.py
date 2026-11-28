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
"""Real Redshift source → CLI → persisted OpenMetadata metadata scenarios."""

import pytest

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
    LATE_BINDING_COLUMNS,
    LATE_BINDING_VIEW,
    MATERIALIZED_VIEW,
    NATIVE_COLUMN_NAMES,
    NATIVE_TABLE,
    NATIVE_TABLE_UPDATED_DESCRIPTION,
    NATIVE_VIEW,
    PARTITIONED_TABLE,
    PROFILE_TABLE,
)
from .checks import procedure_has_body, table_has_dist_and_sort_keys
from .connector import owned_schema_pattern
from .expected import redshift_expected
from .source import fresh_redshift_source

_ALL_RELATIONS = {
    "customers",
    "transactions",
    NATIVE_TABLE,
    PARTITIONED_TABLE,
    PROFILE_TABLE,
    NATIVE_VIEW,
    LATE_BINDING_VIEW,
    MATERIALIZED_VIEW,
}


def _metadata_options(**overrides):
    return MetadataPipeline(includeDDL=True, includeStoredProcedures=True, **overrides)


def _expected(redshift, **overrides):
    return redshift_expected(
        redshift.service_name,
        database=redshift.source.database,
        schema=redshift.source.schema,
        reference_date=redshift.source.reference_date,
        **overrides,
    )


def _view_lineage():
    # Query-log and stored-procedure lineage read STL history the shared cluster fills
    # with every other suite's queries; both stay out of scope, as for the sibling suites.
    return LineagePipeline(processQueryLineage=False, processStoredProcedureLineage=False)


@pytest.mark.e2e_contract("catalog.metadata")
def test_catalog(cli, redshift):
    cli.run(redshift.invocation(_metadata_options()))
    expect.poll(redshift.catalog_query()).satisfies(catalog_matches(_expected(redshift)))


@pytest.mark.e2e_contract("procedure.code")
def test_stored_procedure_body(cli, redshift):
    cli.run(redshift.invocation(_metadata_options()))
    expect.poll(redshift.catalog_query()).satisfies(procedure_has_body)


@pytest.mark.e2e_contract("fk.relationships")
def test_foreign_key(cli, redshift):
    cli.run(redshift.invocation(MetadataPipeline()))
    expect.poll(redshift.table_query("transactions")).satisfies(
        table_has_foreign_key(("customer_id",), (redshift.column_fqn("customers", "id"),))
    )


@pytest.mark.e2e_contract("table.dist-sort-keys")
def test_dist_and_sort_keys(cli, redshift):
    cli.run(
        redshift.invocation(MetadataPipeline(), filters={"tableFilterPattern": {"includes": [f"^{NATIVE_TABLE}$"]}})
    )
    expect.poll(redshift.table_query(NATIVE_TABLE)).satisfies(table_has_dist_and_sort_keys)


@pytest.mark.e2e_contract("lineage.view")
def test_view_lineage_covers_all_native_columns(cli, redshift):
    """v1 counted 9 column edges on a pre-existing view; this view projects every native column."""
    cli.run(redshift.invocation(_metadata_options()))
    source = redshift.table_fqn(NATIVE_TABLE)
    view = redshift.table_fqn(NATIVE_VIEW)
    expect.poll(redshift.table_query(NATIVE_TABLE)).satisfies(entity_exists)
    # Prove the stored definition landed first, so a missing-DDL regression stays
    # distinguishable from a parser regression.
    expect.poll(redshift.table_query(NATIVE_VIEW)).satisfies(table_has_schema_definition("SELECT"))
    cli.run(redshift.invocation(_view_lineage()))

    def check(graph):
        lineage_has_edge(source, view)(graph)
        lineage_has_columns(
            tuple(redshift.column_fqn(NATIVE_TABLE, name) for name in NATIVE_COLUMN_NAMES),
            tuple(redshift.column_fqn(NATIVE_VIEW, name) for name in NATIVE_COLUMN_NAMES),
        )(graph)

    expect.poll(lineage_query(redshift.om, view)).satisfies(check)


@pytest.mark.e2e_contract("view.late-binding")
def test_late_binding_view_definition_and_lineage(cli, redshift):
    """A late-binding view names its columns only at query time; Redshift reports them separately."""
    cli.run(redshift.invocation(_metadata_options()))
    view = redshift.table_fqn(LATE_BINDING_VIEW)

    def definition_without_binding_clause(table):
        table_has_schema_definition("SELECT")(table)
        definition = model_str(table.schemaDefinition)
        assert "NO SCHEMA BINDING" not in definition.upper(), f"binding clause kept: {definition!r}"

    expect.poll(redshift.table_query(LATE_BINDING_VIEW)).satisfies(definition_without_binding_clause)
    cli.run(redshift.invocation(_view_lineage()))

    def check(graph):
        lineage_has_edge(redshift.table_fqn("customers"), view)(graph)
        lineage_has_columns(
            tuple(redshift.column_fqn("customers", name) for name in LATE_BINDING_COLUMNS),
            tuple(redshift.column_fqn(LATE_BINDING_VIEW, name) for name in LATE_BINDING_COLUMNS),
        )(graph)

    expect.poll(lineage_query(redshift.om, view)).satisfies(check)


@pytest.mark.e2e_contract("classification.tags")
def test_auto_classification_tags_pii_columns(cli, redshift):
    cli.run(redshift.invocation(MetadataPipeline()))
    expect.poll(redshift.table_query("customers")).satisfies(entity_exists)
    cli.run(
        redshift.invocation(
            AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=True, confidence=60),
            filters={"tableFilterPattern": {"includes": ["^customers$"]}},
        )
    )

    def check(table):
        column_has_tag("email", "PII.Sensitive")(table)
        column_has_tag("date_of_birth", "PII.NonSensitive")(table)
        for name in ("id", "status"):
            for tag in ("PII.Sensitive", "PII.NonSensitive"):
                column_has_no_tag(name, tag)(table)

    expect.poll(redshift.table_query("customers")).satisfies(check)


@pytest.mark.e2e_contract("deletion.tables")
def test_removed_table_and_view_are_marked_deleted(cli, redshift):
    """v1 dropped `persons` and asserted only that it was gone; here the dependent view and a survivor count too."""
    invocation = redshift.invocation(MetadataPipeline(markDeletedTables=True))
    cli.run(invocation)
    removed = redshift.table_query(NATIVE_TABLE)
    removed_view = redshift.table_query(NATIVE_VIEW)
    retained = redshift.table_query("customers")
    before = expect.poll(removed).satisfies(table_is_deleted(deleted=False))
    before_view = expect.poll(removed_view).satisfies(table_is_deleted(deleted=False))
    sibling = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    redshift.source.drop_table(NATIVE_TABLE)
    cli.run(invocation)
    after = expect.poll(removed).satisfies(table_is_deleted(deleted=True))
    after_view = expect.poll(removed_view).satisfies(table_is_deleted(deleted=True))
    survivor = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    assert after.id == before.id
    assert after_view.id == before_view.id
    assert survivor.id == sibling.id


@pytest.mark.e2e_contract("ingest.repeat")
def test_repeat_ingest_preserves_ids_and_updates_description(cli, redshift):
    cli.run(redshift.invocation(_metadata_options()))
    before = expect.poll(redshift.catalog_query()).satisfies(catalog_matches(_expected(redshift)))
    original_ids = {model_str(table.fullyQualifiedName): table.id for table in before.tables}
    redshift.source.set_description(NATIVE_TABLE, NATIVE_TABLE_UPDATED_DESCRIPTION)
    cli.run(redshift.invocation(_metadata_options(overrideMetadata=True)))
    expected = _expected(redshift, native_table_description=NATIVE_TABLE_UPDATED_DESCRIPTION)

    def updated(snapshot):
        catalog_matches(expected)(snapshot)
        assert {model_str(table.fullyQualifiedName): table.id for table in snapshot.tables} == original_ids
        has_description(NATIVE_TABLE_UPDATED_DESCRIPTION)(snapshot.find(Table, redshift.table_fqn(NATIVE_TABLE)))

    expect.poll(redshift.catalog_query()).satisfies(updated)


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
            {"tableFilterPattern": {"excludes": [f"^{NATIVE_TABLE}$"]}},
            _ALL_RELATIONS - {NATIVE_TABLE},
            id="exclude-one",
            marks=pytest.mark.e2e_contract("filter.table.exclude-one"),
        ),
        pytest.param(
            # v1's mix: an include list of two tables plus an exclude that removes nothing it included.
            {"tableFilterPattern": {"includes": ["^customers$", "^transactions$"], "excludes": ["^foo$"]}},
            {"customers", "transactions"},
            id="mix",
            marks=pytest.mark.e2e_contract("filter.table.mix"),
        ),
        pytest.param(
            {"tableFilterPattern": {"includes": [".*all_datatypes.*"], "excludes": [f"^{NATIVE_VIEW}$"]}},
            {NATIVE_TABLE},
            id="regex-exclude-wins",
            marks=pytest.mark.e2e_contract("filter.table.regex-exclude-wins"),
        ),
        pytest.param(
            {
                "tableFilterPattern": {
                    "includes": [".*"],
                    "excludes": [f"^{name}$" for name in sorted(_ALL_RELATIONS - {NATIVE_TABLE})],
                }
            },
            {NATIVE_TABLE},
            id="exclude-wins",
            marks=pytest.mark.e2e_contract("filter.table.exclude-wins"),
        ),
    ],
)
def test_table_filter(filters, expected_tables, cli, redshift):
    cli.run(redshift.invocation(_metadata_options(), filters=filters))
    expect.poll(redshift.catalog_query()).satisfies(catalog_matches(_expected(redshift, tables=expected_tables)))


@pytest.mark.parametrize(
    "filter_kind",
    [
        pytest.param("include-one", marks=pytest.mark.e2e_contract("filter.schema.include-one")),
        pytest.param("exclude-wins", marks=pytest.mark.e2e_contract("filter.schema.exclude-wins")),
    ],
)
def test_schema_filter(filter_kind, cli, redshift, redshift_instance):
    with fresh_redshift_source(redshift_instance) as excluded:
        for source in (redshift.source, excluded):
            assert source.run(f"SELECT COUNT(*) FROM {source.qualified}.customers") == [(5,)]
        owned = owned_schema_pattern((redshift.source,))["includes"]
        other = owned_schema_pattern((excluded,))["includes"]
        pattern = {"includes": owned}
        if filter_kind == "exclude-wins":
            pattern = {"includes": owned + other, "excludes": other}
        cli.run(
            redshift.invocation(
                _metadata_options(), sources=(redshift.source, excluded), filters={"schemaFilterPattern": pattern}
            )
        )
        expect.poll(redshift.catalog_query()).satisfies(catalog_matches(_expected(redshift)))
