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
from pydantic import ValidationError
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
from metadata.ingestion.source.database.snowflake.models import (
    SnowflakeDynamicTableRefreshEntry,
    SnowflakeQueryLogEntry,
)
from metadata.ingestion.source.database.snowflake.queries import (
    build_batched_dynamic_table_refresh_history_query,
    build_batched_query_log_query,
)
from metadata.ingestion.source.database.snowflake.settings import SnowflakeSettings
from metadata.profiler.metrics.system.snowflake import system as snowflake_system
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
from metadata.utils import fqn

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
        self.history_results = []
        self.history_rows_read: list[int] = []

    def execute(self, statement):
        sql = str(statement)
        self.statements.append(sql)
        if "DYNAMIC_TABLE_REFRESH_HISTORY" in sql:
            return self._history_result(DYNAMIC_REFRESH_COLUMNS, self.dynamic_refreshes)
        if "QUERY_HISTORY" in sql:
            return self._history_result(QUERY_HISTORY_COLUMNS, self.query_history)
        if sql.startswith("SHOW TABLES"):
            rows = [
                (START, name.split(".")[-1], *name.split(".")[:2])
                for name in self.existing_tables
                if f'"{name.split(".")[0]}"."{name.split(".")[1]}"' in sql.upper()
            ]
            return IteratorResult(SimpleResultMetaData(SHOW_TABLES_COLUMNS), iter(rows))
        raise AssertionError(f"Unexpected statement: {sql}")

    def _history_result(self, columns, rows):
        position = len(self.history_rows_read)
        self.history_rows_read.append(0)

        def stream():
            for row in rows:
                self.history_rows_read[position] += 1
                yield row

        result = IteratorResult(SimpleResultMetaData(columns), stream())
        self.history_results.append(result)
        return result

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


def table_fqn(name, schema=SCHEMA, database=DATABASE):
    return ".".join(fqn.quote_name(part) for part in (SERVICE, database.lower(), schema.lower(), name))


