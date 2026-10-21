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
"""Unit tests for the Databend lineage source.

`system_history.lineage_history` and `system.views` are emulated with attached SQLite schemas, so
the real queries, their filters and the edge merging run end to end without a Databend license.
"""

import json
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from cachetools import LRUCache
from sqlalchemy import create_engine, event, text
from sqlalchemy.pool import StaticPool

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSourceType
from metadata.ingestion.api.status import Status
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.source.database.databend.lineage import (
    DatabendLineageSource,
    LineageEndpoint,
    explain_lineage_error,
    merge_lineage_rows,
)
from metadata.ingestion.source.database.databend.service_spec import ServiceSpec

SERVICE = "databend_svc"

TABLES = {
    ("sales", "orders"): ["order_id", "customer_id", "amount"],
    ("sales", "customers"): ["customer_id", "name", "region"],
    ("mart", "revenue"): ["customer_id", "name", "total"],
    ("mart", "v_revenue"): ["customer_id", "total"],
    ("mart", "v_const"): ["x"],
}


def _row(
    kind,
    source,
    target,
    *,
    columns=None,
    query_id="q1",
    sql="SQL",
    updated_on="2026-10-13 10:00:00",
    source_catalog="default",
    target_catalog="default",
    source_type="TABLE",
    target_type="TABLE",
):
    mappings = [
        {"sources": [{"name": name} for name in sources], "target": {"name": target_column}}
        for target_column, sources in (columns or {}).items()
    ]
    return {
        "lineage_kind": kind,
        "source_catalog": source_catalog,
        "source_object_type": source_type,
        "source_database": source[0],
        "source_name": source[1],
        "target_catalog": target_catalog,
        "target_object_type": target_type,
        "target_database": target[0],
        "target_name": target[1],
        "column_lineage": json.dumps({"mappings": mappings}),
        "query_info": json.dumps({"query_id": query_id, "query_text": sql}),
        "updated_on": updated_on,
    }


def _engine(rows, views):
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _attach(dbapi_connection, _):
        dbapi_connection.execute("ATTACH DATABASE ':memory:' AS system_history")
        dbapi_connection.execute("ATTACH DATABASE ':memory:' AS system")

    columns = list(_row("DML", ("a", "b"), ("c", "d")))
    with engine.begin() as connection:
        connection.execute(text(f"CREATE TABLE system_history.lineage_history ({', '.join(columns)})"))
        for row in rows:
            connection.execute(
                text(f"INSERT INTO system_history.lineage_history VALUES ({', '.join(':' + c for c in columns)})"),
                row,
            )
        connection.execute(text("CREATE TABLE system.views (catalog, database, name, updated_on)"))
        for (database, name), updated_on in views.items():
            connection.execute(
                text("INSERT INTO system.views VALUES ('default', :database, :name, :updated_on)"),
                {"database": database, "name": name, "updated_on": updated_on},
            )
    return engine


def _table(database, name):
    table_fqn = f"{SERVICE}.default.{database}.{name}"
    return Table(
        id="5f8a7d8e-1c2b-4a9e-8f00-000000000000",
        name=name,
        fullyQualifiedName=table_fqn,
        columns=[
            Column(name=column, dataType=DataType.STRING, fullyQualifiedName=f"{table_fqn}.{column}")
            for column in TABLES[(database, name)]
        ],
    )


def _source(rows, views=None, **source_config):
    """`views` maps (database, view) to the time the view was last created, as in system.views."""
    source = DatabendLineageSource.__new__(DatabendLineageSource)
    source.config = MagicMock(serviceName=SERVICE)
    source.source_config = DatabaseServiceQueryLineagePipeline.model_validate(source_config)
    source.engine = _engine(rows, views or {})
    source.status = Status()
    source.start = datetime(2026, 10, 13)
    source.end = datetime(2026, 10, 14)
    source._tables = LRUCache(maxsize=10)
    source._lineage_unavailable = False
    metadata = MagicMock()

    def get_by_name(entity, fqn, fields=None):
        _, _, database, name = fqn.split(".")
        return _table(database, name) if (database, name) in TABLES else None

    metadata.get_by_name.side_effect = get_by_name
    source.metadata = metadata
    return source


