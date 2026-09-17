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
"""Real MySQL source → CLI → persisted OpenMetadata feature scenarios."""

import pytest
from sqlalchemy import select, text

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.utils import model_str

from ..contracts.workflow import test_workflow  # noqa: F401
from ..features.database.catalog.snapshot import read_catalog
from ..features.database.entities import (
    column,
    column_has_no_tag,
    column_has_tag,
    entity_exists,
    table_has_schema_definition,
    table_is_deleted,
    table_query,
)
from ..features.database.lineage import lineage_has_columns, lineage_has_edge, lineage_query
from ..features.database.pipelines import (
    AutoClassificationPipeline,
    LineagePipeline,
    MetadataPipeline,
    ProfilerPipeline,
)
from ..features.database.profiles import column_has_metrics, profile_query, table_has_row_count
from ..features.database.samples import sample_query
from ..runtime import expect
from ..runtime.case import WorkflowCase, run_and_check
from ..runtime.expect import Query
from .cases import mysql_catalog_matches, native_sample_rows, native_samples_match
from .connector import mysql_invocation
from .expected import mysql_expected
from .source import fresh_mysql_source

_ALL_PROFILER_METRICS = [
    MetricType.rowCount,
    MetricType.columnCount,
    MetricType.columnNames,
    MetricType.valuesCount,
    MetricType.nullCount,
    MetricType.nullProportion,
    MetricType.distinctCount,
    MetricType.distinctProportion,
    MetricType.uniqueCount,
    MetricType.uniqueProportion,
    MetricType.duplicateCount,
    MetricType.min,
    MetricType.max,
    MetricType.mean,
    MetricType.sum,
    MetricType.stddev,
    MetricType.median,
    MetricType.firstQuartile,
    MetricType.thirdQuartile,
    MetricType.interQuartileRange,
    MetricType.nonParametricSkew,
    MetricType.histogram,
    MetricType.minLength,
    MetricType.maxLength,
]


def profiler_options():
    return ProfilerPipeline(
        metrics=_ALL_PROFILER_METRICS,
        profileSampleConfig={
            "sampleConfigType": "STATIC",
            "config": {"profileSample": 100, "profileSampleType": "PERCENTAGE"},
        },
        randomizedSample=False,
        useStatistics=False,
    )


@pytest.mark.e2e_contract("profile.metrics")
def test_profiler_metrics(cli, om, mysql_run, mysql_source, service_name, mysql_metadata):
    cli.run(mysql_run(profiler_options()))
    base = f"{service_name}.default.{mysql_source.schema}"
    for name, count in (("customers", 5), ("transactions", 5), ("all_types", 3)):
        expect.poll(profile_query(om, f"{base}.{name}")).satisfies(table_has_row_count(count))
    expect.poll(profile_query(om, f"{base}.customers")).satisfies(
        column_has_metrics(
            "credit_score",
            valuesCount=5,
            nullCount=0,
            distinctCount=5,
            uniqueCount=5,
            min=600,
            max=750,
            mean=680,
            sum=3400,
            median=680,
        )
    )
    expect.poll(profile_query(om, f"{base}.customers")).satisfies(
        column_has_metrics("first_name", valuesCount=5, nullCount=0, minLength=3, maxLength=7)
    )


@pytest.mark.parametrize(
    "observation",
    [
        pytest.param("column-freshness", marks=pytest.mark.e2e_contract("profile.freshness.columns")),
        pytest.param("row-count-freshness", marks=pytest.mark.e2e_contract("profile.freshness.rows")),
    ],
)
def test_profile_null_duplicates_and_freshness(
    observation, cli, om, mysql_run, mysql_source, service_name, mysql_profile_table
):
    filters = {"tableFilterPattern": {"includes": ["profile_values"]}}
    cli.run(mysql_run(MetadataPipeline(includeStoredProcedures=False), filters))
    invocation = mysql_run(profiler_options(), filters)
    cli.run(invocation)
    query = profile_query(om, f"{service_name}.default.{mysql_source.schema}.profile_values")

    def initial(table):
        if observation == "row-count-freshness":
            table_has_row_count(4)(table)
        else:
            assert table is not None and table.profile is not None, "table profile missing"
            column_has_metrics(
                "score",
                valuesCount=3,
                nullCount=1,
                distinctCount=2,
                uniqueCount=1,
                min=10,
                max=20,
                sum=50,
                # MySQL AVG(INT) retains four fractional digits.
                mean=pytest.approx(50 / 3, abs=0.00005, rel=0),
            )(table)

    before = expect.poll(query).satisfies(initial)
    if observation == "column-freshness":
        table_timestamp = before.profile.timestamp.root
        column_timestamp = column(before, "score").profile.timestamp.root
    with mysql_source.admin_engine.begin() as connection:
        connection.execute(mysql_profile_table.insert(), {"id": 5, "score": 40})
    with mysql_source.admin_engine.connect() as connection:
        assert connection.execute(
            select(mysql_profile_table.c.score).order_by(mysql_profile_table.c.id)
        ).scalars().all() == [10, 20, 20, None, 40]
    cli.run(invocation)

    def updated(table):
        if observation == "row-count-freshness":
            table_has_row_count(5)(table)
        else:
            assert table is not None and table.profile is not None, "table profile missing"
            column_has_metrics(
                "score", valuesCount=4, nullCount=1, distinctCount=3, uniqueCount=2, min=10, max=40, sum=90, mean=22.5
            )(table)
            assert table.profile.timestamp.root > table_timestamp
            assert column(table, "score").profile.timestamp.root > column_timestamp

    expect.poll(query).satisfies(updated)