def make_computer(session, name, table_type=TableType.Regular, schema=SCHEMA, database=DATABASE):
    runner = Mock()
    runner.table_name = name
    runner.schema_name = schema
    runner.session.get_bind.return_value.url.database = database
    entity = Table(
        id=uuid.uuid4(),
        name=name,
        fullyQualifiedName=table_fqn(name, schema, database),
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


@pytest.mark.parametrize(
    ("database", "schema", "names"),
    [
        ("PROD.WEST", SCHEMA, ["orders", "customers"]),
        (DATABASE, "FINANCE.WEST", ["orders", "customers"]),
        (DATABASE, SCHEMA, ["orders.west", "customers.west"]),
    ],
)
def test_quoted_fqn_components_share_the_batch_scan(database, schema, names):
    session = FakeSnowflakeSession(
        query_history=[
            dml(str(i), f'INSERT INTO "{database}"."{schema}"."{name}" VALUES (1)', "INSERT", inserted=i + 1)
            for i, name in enumerate(names)
        ]
    )
    TABLE_BATCH_WINDOW.register([table_fqn(name, schema, database) for name in names])

    profiles = [make_computer(session, name, schema=schema, database=database).get_inserts() for name in names]

    assert [[p.rowsAffected for p in result] for result in profiles] == [[1], [2]]
    assert len(session.query_history_scans) == 1


@pytest.mark.parametrize("dynamic", [False, True])
def test_history_stream_closes_the_cursor_when_consumption_stops(dynamic):
    if dynamic:
        model = SnowflakeDynamicTableRefreshEntry
        result = IteratorResult(
            SimpleResultMetaData(DYNAMIC_REFRESH_COLUMNS), iter([(DATABASE, SCHEMA, "DYN_A", START, 1, 0)] * 2)
        )
    else:
        model = SnowflakeQueryLogEntry
        result = IteratorResult(
            SimpleResultMetaData(QUERY_HISTORY_COLUMNS),
            iter([dml("1", "INSERT INTO ORDERS VALUES (1)", "INSERT", inserted=1)] * 2),
        )
    session = Mock()
    session.execute.return_value = result
    stream = model.stream_for_tables(
        session, ["orders"], SnowflakeConnection.model_construct(accountUsageSchema="SNOWFLAKE.ACCOUNT_USAGE")
    )

    next(stream)
    stream.close()

    assert result.closed


def test_discarding_an_old_batch_preserves_a_new_registration_for_the_same_table():
    window = TableBatchWindow()
    old = window.register([table_fqn("orders")])
    current = window.register([table_fqn("orders")])

    window.discard(old)

    assert window.batch_for(table_fqn("orders")) == current


def test_a_standalone_profile_after_a_released_batch_reads_fresh_history():
    first_session = FakeSnowflakeSession(
        query_history=[
            dml("1", "INSERT INTO PROD.FINANCE.ORDERS VALUES (1)", "INSERT", inserted=1),
        ]
    )
    batch = TABLE_BATCH_WINDOW.register([table_fqn("orders")])
    assert [p.rowsAffected for p in make_computer(first_session, "orders").get_inserts()] == [1]
    TABLE_BATCH_WINDOW.discard(batch)
    next_session = FakeSnowflakeSession(
        query_history=[
            dml("2", "INSERT INTO PROD.FINANCE.ORDERS VALUES (1)", "INSERT", inserted=9),
        ]
    )

    profiles = make_computer(next_session, "orders").get_inserts()

    assert [p.rowsAffected for p in profiles] == [9]
    assert len(next_session.query_history_scans) == 1


def test_oversized_dml_batch_falls_back_once_per_table_without_losing_metrics(monkeypatch):
    budget = snowflake_system.HISTORY_MEMORY_BUDGET
    monkeypatch.setattr(budget, "max_bytes", 4096)
    session = FakeSnowflakeSession(
        query_history=[
            *[dml(str(i), "INSERT INTO PROD.FINANCE.ORDERS VALUES (1)", "INSERT", inserted=1) for i in range(20)],
            dml("update", "UPDATE PROD.FINANCE.ORDERS SET X = 1", "UPDATE", updated=7),
            dml("delete", "DELETE FROM PROD.FINANCE.ORDERS", "DELETE", deleted=3),
            dml("merge", "MERGE INTO PROD.FINANCE.CUSTOMERS USING RAW ON 1 = 1", "MERGE", inserted=4, updated=2),
            dml("customer-delete", "DELETE FROM PROD.FINANCE.CUSTOMERS", "DELETE", deleted=6),
        ]
    )
    batch = TABLE_BATCH_WINDOW.register([table_fqn("orders"), table_fqn("customers")])

    orders = make_computer(session, "orders").get_system_metrics()
    customers = make_computer(session, "customers").get_system_metrics()

    assert rows_affected(orders, DmlOperationType.INSERT) == [1] * 20
    assert rows_affected(orders, DmlOperationType.UPDATE) == [7]
    assert rows_affected(orders, DmlOperationType.DELETE) == [3]
    assert rows_affected(customers, DmlOperationType.INSERT) == [4]
    assert rows_affected(customers, DmlOperationType.UPDATE) == [2]
    assert rows_affected(customers, DmlOperationType.DELETE) == [6]
    assert len(session.query_history_scans) == 3
    assert 0 < session.history_rows_read[0] < len(session.query_history)
    assert all(result.closed for result in session.history_results)
    assert QUERY_HISTORY_INDEX._indexes[batch.batch_id] is None
    assert budget.used_bytes == 0


def test_oversized_dynamic_batch_falls_back_without_losing_refreshes(monkeypatch):
    budget = snowflake_system.HISTORY_MEMORY_BUDGET
    monkeypatch.setattr(budget, "max_bytes", 4096)
    session = FakeSnowflakeSession(
        dynamic_refreshes=[
            *[(DATABASE, SCHEMA, "DYN_A", START, 2, 0) for _ in range(20)],
            (DATABASE, SCHEMA, "DYN_B", START, 0, 4),
            (DATABASE, "OTHER", "DYN_B", START, 0, 99),
        ]
    )
    TABLE_BATCH_WINDOW.register([table_fqn("dyn_a"), table_fqn("dyn_b")])

    dyn_a = make_computer(session, "dyn_a", TableType.Dynamic).get_system_metrics()
    dyn_b = make_computer(session, "dyn_b", TableType.Dynamic).get_system_metrics()

    assert rows_affected(dyn_a, DmlOperationType.INSERT) == [2] * 20
    assert rows_affected(dyn_b, DmlOperationType.DELETE) == [4]
    assert len(session.scans("DYNAMIC_TABLE_REFRESH_HISTORY")) == 3
    assert session.history_rows_read[0] < len(session.dynamic_refreshes)
    assert all(result.closed for result in session.history_results)
    assert budget.used_bytes == 0


def test_older_batch_history_can_be_evicted_across_views(monkeypatch):
    budget = snowflake_system.HISTORY_MEMORY_BUDGET
    session = FakeSnowflakeSession(
        dynamic_refreshes=[(DATABASE, SCHEMA, "DYN_A", START, 1, 0) for _ in range(5)],
        query_history=[dml("1", "INSERT INTO PROD.FINANCE.ORDERS VALUES (1)", "INSERT", inserted=8)],
    )
    TABLE_BATCH_WINDOW.register([table_fqn("dyn_a"), table_fqn("orders")])
    make_computer(session, "dyn_a", TableType.Dynamic).get_system_metrics()
    assert budget.used_bytes > 0
    monkeypatch.setattr(budget, "max_bytes", budget.used_bytes + 1)
    TABLE_BATCH_WINDOW.register([table_fqn("orders")])

    profiles = make_computer(session, "orders").get_system_metrics()

    assert rows_affected(profiles, DmlOperationType.INSERT) == [8]
    assert DYNAMIC_TABLE_REFRESH_INDEX._indexes == {}
    assert len(QUERY_HISTORY_INDEX._indexes) == 1
    assert 0 < budget.used_bytes <= budget.max_bytes
    QUERY_HISTORY_INDEX.clear()
    assert budget.used_bytes == 0


def test_history_budget_is_reclaimed_when_old_batches_are_evicted():
    budget = snowflake_system.HISTORY_MEMORY_BUDGET
    session = FakeSnowflakeSession(
        query_history=[dml(str(i), f"INSERT INTO PROD.FINANCE.T{i} VALUES (1)", "INSERT", inserted=1) for i in range(3)]
    )
    sizes = []
    for i in range(3):
        TABLE_BATCH_WINDOW.register([table_fqn(f"t{i}")])
        make_computer(session, f"t{i}").get_inserts()
        sizes.append(budget.used_bytes)

    assert sizes[0] > 0
    assert sizes[1] > sizes[0]
    assert sizes[2] == sizes[1]
    QUERY_HISTORY_INDEX.clear()
    assert budget.used_bytes == 0


def test_failed_history_build_releases_its_reservation_and_closes_the_stream():
    budget = snowflake_system.HISTORY_MEMORY_BUDGET
    good = dml("1", "INSERT INTO PROD.FINANCE.ORDERS VALUES (1)", "INSERT", inserted=1)
    bad = dml("2", "INSERT INTO PROD.FINANCE.ORDERS VALUES (1)", None, inserted=1)
    session = FakeSnowflakeSession(query_history=[good, bad])
    batch = TABLE_BATCH_WINDOW.register([table_fqn("orders")])

    with pytest.raises(ValidationError):
        make_computer(session, "orders").get_inserts()

    assert budget.used_bytes == 0
    assert batch.batch_id not in QUERY_HISTORY_INDEX._indexes
    assert session.history_results[0].closed
    session.query_history = [good]
    assert [p.rowsAffected for p in make_computer(session, "orders").get_inserts()] == [1]


def test_zero_history_budget_uses_per_table_scans(monkeypatch):
    budget = snowflake_system.HISTORY_MEMORY_BUDGET
    monkeypatch.setattr(budget, "max_bytes", 0)
    session = FakeSnowflakeSession(
        query_history=[
            dml("1", "INSERT INTO PROD.FINANCE.ORDERS VALUES (1)", "INSERT", inserted=3),
        ]
    )
    TABLE_BATCH_WINDOW.register([table_fqn("orders"), table_fqn("customers")])

    orders = make_computer(session, "orders").get_system_metrics()
    customers = make_computer(session, "customers").get_system_metrics()

    assert rows_affected(orders, DmlOperationType.INSERT) == [3]
    assert customers == []
    assert len(session.query_history_scans) == 2
    assert budget.used_bytes == 0


def test_fallback_markers_remain_bounded(monkeypatch):
    monkeypatch.setattr(snowflake_system.HISTORY_MEMORY_BUDGET, "max_bytes", 0)
    session = FakeSnowflakeSession()
    for i in range(5):
        TABLE_BATCH_WINDOW.register([table_fqn(f"t{i}")])
        make_computer(session, f"t{i}").get_inserts()

    assert len(QUERY_HISTORY_INDEX._indexes) == 2
    assert all(index is None for index in QUERY_HISTORY_INDEX._indexes.values())


@pytest.mark.parametrize("limit", [0, 4096, 32 * 1024**2])
def test_history_budget_setting_accepts_environment_override(monkeypatch, limit):
    monkeypatch.setenv("OM_SNOWFLAKE_SYSTEM_METRICS_CACHE_MAX_BYTES", str(limit))

    assert SnowflakeSettings().system_metrics_cache_max_bytes == limit


def test_history_budget_setting_has_a_32_mib_default(monkeypatch):
    monkeypatch.delenv("OM_SNOWFLAKE_SYSTEM_METRICS_CACHE_MAX_BYTES", raising=False)

    assert SnowflakeSettings().system_metrics_cache_max_bytes == 32 * 1024**2


def test_history_budget_setting_rejects_a_negative_limit(monkeypatch):
    monkeypatch.setenv("OM_SNOWFLAKE_SYSTEM_METRICS_CACHE_MAX_BYTES", "-1")

    with pytest.raises(ValidationError):
        SnowflakeSettings()


@pytest.mark.parametrize("dynamic_first", [False, True])
def test_mixed_batch_preserves_the_other_views_history_and_falls_back(monkeypatch, dynamic_first):
    budget = snowflake_system.HISTORY_MEMORY_BUDGET
    session = FakeSnowflakeSession(
        query_history=[
            *[dml(str(i), "INSERT INTO PROD.FINANCE.ORDERS VALUES (1)", "INSERT", inserted=1) for i in range(4)],
            *[dml(str(i + 4), "UPDATE PROD.FINANCE.CUSTOMERS SET X = 1", "UPDATE", updated=2) for i in range(4)],
        ],
        dynamic_refreshes=[
            *[(DATABASE, SCHEMA, "DYN_A", START, 3, 0) for _ in range(3)],
            *[(DATABASE, SCHEMA, "DYN_B", START, 0, 4) for _ in range(3)],
        ],
    )
    batch = TABLE_BATCH_WINDOW.register([table_fqn(name) for name in ("orders", "customers", "dyn_a", "dyn_b")])
    make_computer(session, "orders").get_system_metrics()
    dml_bytes = budget.used_bytes
    QUERY_HISTORY_INDEX.clear()
    make_computer(session, "dyn_a", TableType.Dynamic).get_system_metrics()
    dynamic_bytes = budget.used_bytes
    DYNAMIC_TABLE_REFRESH_INDEX.clear()
    monkeypatch.setattr(
        budget, "max_bytes", max(dml_bytes, dynamic_bytes) + snowflake_system.HISTORY_INDEX_OVERHEAD_BYTES
    )
    assert dml_bytes + dynamic_bytes > budget.max_bytes
    session.statements.clear()

    regular_tables = [("orders", TableType.Regular), ("customers", TableType.Regular)]
    dynamic_tables = [("dyn_a", TableType.Dynamic), ("dyn_b", TableType.Dynamic)]
    first, second = (dynamic_tables, regular_tables) if dynamic_first else (regular_tables, dynamic_tables)
    profiles = {
        name: make_computer(session, name, table_type).get_system_metrics()
        for name, table_type in (first[0], second[0], first[1], second[1])
    }

    assert rows_affected(profiles["orders"], DmlOperationType.INSERT) == [1] * 4
    assert rows_affected(profiles["customers"], DmlOperationType.UPDATE) == [2] * 4
    assert rows_affected(profiles["dyn_a"], DmlOperationType.INSERT) == [3] * 3
    assert rows_affected(profiles["dyn_b"], DmlOperationType.DELETE) == [4] * 3
    assert len(session.scans("DYNAMIC_TABLE_REFRESH_HISTORY")) == (1 if dynamic_first else 3)
    assert len(session.query_history_scans) == (3 if dynamic_first else 1)
    cached, fallback = (
        (DYNAMIC_TABLE_REFRESH_INDEX, QUERY_HISTORY_INDEX)
        if dynamic_first
        else (QUERY_HISTORY_INDEX, DYNAMIC_TABLE_REFRESH_INDEX)
    )
    assert cached._indexes[batch.batch_id] is not None
    assert fallback._indexes[batch.batch_id] is None
    assert budget.used_bytes == (dynamic_bytes if dynamic_first else dml_bytes)
    assert all(result.closed for result in session.history_results)


def test_an_older_batch_cannot_evict_newer_history(monkeypatch):
    budget = snowflake_system.HISTORY_MEMORY_BUDGET
    session = FakeSnowflakeSession(
        dynamic_refreshes=[(DATABASE, SCHEMA, "DYN_A", START, 1, 0)],
        query_history=[dml("1", "INSERT INTO PROD.FINANCE.ORDERS VALUES (1)", "INSERT", inserted=8)],
    )
    older = TABLE_BATCH_WINDOW.register([table_fqn("orders")])
    newer = TABLE_BATCH_WINDOW.register([table_fqn("dyn_a")])
    make_computer(session, "dyn_a", TableType.Dynamic).get_system_metrics()
    retained_bytes = budget.used_bytes
    monkeypatch.setattr(budget, "max_bytes", retained_bytes + 1)

    profiles = make_computer(session, "orders").get_system_metrics()

    assert rows_affected(profiles, DmlOperationType.INSERT) == [8]
    assert DYNAMIC_TABLE_REFRESH_INDEX._indexes[newer.batch_id] is not None
    assert QUERY_HISTORY_INDEX._indexes[older.batch_id] is None
    assert budget.used_bytes == retained_bytes