def _requests(results):
    assert all(result.left is None for result in results)
    return {
        (
            result.right.lineage_request.from_entity_fqn.split(".", 2)[2],
            result.right.lineage_request.to_entity_fqn.split(".", 2)[2],
        ): result.right
        for result in results
    }


def test_query_lineage_merges_records_into_one_edge_per_table_pair():
    rows = [
        _row("DML", ("sales", "orders"), ("mart", "revenue"), columns={"total": ["amount"]}, sql="old"),
        _row(
            "DML",
            ("sales", "orders"),
            ("mart", "revenue"),
            columns={"customer_id": ["customer_id"]},
            sql="new",
            updated_on="2026-10-13 11:00:00",
        ),
        _row("CTAS", ("sales", "customers"), ("mart", "revenue"), columns={"name": ["name"]}),
    ]
    requests = _requests(list(_source(rows).yield_query_lineage()))

    assert set(requests) == {("sales.orders", "mart.revenue"), ("sales.customers", "mart.revenue")}
    orders = requests[("sales.orders", "mart.revenue")]
    details = orders.lineage_request.lineage_details
    assert details.source == LineageSourceType.QueryLineage
    assert details.sqlQuery.root == "new"
    assert {(c.toColumn.root, tuple(f.root for f in c.fromColumns)) for c in details.columnsLineage} == {
        (f"{SERVICE}.default.mart.revenue.customer_id", (f"{SERVICE}.default.sales.orders.customer_id",)),
        (f"{SERVICE}.default.mart.revenue.total", (f"{SERVICE}.default.sales.orders.amount",)),
    }
    assert orders.override_lineage is False


@pytest.mark.parametrize(
    "row",
    [
        _row("DML", ("sales", "orders"), ("mart", "revenue"), source_catalog="iceberg"),
        _row("DML", ("sales", "orders"), ("mart", "revenue"), target_catalog="hive"),
        _row("DML", ("sales", "orders"), ("mart", "revenue"), source_type="STAGE"),
        _row("DML", ("sales", "orders"), ("mart", "revenue"), updated_on="2026-10-12 23:59:59"),
        _row("DML", ("sales", "orders"), ("sales", "orders")),
        _row("CREATE_VIEW", ("sales", "orders"), ("mart", "v_revenue"), target_type="VIEW"),
    ],
    ids=["external-source-catalog", "external-target-catalog", "stage", "before-window", "self-edge", "view"],
)
def test_query_lineage_skips_records_outside_scope(row):
    source = _source([row])

    assert list(source.yield_query_lineage()) == []
    assert source.status.filtered == []


def _view_row(source, target=("mart", "v_revenue"), **kwargs):
    return _row("CREATE_VIEW", source, target, target_type="VIEW", **kwargs)


def test_view_lineage_uses_only_records_of_the_current_definition():
    rows = [
        _view_row(("sales", "orders"), updated_on="2020-01-01 00:00:00"),
        _view_row(("mart", "revenue"), columns={"total": ["total"]}, updated_on="2020-01-01 00:00:02.010"),
    ]
    # View lineage is not bounded by the query log window.
    views = {("mart", "v_revenue"): "2020-01-01 00:00:02"}
    source = _source(rows, views, overrideViewLineage=True)
    requests = _requests(list(source.yield_view_lineage()))

    assert set(requests) == {("mart.revenue", "mart.v_revenue")}
    request = requests[("mart.revenue", "mart.v_revenue")]
    assert isinstance(request, OMetaLineageRequest)
    assert request.lineage_request.lineage_details.source == LineageSourceType.ViewLineage
    assert request.override_lineage is True
    assert request.entity_fqn == f"{SERVICE}.default.mart.v_revenue"
    source.metadata.delete_lineage_by_source_by_name.assert_not_called()


def test_view_lineage_does_not_override_unless_configured():
    rows = [_view_row(("mart", "revenue"))]
    views = {("mart", "v_revenue"): "2026-10-13 09:00:00"}
    request = _requests(list(_source(rows, views).yield_view_lineage()))[("mart.revenue", "mart.v_revenue")]

    assert request.override_lineage is False


