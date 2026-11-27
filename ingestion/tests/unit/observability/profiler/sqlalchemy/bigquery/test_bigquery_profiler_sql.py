#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Validate the SQL the profiler emits for BigQuery against the real BigQuery dialect.
"""

import re
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session
from sqlalchemy.sql.sqltypes import NullType
from sqlalchemy_bigquery import STRUCT
from sqlalchemy_bigquery.base import BigQueryDialect

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import BigQueryConnection
from metadata.profiler.interface.sqlalchemy.bigquery.profiler_interface import (
    BigQueryProfilerInterface,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.metrics.static.unique_count import UniqueCount
from metadata.profiler.metrics.system.bigquery.system import BigQuerySystemMetricsComputer

TABLE_NAME = "users"
# Mirrors BigQueryProfilerInterface._get_struct_columns, which names a STRUCT subfield
# with a literal dot so the inner query can address it as a record path.
NESTED_COLUMN = "customer.email"
FLAT_COLUMN = "email"

# `pyformat` is the paramstyle the BigQuery DBAPI actually uses; it is the only one that
# renders the `%(name:TYPE)s` bind annotations we assert on below.
DIALECT = BigQueryDialect(paramstyle="pyformat")
RUN_STARTED = datetime(2026, 1, 2, 0, 15, tzinfo=timezone(timedelta(hours=1)))
WINDOW_END = datetime(2026, 1, 2, tzinfo=timezone.utc)


class _BigQuerySession(Session):
    """A real ORM Session that reports the BigQuery dialect without needing GCP credentials.

    Only the connection is stubbed - statement construction and compilation stay real.
    """

    def get_bind(self, *args, **kwargs):
        return SimpleNamespace(dialect=DIALECT)


class _RecordingRunner:
    """Captures the query the profiler would have executed instead of hitting BigQuery."""

    def __init__(self):
        self.query = None

    def select_first_from_query(self, query):
        self.query = query
        return SimpleNamespace(_asdict=lambda: {UniqueCount.name(): 1})


def _sample_table(column_name):
    return sa.Table(TABLE_NAME, sa.MetaData(), sa.Column(column_name, sa.String))


def _compile(statement, literal_binds=True):
    compiled = statement.compile(dialect=DIALECT, compile_kwargs={"literal_binds": literal_binds})
    return " ".join(str(compiled).split())


def _profiler_unique_count_sql(column_name, column_type=sa.String, literal_binds=True):
    """Run the real profiler query-metric path for uniqueCount and return the emitted SQL."""
    sample = _sample_table(column_name)
    runner = _RecordingRunner()
    session = _BigQuerySession()

    SQAProfilerInterface._compute_query_metrics(
        SimpleNamespace(session=session),
        metric=Metrics.uniqueCount.value,
        runner=runner,
        column=sa.Column(column_name, column_type),
        session=session,
        sample=sample,
    )

    assert runner.query is not None, "The profiler never produced a uniqueCount query"
    return _compile(runner.query.statement, literal_binds=literal_binds)


def _countif_operand(sql):
    match = re.search(r"countif\((.+?) = ", sql)
    assert match, f"No COUNTIF comparison found in:\n{sql}"
    return match.group(1)


def _grouped_output_label(sql, source):
    """The alias the grouped sub-select/CTE exposes to the enclosing query."""
    match = re.search(r"AS `([^`]+)` FROM `" + re.escape(source) + "`", sql)
    assert match, f"No grouped output alias found in:\n{sql}"
    return match.group(1)


def test_struct_columns_are_attached_to_the_profiled_table():
    struct = STRUCT(email=sa.String)
    table = sa.Table(TABLE_NAME, sa.MetaData(), sa.Column("customer", struct))
    profiler = object.__new__(BigQueryProfilerInterface)
    profiler._table = SimpleNamespace(__table__=table)

    columns = profiler._get_struct_columns(struct._STRUCT_fields, "customer")

    assert [column.name for column in columns] == [NESTED_COLUMN]
    assert columns[0].table is table


def test_nested_struct_countif_references_the_grouped_subquery_alias():
    """A STRUCT subfield must not leak its dotted path into the COUNTIF operand.

    BigQuery's preparer quotes `customer.email` part-by-part as `customer`.`email` while
    format_label rewrites the dot, so a dotted label can never be referenced back and the
    query dies with `Unrecognized name: customer; Did you mean customer_email?`.
    """
    sql = _profiler_unique_count_sql(NESTED_COLUMN)

    alias = _grouped_output_label(sql, TABLE_NAME)
    assert _countif_operand(sql) == f"`{alias}`", f"COUNTIF operand does not match the subquery alias:\n{sql}"
    assert "`customer`.`email` = " not in sql, f"COUNTIF still references the dotted STRUCT path:\n{sql}"


def test_nested_struct_unique_count_still_addresses_the_struct_path_in_the_inner_query():
    """The fix must not break addressing the STRUCT subfield against the base table."""
    sql = _profiler_unique_count_sql(NESTED_COLUMN)

    assert "count(`customer`.`email`)" in sql, sql
    assert f"GROUP BY `{TABLE_NAME}`.`customer`.`email`" in sql, sql


def test_flat_column_countif_references_the_grouped_subquery_alias():
    """Ordinary columns must keep agreeing between the label and the reference."""
    sql = _profiler_unique_count_sql(FLAT_COLUMN)

    alias = _grouped_output_label(sql, TABLE_NAME)
    assert _countif_operand(sql) == f"`{alias}`", sql
    assert f"count(`{FLAT_COLUMN}`)" in sql, sql


def test_countif_bind_renders_as_int64_smoke():
    """Smoke check that the emitted comparison binds `1` as INT64, not as the column type.

    Binding it as the column type made BigQuery reject the profile with
    `Unparseable query parameter ... Invalid timestamp: '1'`.

    This does NOT pin our code: SQLAlchemy's `coerce_compared_value` maps the Python `1` to
    `Integer` before the dialect sees it, so the bind renders INT64 even for a typed column.
    It only guards against a dependency bump that reintroduces column-typed binds.
    `test_countif_column_is_untyped` is what actually guards the fix.
    """
    sql = _profiler_unique_count_sql(NESTED_COLUMN, column_type=sa.TIMESTAMP, literal_binds=False)

    assert re.search(r"countif\(.+ = %\(\w+:INT64\)s\)", sql), sql


def test_countif_column_is_untyped():
    """The COUNTIF operand must stay untyped so no column type reaches the comparison.

    This is the only assertion that fails if the reference is rebuilt as
    `column(UNIQUE_COUNT_GROUP_ALIAS, col.type)`: the compiled SQL is identical either way
    because SQLAlchemy coerces the bind to `Integer` regardless of the column's type.
    """
    session = _BigQuerySession()
    metric_query = UniqueCount(sa.Column(NESTED_COLUMN, sa.String)).query(sample=None, session=session)

    countif_operand = next(iter(metric_query.element.clauses))
    assert isinstance(countif_operand.left.type, NullType)


def test_non_bigquery_dialects_keep_the_grouped_having_implementation():
    """The COUNTIF shortcut is BigQuery-only; other dialects must keep the HAVING subquery."""
    postgres_dialect = postgresql.dialect()

    class _PostgresSession(Session):
        def get_bind(self, *args, **kwargs):
            return SimpleNamespace(dialect=postgres_dialect)

    sample = _sample_table(FLAT_COLUMN)
    metric_query = UniqueCount(sa.Column(FLAT_COLUMN, sa.String)).query(sample=sample, session=_PostgresSession())
    sql = " ".join(str(metric_query.statement.compile(dialect=postgres_dialect)).split())

    assert "countif" not in sql.lower(), sql
    assert "GROUP BY" in sql and "HAVING" in sql, sql


def test_nested_struct_unique_count_over_the_sampler_cte_that_only_selects_the_parent_struct():
    """BigQuerySampler samples a STRUCT subfield by selecting its parent (`customer`), so the
    sample has no `customer.email` column; the subfield must be addressed by path instead."""
    parent = sa.Table(TABLE_NAME, sa.MetaData(), sa.Column("customer", STRUCT(email=sa.String)))
    sample = sa.select(parent.c.customer).cte(f"{TABLE_NAME}_sample")
    runner = _RecordingRunner()
    session = _BigQuerySession()

    SQAProfilerInterface._compute_query_metrics(
        SimpleNamespace(session=session),
        metric=Metrics.uniqueCount.value,
        runner=runner,
        column=sa.Column(NESTED_COLUMN, sa.String),
        session=session,
        sample=sample,
    )

    assert runner.query is not None, "The profiler never produced a uniqueCount query"
    sql = _compile(runner.query.statement)
    assert f"FROM `{TABLE_NAME}_sample` GROUP BY `customer`.`email`" in sql, sql


def test_unique_count_runs_on_the_metric_threads_session():
    """Each metric thread owns a session; building the grouped query on the interface's shared
    session made concurrent columns collide ("session is provisioning a new connection")."""
    shared, thread_session = _BigQuerySession(), _BigQuerySession()
    runner = _RecordingRunner()

    SQAProfilerInterface._compute_query_metrics(
        SimpleNamespace(session=shared),
        metric=Metrics.uniqueCount.value,
        runner=runner,
        column=sa.Column(FLAT_COLUMN, sa.String),
        session=thread_session,
        sample=_sample_table(FLAT_COLUMN),
    )

    assert runner.query.session is thread_session


def _system_metrics_interface(location, config, table_type=TableType.Regular):
    connection = BigQueryConnection.model_validate(
        {
            "credentials": {"gcpConfig": {"type": "gcp_adc"}},
            "usageLocation": location,
            **config,
        }
    )
    return SimpleNamespace(
        service_connection_config=connection,
        system_metrics_class=BigQuerySystemMetricsComputer,
        table_entity=SimpleNamespace(
            tableType=table_type,
            database=SimpleNamespace(name="table-project"),
            databaseSchema=SimpleNamespace(name="table_dataset"),
            fullyQualifiedName="bigquery.table-project.table_dataset.orders",
        ),
        session=Mock(spec=Session),
        status=Mock(),
        run_started_at=RUN_STARTED,
    )


@pytest.mark.parametrize(
    ("location", "config", "projects", "lookback_days"),
    [
        ("US", {}, ["table-project"], 2),
        ("EU", {"billingProjectId": "billing-project", "systemMetricsJobProjectIds": []}, ["billing-project"], 2),
        (
            "europe-west4",
            {
                "billingProjectId": "billing-project",
                "systemMetricsJobProjectIds": [
                    "billing-project",
                    "example.org:extra_project",
                    "extra-project",
                    "example.org:extra_project",
                ],
                "systemMetricsLookbackDays": 7,
            },
            ["billing-project", "example.org:extra_project", "extra-project"],
            7,
        ),
    ],
)
def test_system_metrics_query_is_scoped_to_the_exact_table_on_the_worker_session(
    location, config, projects, lookback_days
):
    interface = _system_metrics_interface(location, config)
    worker = Mock(spec=Session)
    worker.execute.return_value = nullcontext(SimpleNamespace(mappings=list))
    runner = SimpleNamespace(table_name="orders_2026", schema_name="other_dataset", session=worker)

    profiles = BigQueryProfilerInterface._compute_system_metrics(
        interface, metrics=Metrics.system.value, runner=runner, session=worker
    )

    assert profiles == []
    interface.session.execute.assert_not_called()
    assert worker.execute.call_count == 1
    statement, parameters = worker.execute.call_args.args
    branches = _compile(statement, literal_binds=False).split(" UNION ALL ")
    assert len(branches) == len(projects)
    for branch, project in zip(branches, projects, strict=True):
        assert f"`{project}`.`region-{location.lower()}`.INFORMATION_SCHEMA.JOBS" in branch
        for predicate in (
            "destination_table.project_id = %(project_id:STRING)s",
            "destination_table.dataset_id = %(dataset_id:STRING)s",
            "destination_table.table_id = %(table_id:STRING)s",
            "job_type = 'QUERY'",
            "state = 'DONE'",
            "error_result IS NULL",
            "statement_type IN ('INSERT', 'UPDATE', 'DELETE', 'MERGE')",
            "creation_time >= %(creation_lower_bound:TIMESTAMP)s",
            "start_time >= %(window_start:TIMESTAMP)s",
            "start_time < %(window_end:TIMESTAMP)s",
        ):
            assert predicate in branch
    assert branches[-1].endswith("LIMIT 50001")
    assert parameters == {
        "project_id": "table-project",
        "dataset_id": "table_dataset",
        "table_id": "orders_2026",
        "creation_lower_bound": WINDOW_END - timedelta(days=lookback_days + 2),
        "window_start": WINDOW_END - timedelta(days=lookback_days),
        "window_end": WINDOW_END,
    }


@pytest.mark.parametrize(
    ("location", "config", "message"),
    [
        ("US west", {}, "Invalid BigQuery jobs location"),
        ("US", {"systemMetricsJobProjectIds": ["extra project"]}, "Invalid BigQuery jobs project ID"),
    ],
)
def test_system_metrics_rejects_invalid_jobs_view_identifiers(location, config, message):
    interface = _system_metrics_interface(location, config)
    worker = Mock(spec=Session)
    runner = SimpleNamespace(table_name="orders")

    with pytest.raises(RuntimeError, match=message):
        BigQueryProfilerInterface._compute_system_metrics(
            interface, metrics=Metrics.system.value, runner=runner, session=worker
        )

    worker.execute.assert_not_called()


def test_system_metrics_skip_sharded_tables():
    interface = _system_metrics_interface("US", {}, TableType.Sharded)
    worker = Mock(spec=Session)

    assert (
        BigQueryProfilerInterface._compute_system_metrics(
            interface, metrics=Metrics.system.value, runner=SimpleNamespace(), session=worker
        )
        == []
    )
    worker.execute.assert_not_called()
