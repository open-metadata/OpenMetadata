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
Snowflake system metrics read the DML history of a batch of tables with one scan
"""

import uuid
from datetime import datetime
from unittest.mock import Mock

import pytest
from sqlalchemy.engine.result import IteratorResult, SimpleResultMetaData

from metadata.generated.schema.entity.data.table import (
    Column,
    DataType,
    DmlOperationType,
    Table,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.ingestion.source.database.snowflake.queries import (
    build_batched_dynamic_table_refresh_history_query,
    build_batched_query_log_query,
)
from metadata.profiler.metrics.system.snowflake.system import (
    DYNAMIC_TABLE_REFRESH_INDEX,
    QUERY_HISTORY_INDEX,
    SnowflakeSystemMetricsComputer,
    SnowflakeTableResovler,
    _cache,
)
from metadata.profiler.metrics.system.system import (
    TABLE_BATCH_WINDOW,
    TableBatchWindow,
)

SERVICE = "snowflake_svc"
DATABASE = "PROD"
SCHEMA = "FINANCE"
START = datetime(2026, 10, 14, 12, 0, 0)

QUERY_HISTORY_COLUMNS = [
    "QUERY_ID",
    "QUERY_TEXT",
    "QUERY_TYPE",
    "START_TIME",
    "DATABASE_NAME",
    "SCHEMA_NAME",
    "ROWS_INSERTED",
    "ROWS_UPDATED",
    "ROWS_DELETED",
]
DYNAMIC_REFRESH_COLUMNS = [
    "DATABASE_NAME",
    "SCHEMA_NAME",
    "TABLE_NAME",
    "START_TIME",
    "ROWS_INSERTED",
    "ROWS_DELETED",
]
SHOW_TABLES_COLUMNS = ["created_on", "name", "database_name", "schema_name"]


class FakeSnowflakeSession:
    """Answers every QUERY_HISTORY / DYNAMIC_TABLE_REFRESH_HISTORY scan with the same
    rows, as ILIKE would for overlapping names, and records each statement run."""

    def __init__(self, query_history=(), dynamic_refreshes=(), existing_tables=()):
        self.query_history = list(query_history)
        self.dynamic_refreshes = list(dynamic_refreshes)
        self.existing_tables = {name.upper() for name in existing_tables}
        self.statements: list[str] = []

    def execute(self, statement):
        sql = str(statement)
        self.statements.append(sql)
        if "DYNAMIC_TABLE_REFRESH_HISTORY" in sql:
            return IteratorResult(SimpleResultMetaData(DYNAMIC_REFRESH_COLUMNS), iter(self.dynamic_refreshes))
        if "QUERY_HISTORY" in sql:
            return IteratorResult(SimpleResultMetaData(QUERY_HISTORY_COLUMNS), iter(self.query_history))
        if sql.startswith("SHOW TABLES"):
            rows = [
                (START, name.split(".")[-1], *name.split(".")[:2])
                for name in self.existing_tables
                if f'"{name.split(".")[0]}"."{name.split(".")[1]}"' in sql.upper()
            ]
            return IteratorResult(SimpleResultMetaData(SHOW_TABLES_COLUMNS), iter(rows))
        raise AssertionError(f"Unexpected statement: {sql}")

    def scans(self, view: str) -> list[str]:
        return [sql for sql in self.statements if f"{view}" in sql and not sql.startswith("SHOW")]

    @property
    def query_history_scans(self) -> list[str]:
        return [sql for sql in self.scans("QUERY_HISTORY") if "DYNAMIC_TABLE" not in sql]

    @property
    def show_tables_calls(self) -> list[str]:
        return [sql for sql in self.statements if sql.startswith("SHOW TABLES")]


def dml(query_id, query_text, query_type, inserted=0, updated=0, deleted=0, context=(DATABASE, SCHEMA)):
    return (query_id, query_text, query_type, START, *context, inserted, updated, deleted)


def table_fqn(name, schema=SCHEMA):
    return f"{SERVICE}.{DATABASE.lower()}.{schema.lower()}.{name}"


def make_computer(session, name, table_type=TableType.Regular, schema=SCHEMA):
    runner = Mock()
    runner.table_name = name
    runner.schema_name = schema
    runner.session.get_bind.return_value.url.database = DATABASE
    entity = Table(
        id=uuid.uuid4(),
        name=name,
        fullyQualifiedName=table_fqn(name, schema),
        columns=[Column(name="id", dataType=DataType.INT)],
        tableType=table_type,
    )
    return SnowflakeSystemMetricsComputer(
        session=session,
        runner=runner,
        service_connection_config=SnowflakeConnection.model_construct(accountUsageSchema="SNOWFLAKE.ACCOUNT_USAGE"),
        table_entity=entity,
    )


def rows_affected(profiles, operation):
    return sorted(p.rowsAffected for p in profiles if p.operation == operation)


@pytest.fixture(autouse=True)
def isolated_run_state():
    for state in (TABLE_BATCH_WINDOW, QUERY_HISTORY_INDEX, DYNAMIC_TABLE_REFRESH_INDEX, _cache):
        state.clear()
    yield
    for state in (TABLE_BATCH_WINDOW, QUERY_HISTORY_INDEX, DYNAMIC_TABLE_REFRESH_INDEX, _cache):
        state.clear()


def test_a_batch_of_tables_scans_query_history_once():
    session = FakeSnowflakeSession(
        query_history=[
            dml("1", "INSERT INTO PROD.FINANCE.ORDERS SELECT * FROM RAW", "INSERT", inserted=5),
            dml("2", "UPDATE PROD.FINANCE.CUSTOMERS SET X = 1", "UPDATE", updated=3),
            dml("3", "DELETE FROM PROD.FINANCE.LINE_ITEMS WHERE X = 1", "DELETE", deleted=2),
            dml("4", "MERGE INTO PROD.FINANCE.ORDERS USING RAW ON 1 = 1", "MERGE", inserted=7, updated=4),
        ]
    )
    names = ["orders", "customers", "line_items"]
    TABLE_BATCH_WINDOW.register([table_fqn(name) for name in names])

    metrics = {name: make_computer(session, name).get_system_metrics() for name in names}

    assert len(session.query_history_scans) == 1
    assert rows_affected(metrics["orders"], DmlOperationType.INSERT) == [5, 7]
    assert rows_affected(metrics["orders"], DmlOperationType.UPDATE) == [4]
    assert rows_affected(metrics["customers"], DmlOperationType.UPDATE) == [3]
    assert rows_affected(metrics["line_items"], DmlOperationType.DELETE) == [2]
    assert rows_affected(metrics["customers"], DmlOperationType.INSERT) == []


def test_the_batch_scan_matches_every_table_of_the_batch():
    session = FakeSnowflakeSession()
    TABLE_BATCH_WINDOW.register([table_fqn("orders"), table_fqn("line_items")])

    make_computer(session, "orders").get_inserts()

    (scan,) = session.query_history_scans
    assert "QUERY_TEXT ILIKE '%orders%'" in scan
    assert "QUERY_TEXT ILIKE '%line\\\\_items%'" in scan


def test_a_name_matched_inside_another_table_name_is_not_attributed_or_resolved():
    session = FakeSnowflakeSession(
        query_history=[
            dml("1", "INSERT INTO CUSTOMER_ORDERS VALUES (1)", "INSERT", inserted=9),
            dml("2", "INSERT INTO PROD.FINANCE.ORDERS VALUES (1)", "INSERT", inserted=1),
        ]
    )
    TABLE_BATCH_WINDOW.register([table_fqn("orders")])

    inserts = make_computer(session, "orders").get_inserts()

    assert [p.rowsAffected for p in inserts] == [1]
    assert session.show_tables_calls == []


def test_rows_for_a_same_named_table_elsewhere_are_not_kept():
    session = FakeSnowflakeSession(
        query_history=[
            dml("1", "INSERT INTO PROD.STAGING.ORDERS VALUES (1)", "INSERT", inserted=8),
            dml("2", "INSERT INTO PROD.FINANCE.ORDERS VALUES (1)", "INSERT", inserted=1),
        ]
    )
    TABLE_BATCH_WINDOW.register([table_fqn("orders")])

    inserts = make_computer(session, "orders").get_inserts()

    assert [p.rowsAffected for p in inserts] == [1]
    (index,) = QUERY_HISTORY_INDEX._indexes.values()
    assert set(index) == {("prod", "finance", "orders")}


def test_an_unqualified_target_is_resolved_with_the_session_context():
    session = FakeSnowflakeSession(
        query_history=[dml("1", "INSERT INTO ORDERS VALUES (1)", "INSERT", inserted=4)],
        existing_tables=["PROD.FINANCE.ORDERS"],
    )
    TABLE_BATCH_WINDOW.register([table_fqn("orders")])

    inserts = make_computer(session, "orders").get_inserts()

    assert [p.rowsAffected for p in inserts] == [4]


def test_a_query_matched_by_two_batches_is_counted_once():
    session = FakeSnowflakeSession(
        query_history=[
            dml(
                "1",
                "INSERT INTO PROD.FINANCE.ORDERS_ARCHIVE SELECT * FROM PROD.FINANCE.ORDERS",
                "INSERT",
                inserted=6,
            )
        ]
    )

    TABLE_BATCH_WINDOW.register([table_fqn("orders")])
    orders = make_computer(session, "orders").get_inserts()
    TABLE_BATCH_WINDOW.register([table_fqn("orders_archive")])
    archive = make_computer(session, "orders_archive").get_inserts()

    assert len(session.query_history_scans) == 2
    assert orders == []
    assert [p.rowsAffected for p in archive] == [6]


def test_a_table_outside_the_batch_window_is_scanned_alone_once():
    session = FakeSnowflakeSession(
        query_history=[dml("1", "DELETE FROM PROD.FINANCE.ORDERS", "DELETE", deleted=3)],
    )
    TABLE_BATCH_WINDOW.register([table_fqn("customers")])

    metrics = make_computer(session, "orders").get_system_metrics()

    (scan,) = session.query_history_scans
    assert "'%orders%'" in scan
    assert "customers" not in scan
    assert rows_affected(metrics, DmlOperationType.DELETE) == [3]


def test_only_the_latest_batches_are_retained():
    window = TableBatchWindow(max_batches=2)
    first = window.register(["a.b.c.t1"])
    window.register(["a.b.c.t2"])
    window.register(["a.b.c.t3"])

    assert window.batch_for("a.b.c.t1") is None
    assert window.batch_for("a.b.c.t3").table_fqns == ("a.b.c.t3",)
    assert first.batch_id not in {window.batch_for(f"a.b.c.t{i}").batch_id for i in (2, 3)}

    session = FakeSnowflakeSession()
    for name in ("t1", "t2", "t3"):
        TABLE_BATCH_WINDOW.register([table_fqn(name)])
        make_computer(session, name).get_inserts()

    assert len(QUERY_HISTORY_INDEX._indexes) == 2


def test_the_index_does_not_retain_query_text():
    long_text = "INSERT INTO PROD.FINANCE.ORDERS VALUES " + ", ".join(["(1)"] * 10_000)
    session = FakeSnowflakeSession(query_history=[dml("1", long_text, "INSERT", inserted=1)])
    TABLE_BATCH_WINDOW.register([table_fqn("orders")])

    (record,) = make_computer(session, "orders").get_queries("orders")

    assert long_text not in record
    assert not hasattr(record, "query_text")


def test_dynamic_tables_of_a_batch_share_one_exact_name_scan():
    session = FakeSnowflakeSession(
        dynamic_refreshes=[
            (DATABASE, SCHEMA, "DYN_A", START, 10, 0),
            (DATABASE, SCHEMA, "DYN_B", START, 0, 4),
            (DATABASE, "OTHER_SCHEMA", "DYN_A", START, 99, 0),
        ]
    )
    TABLE_BATCH_WINDOW.register([table_fqn("dyn_a"), table_fqn("dyn_b")])

    dyn_a = make_computer(session, "dyn_a", TableType.Dynamic).get_system_metrics()
    dyn_b = make_computer(session, "dyn_b", TableType.Dynamic).get_system_metrics()

    (scan,) = session.scans("DYNAMIC_TABLE_REFRESH_HISTORY")
    assert "UPPER(name) IN ('DYN_A', 'DYN_B')" in scan
    assert rows_affected(dyn_a, DmlOperationType.INSERT) == [10]
    assert rows_affected(dyn_b, DmlOperationType.DELETE) == [4]


def test_the_batched_query_escapes_wildcards_and_quotes_and_dedupes_names():
    query = build_batched_query_log_query(
        account_usage_schema='"SNOWFLAKE"."ACCOUNT_USAGE"',
        table_names=["orders", "ORDERS", "order_items", "it's", "100%", "back\\slash"],
    )

    assert query.count("ILIKE") == 5
    assert "ILIKE '%order\\\\_items%' ESCAPE '\\\\'" in query
    assert "ILIKE '%it''s%'" in query
    assert "ILIKE '%100\\\\%%'" in query
    assert "ILIKE '%back\\\\\\\\slash%'" in query


def test_the_dynamic_table_query_quotes_names():
    query = build_batched_dynamic_table_refresh_history_query(
        account_usage_schema='"SNOWFLAKE"."ACCOUNT_USAGE"',
        table_names=["dyn", "DYN", "it's"],
    )

    assert "UPPER(name) IN ('DYN', 'IT''S')" in query


@pytest.mark.parametrize(
    "builder",
    [build_batched_query_log_query, build_batched_dynamic_table_refresh_history_query],
)
def test_an_empty_batch_is_rejected(builder):
    with pytest.raises(ValueError):
        builder(account_usage_schema="SNOWFLAKE.ACCOUNT_USAGE", table_names=[])


def test_the_resolver_caches_tables_that_exist_and_those_that_do_not():
    session = FakeSnowflakeSession(existing_tables=["PROD.FINANCE.ORDERS"])
    resolver = SnowflakeTableResovler(session)

    assert [resolver.table_exists("PROD", "FINANCE", "ORDERS") for _ in range(3)] == [True] * 3
    assert [resolver.table_exists("PROD", "FINANCE", "MISSING") for _ in range(3)] == [False] * 3
    assert len(session.show_tables_calls) == 2