def test_view_replaced_by_a_definition_without_upstreams_has_its_view_lineage_removed():
    # `CREATE OR REPLACE VIEW mart.v_const AS SELECT 1` writes no lineage and keeps the old record.
    rows = [_view_row(("sales", "orders"), ("mart", "v_const"), updated_on="2026-10-13 09:00:00")]
    views = {("mart", "v_const"): "2026-10-13 09:05:00"}
    source = _source(rows, views, overrideViewLineage=True)

    assert list(source.yield_view_lineage()) == []
    source.metadata.delete_lineage_by_source_by_name.assert_called_once_with(
        entity_type="table",
        entity_fqn=f"{SERVICE}.default.mart.v_const",
        source=LineageSourceType.ViewLineage.value,
    )


def test_replaced_view_lineage_is_kept_unless_override_is_configured():
    rows = [_view_row(("sales", "orders"), ("mart", "v_const"), updated_on="2026-10-13 09:00:00")]
    source = _source(rows, {("mart", "v_const"): "2026-10-13 09:05:00"})

    assert list(source.yield_view_lineage()) == []
    source.metadata.delete_lineage_by_source_by_name.assert_not_called()


def test_dropped_and_filtered_views_are_neither_emitted_nor_cleared():
    rows = [
        _view_row(("sales", "orders"), ("mart", "v_dropped")),
        _view_row(("sales", "orders"), ("mart", "v_const"), updated_on="2026-10-13 09:00:00"),
    ]
    views = {("mart", "v_const"): "2026-10-13 09:05:00"}
    source = _source(rows, views, overrideViewLineage=True, tableFilterPattern={"excludes": ["v_const"]})

    assert list(source.yield_view_lineage()) == []
    source.metadata.delete_lineage_by_source_by_name.assert_not_called()


@pytest.mark.parametrize(
    ("upstream", "source_config"),
    [
        (("sales", "orders"), {"tableFilterPattern": {"excludes": ["orders"]}}),
        (("sales", "staging"), {}),
    ],
    ids=["upstream-filtered-out", "upstream-not-ingested"],
)
def test_view_whose_current_upstreams_all_yield_no_request_has_its_view_lineage_removed(upstream, source_config):
    # `CREATE OR REPLACE VIEW mart.v_const AS SELECT * FROM <upstream>`: the record is current, but
    # no request is emitted, so override alone would keep the previous definition's upstreams.
    rows = [_view_row(upstream, ("mart", "v_const"), updated_on="2026-10-13 09:05:01")]
    views = {("mart", "v_const"): "2026-10-13 09:05:00"}
    source = _source(rows, views, overrideViewLineage=True, **source_config)

    assert _requests(list(source.yield_view_lineage())) == {}
    source.metadata.delete_lineage_by_source_by_name.assert_called_once_with(
        entity_type="table",
        entity_fqn=f"{SERVICE}.default.mart.v_const",
        source=LineageSourceType.ViewLineage.value,
    )


def test_view_with_one_emitted_upstream_is_overridden_not_cleared():
    rows = [
        _view_row(("sales", "orders"), updated_on="2026-10-13 09:05:01"),
        _view_row(("mart", "revenue"), updated_on="2026-10-13 09:05:01"),
    ]
    views = {("mart", "v_revenue"): "2026-10-13 09:05:00"}
    source = _source(rows, views, overrideViewLineage=True, tableFilterPattern={"excludes": ["orders"]})
    requests = _requests(list(source.yield_view_lineage()))

    assert set(requests) == {("mart.revenue", "mart.v_revenue")}
    assert requests[("mart.revenue", "mart.v_revenue")].override_lineage is True
    source.metadata.delete_lineage_by_source_by_name.assert_not_called()


def test_view_versions_are_looked_up_in_batches_per_database():
    views = {("mart", f"v_{index:02}"): "2026-10-13 09:00:00" for index in range(45)}
    views[("sales", "v_sales")] = "2026-10-13 09:00:00"
    source = _source([], views)
    statements = []
    event.listen(source.engine, "before_cursor_execute", lambda *args: statements.append(args[2]))

    with source.engine.connect() as connection:
        versions = source._get_view_versions(connection, [LineageEndpoint(*view) for view in views])

    assert set(versions) == {LineageEndpoint(*view) for view in views}
    assert all(version.tzinfo is not None for version in versions.values())
    # 45 views of mart in batches of 20, plus one query for sales.
    assert len(statements) == 4