@pytest.mark.parametrize(
    "int_value",
    [
        pytest.param(123456, id="original", marks=pytest.mark.e2e_contract("sample.values.original")),
        pytest.param(654321, id="updated", marks=pytest.mark.e2e_contract("sample.values.updated")),
    ],
)
def test_persisted_native_sample_values(int_value, cli, om, mysql_run, mysql_source, service_name, mysql_metadata):
    if int_value != 123456:
        mysql_source.set_value("all_types", 1, "int_col", int_value)
    table = expect.poll(table_query(om, f"{service_name}.default.{mysql_source.schema}.all_types")).satisfies(
        entity_exists
    )
    cli.run(
        mysql_run(
            AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=False, sampleDataCount=10),
            {"tableFilterPattern": {"includes": ["all_types"]}},
        )
    )
    expect.poll(sample_query(om, table)).satisfies(lambda sampled: native_samples_match(sampled, int_value=int_value))


@pytest.mark.e2e_contract("sample.values.replacement")
def test_reingest_replaces_persisted_samples(cli, om, mysql_run, mysql_source, service_name, mysql_metadata):
    table = expect.poll(table_query(om, f"{service_name}.default.{mysql_source.schema}.all_types")).satisfies(
        entity_exists
    )
    invocation = mysql_run(
        AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=False, sampleDataCount=10),
        {"tableFilterPattern": {"includes": ["all_types"]}},
    )
    query = sample_query(om, table)

    def values_match(sampled, expected):
        assert sampled is not None, "sample data missing"
        assert sampled.id == table.id, "samples belong to a different table"
        actual = {key: row["int_col"] for key, row in native_sample_rows(sampled).items()}
        assert actual == expected, f"int_col samples: expected {expected!r}, got {actual!r}"

    cli.run(invocation)
    expect.poll(query).satisfies(lambda sampled: values_match(sampled, {1: 123456, 2: None, 3: None}))
    mysql_source.set_value("all_types", 1, "int_col", 654321)
    cli.run(invocation)
    expect.poll(query).satisfies(lambda sampled: values_match(sampled, {1: 654321, 2: None, 3: None}))


@pytest.mark.e2e_contract("lineage.view")
def test_lineage_view_references_tables(cli, om, mysql_run, mysql_source, service_name, mysql_metadata):
    base = f"{service_name}.default.{mysql_source.schema}"
    view = f"{base}.customer_txn_summary"
    expect.poll(table_query(om, view)).satisfies(table_has_schema_definition("LEFT JOIN"))
    cli.run(mysql_run(LineagePipeline(processQueryLineage=False)))

    def check(graph):
        lineage_has_edge(f"{base}.customers", view)(graph)
        lineage_has_edge(f"{base}.transactions", view)(graph)
        lineage_has_columns(
            (f"{base}.customers.id", f"{base}.transactions.amount"), (f"{view}.customer_id", f"{view}.total_amount")
        )(graph)

    expect.poll(lineage_query(om, view)).satisfies(check)


@pytest.mark.e2e_contract("classification.tags")
def test_auto_classification_tags_pii_columns(cli, om, mysql_run, mysql_source, service_name, mysql_metadata):
    cli.run(mysql_run(AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=True, confidence=60)))

    def check(table):
        column_has_tag("email", "PII.Sensitive")(table)
        column_has_tag("date_of_birth", "PII.NonSensitive")(table)
        for name in ("id", "status"):
            for tag in ("PII.Sensitive", "PII.NonSensitive"):
                column_has_no_tag(name, tag)(table)

    expect.poll(table_query(om, f"{service_name}.default.{mysql_source.schema}.customers")).satisfies(check)


@pytest.mark.e2e_contract("deletion.tables")
def test_mark_deleted_tables_on_reingest(cli, om, mysql_run, mysql_source, service_name):
    invocation = mysql_run(MetadataPipeline(markDeletedTables=True, includeStoredProcedures=False))
    cli.run(invocation)
    base = f"{service_name}.default.{mysql_source.schema}"
    removed = table_query(om, f"{base}.all_types")
    retained = table_query(om, f"{base}.customers")
    before = expect.poll(removed).satisfies(table_is_deleted(deleted=False))
    sibling = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    mysql_source.drop_table("all_types")
    cli.run(invocation)
    after = expect.poll(removed).satisfies(table_is_deleted(deleted=True))
    survivor = expect.poll(retained).satisfies(table_is_deleted(deleted=False))
    assert after.id == before.id
    assert survivor.id == sibling.id