def test_unreadable_system_views_reports_an_error_without_view_lineage():
    source = _source([_view_row(("mart", "revenue"))], overrideViewLineage=True)
    with source.engine.begin() as connection:
        connection.execute(text("DROP TABLE system.views"))

    results = list(source.yield_view_lineage())

    assert len(results) == 1
    assert "Cannot read view definitions from system.views" in results[0].left.error
    source.metadata.delete_lineage_by_source_by_name.assert_not_called()


def test_edges_with_endpoints_missing_from_openmetadata_are_skipped():
    rows = [
        _row("DML", ("sales", "unknown"), ("mart", "revenue")),
        _row("DML", ("sales", "orders"), ("mart", "revenue"), columns={"total": ["missing_column"]}),
    ]
    requests = _requests(list(_source(rows).yield_query_lineage()))

    assert set(requests) == {("sales.orders", "mart.revenue")}
    assert requests[("sales.orders", "mart.revenue")].lineage_request.lineage_details.columnsLineage is None


def test_filter_patterns_apply_to_both_endpoints():
    rows = [
        _row("DML", ("sales", "orders"), ("mart", "revenue")),
        _row("DML", ("sales", "customers"), ("mart", "revenue")),
    ]
    source = _source(rows, tableFilterPattern={"excludes": ["customers"]})
    requests = _requests(list(source.yield_query_lineage()))

    assert set(requests) == {("sales.orders", "mart.revenue")}
    assert [entry for entry in source.status.filtered if "customers" in next(iter(entry))]


def test_unreadable_lineage_history_is_reported_once_for_view_and_query_lineage():
    source = _source([])
    with source.engine.begin() as connection:
        connection.execute(text("DROP TABLE system_history.lineage_history"))

    results = list(source.yield_view_lineage()) + list(source.yield_query_lineage())

    assert len(results) == 1
    assert results[0].right is None
    assert "Cannot read system_history.lineage_history" in results[0].left.error


# Messages as raised by databend-sqlalchemy against Databend v1.2.949 and v1.2.930.
@pytest.mark.parametrize(
    ("message", "hint"),
    [
        ('QueryFailed: [1003]error: Unknown database "default"."system_history"', "[log.history] on = true"),
        ('QueryFailed: [1025]error: Unknown table "default"."system_history".lineage_history', "v1.2.933"),
        ("QueryFailed: [1063]Permission denied: privilege [Select] is required", "GRANT SELECT ON system_history"),
        ("QueryFailed: [1402][LicenseManager] Feature 'system_history' requires", "Enterprise license"),
        ("QueryFailed: [1001]something else", "v1.2.933 or later"),
    ],
    ids=["history-disabled", "lineage-disabled-or-old-version", "no-privilege", "no-license", "unknown"],
)
def test_lineage_errors_explain_the_missing_requirement(message, hint):
    assert hint in explain_lineage_error(Exception(message))


def test_merge_ignores_unparsable_variants():
    row = _row("DML", ("sales", "orders"), ("mart", "revenue"))
    row["column_lineage"] = "not json"
    row["query_info"] = None
    (edge,) = merge_lineage_rows([row])

    assert edge.columns == {}
    assert edge.sql is None


def test_service_spec_registers_lineage_source():
    assert ServiceSpec.lineage_source_class.endswith(".DatabendLineageSource")


def test_create_rejects_other_connection_types():
    config = {
        "type": "mysql",
        "serviceName": "mysql_svc",
        "serviceConnection": {"config": {"type": "Mysql", "username": "u", "hostPort": "localhost:3306"}},
        "sourceConfig": {"config": {"type": "DatabaseLineage"}},
    }
    metadata = MagicMock()
    with pytest.raises(InvalidSourceException):
        DatabendLineageSource.create(config, metadata)