@pytest.mark.e2e_contract("ingest.repeat")
def test_repeat_ingest_preserves_ids_and_updates_metadata(cli, om, mysql_case, mysql_run, mysql_source, service_name):
    run_and_check(cli, mysql_case)
    before = mysql_case.persisted.read()
    original_ids = {model_str(table.fullyQualifiedName): table.id for table in before.tables}
    quoted = mysql_source.admin_engine.dialect.identifier_preparer.quote_identifier(mysql_source.schema)
    with mysql_source.admin_engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {quoted}.all_types COMMENT = 'Updated native values fixture'"))
    mysql_source.set_value("all_types", 1, "int_col", 654321)
    cli.run(mysql_run(MetadataPipeline(includeDDL=True, includeStoredProcedures=True, overrideMetadata=True)))
    expected = mysql_expected(service_name, schema=mysql_source.schema)

    def updated(snapshot):
        mysql_catalog_matches(expected)(snapshot)
        assert len(snapshot.tables) == len(original_ids)
        assert {model_str(table.fullyQualifiedName): table.id for table in snapshot.tables} == original_ids
        table = snapshot.find(Table, f"{service_name}.default.{mysql_source.schema}.all_types")
        assert model_str(table.description) == "Updated native values fixture"

    expect.poll(mysql_case.persisted).satisfies(updated)
    table = expect.poll(table_query(om, f"{service_name}.default.{mysql_source.schema}.all_types")).satisfies(
        entity_exists
    )
    cli.run(
        mysql_run(
            AutoClassificationPipeline(storeSampleData=True, enableAutoClassification=False, sampleDataCount=10),
            {"tableFilterPattern": {"includes": ["all_types"]}},
        )
    )

    def updated_values(sampled):
        rows = native_sample_rows(sampled)
        assert {key: row["int_col"] for key, row in rows.items()} == {1: 654321, 2: None, 3: None}

    expect.poll(sample_query(om, table)).satisfies(updated_values)


@pytest.mark.e2e_contract("error.containment")
def test_error_containment_one_broken_view(cli, om, mysql_run, mysql_source, service_name):
    quoted = mysql_source.admin_engine.dialect.identifier_preparer.quote_identifier(mysql_source.schema)
    with mysql_source.admin_engine.begin() as connection:
        connection.execute(text(f"CREATE TABLE {quoted}._helper_for_broken_view (id INT PRIMARY KEY, doomed_col INT)"))
        connection.execute(
            text(f"CREATE VIEW {quoted}._broken_view AS SELECT id, doomed_col FROM {quoted}._helper_for_broken_view")
        )
        connection.execute(text(f"ALTER TABLE {quoted}._helper_for_broken_view DROP COLUMN doomed_col"))
    invocation = mysql_run(MetadataPipeline(includeStoredProcedures=False))
    # Ten successes out of eleven pass the default 90%; require every record to succeed.
    invocation.config["workflowConfig"].update(successThreshold=100, raiseOnError=True)
    result = cli.run(invocation, expected_exit=1, expected_success=False, expected_errors=1)
    assert result.status.total_errors == 1
    assert len(result.status.all_failures) == 1
    assert result.status.all_failures[0]["name"] == "_broken_view"
    for name in ("customers", "transactions", "all_types"):
        expect.poll(table_query(om, f"{service_name}.default.{mysql_source.schema}.{name}")).satisfies(
            table_is_deleted(deleted=False)
        )


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
def test_table_filter(filters, expected_tables, mysql_filter_case, cli):
    run_and_check(cli, mysql_filter_case(filters, expected_tables))


@pytest.mark.parametrize(
    "filter_kind",
    [
        pytest.param("include-one", marks=pytest.mark.e2e_contract("filter.schema.include-one")),
        pytest.param("exclude-wins", marks=pytest.mark.e2e_contract("filter.schema.exclude-wins")),
    ],
)
def test_schema_filter(
    filter_kind, cli, om, mysql_source, mysql_admin_engine, mysql_ingestion_engine, service_name, om_server_config
):
    with fresh_mysql_source(mysql_admin_engine) as excluded:
        for source in (mysql_source, excluded):
            quoted = mysql_ingestion_engine.dialect.identifier_preparer.quote_identifier(source.schema)
            with mysql_ingestion_engine.connect() as connection:
                assert connection.execute(text(f"SELECT COUNT(*) FROM {quoted}.customers")).scalar_one() == 5
        pattern = {"includes": [mysql_source.schema]}
        if filter_kind == "exclude-wins":
            pattern = {"includes": [mysql_source.schema, excluded.schema], "excludes": [excluded.schema]}
        invocation = mysql_invocation(
            service_name=service_name,
            sources=(mysql_source, excluded),
            options=MetadataPipeline(includeDDL=True, includeStoredProcedures=True),
            filters={"schemaFilterPattern": pattern},
            server=om_server_config,
        )
        assert "databaseSchema" not in invocation.config["source"]["serviceConnection"]["config"]
        run_and_check(
            cli,
            WorkflowCase(
                invocation,
                Query(f"two-schema catalog {service_name}", lambda: read_catalog(om, service_name)),
                mysql_catalog_matches(mysql_expected(service_name, schema=mysql_source.schema)),
            ),
        )
