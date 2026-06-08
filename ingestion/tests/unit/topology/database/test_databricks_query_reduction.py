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
Tests for the Databricks query-reduction fixes: table-type detection and the
table-comment result cache must not issue a DESCRIBE per table.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock, Mock

from metadata.ingestion.source.database.databricks.metadata import (
    DatabricksSource,
    _fetch_table_describe_json,
    _json_type_to_sql_string,
    get_columns,
    get_table_type,
    get_view_definition,
)
from metadata.ingestion.source.database.databricks.models import (
    DescribeJsonColumn,
    DescribeJsonField,
    DescribeJsonPayload,
    DescribeJsonType,
)

_METADATA = "metadata.ingestion.source.database.databricks.metadata"


def test_get_table_type_uses_one_bulk_query_per_schema():
    """All tables in a schema resolve their type from a single
    information_schema.tables query, not a DESCRIBE per table."""
    dialect = SimpleNamespace()
    connection = Mock()
    connection.info = {}
    connection.execute.return_value = [
        ("orders", "MANAGED"),
        ("customers", "EXTERNAL"),
        ("legacy_feed", "FOREIGN"),
    ]

    assert get_table_type(dialect, connection, "main_prod", "sales", "orders") == "MANAGED"
    assert get_table_type(dialect, connection, "main_prod", "sales", "customers") == "EXTERNAL"
    assert get_table_type(dialect, connection, "main_prod", "sales", "legacy_feed") == "FOREIGN"

    assert connection.execute.call_count == 1


def test_get_table_type_refetches_for_a_different_schema():
    """The bulk table-type lookup is cached per (catalog, schema)."""
    dialect = SimpleNamespace()
    connection = Mock()
    connection.info = {}
    connection.execute.side_effect = [
        [("orders", "MANAGED")],
        [("events", "MANAGED")],
    ]

    assert get_table_type(dialect, connection, "main_prod", "sales", "orders") == "MANAGED"
    assert get_table_type(dialect, connection, "main_prod", "analytics", "events") == "MANAGED"

    assert connection.execute.call_count == 2


def test_get_table_type_falls_back_to_describe_when_bulk_query_fails(monkeypatch):
    """When information_schema.tables is unavailable (older deployments) the
    connector still resolves the type via a per-table DESCRIBE."""
    dialect = SimpleNamespace()
    connection = Mock()
    connection.info = {}
    connection.execute.side_effect = Exception("information_schema not available")

    describe_calls = []

    def fake_get_table_comment_result(self, connection, query, database, table_name, schema=None):
        describe_calls.append(table_name)
        return [{"col_name": "Type", "data_type": "MANAGED"}]

    monkeypatch.setattr(
        "metadata.ingestion.source.database.databricks.metadata.get_table_comment_result",
        fake_get_table_comment_result,
    )

    assert get_table_type(dialect, connection, "main_prod", "sales", "orders") == "MANAGED"
    assert describe_calls == ["orders"]


def test_get_view_definition_uses_as_json_payload(monkeypatch):
    """When AS JSON is available the view definition comes straight from the
    cached payload — no SHOW SCHEMAS, no INFORMATION_SCHEMA.VIEWS query."""
    monkeypatch.setattr(
        f"{_METADATA}._fetch_table_describe_json",
        lambda self, connection, db, schema, table: DescribeJsonPayload(view_text="SELECT 1"),
    )
    dialect = SimpleNamespace()
    connection = Mock()
    connection.engine.url.database = "main_prod"

    assert get_view_definition(dialect, connection, "v1", "sales") == "SELECT 1"
    connection.execute.assert_not_called()


def test_get_view_definition_falls_back_when_as_json_unsupported(monkeypatch):
    """DBR < 16.2: AS JSON returns None, so the legacy SHOW SCHEMAS +
    INFORMATION_SCHEMA.VIEWS path runs — SHOW SCHEMAS still cached per catalog."""
    monkeypatch.setattr(
        f"{_METADATA}._fetch_table_describe_json",
        lambda self, connection, db, schema, table: None,
    )
    monkeypatch.setattr(
        f"{_METADATA}.get_view_definition_wrapper",
        lambda *args, **kwargs: "view-sql",
    )
    dialect = SimpleNamespace()
    connection = Mock()
    connection.engine.url.database = "main_prod"
    connection.execute.return_value = [("information_schema",), ("sales",)]

    assert get_view_definition(dialect, connection, "v1", "sales") == "view-sql"
    assert get_view_definition(dialect, connection, "v2", "sales") == "view-sql"

    assert connection.execute.call_count == 1


def test_get_view_definition_handles_engine_url_without_catalog(monkeypatch):
    """Databricks does not always carry the catalog on the engine URL; the legacy
    path must still initialize cleanly instead of raising AttributeError on
    `_has_information_schema`."""
    monkeypatch.setattr(
        f"{_METADATA}.get_view_definition_wrapper",
        lambda *args, **kwargs: "view-sql",
    )
    dialect = SimpleNamespace()
    connection = Mock()
    connection.engine.url.database = None
    connection.execute.return_value = [("information_schema",), ("sales",)]

    assert get_view_definition(dialect, connection, "routine_privileges", "information_schema") == "view-sql"


def test_get_database_names_raw_materializes_catalog_cursor():
    """The catalog cursor is consumed eagerly (.fetchall) so set_inspector can
    dispose the engine between catalogs without breaking the producer's iteration."""
    fake_self = SimpleNamespace(is_older_version=False)
    cursor = Mock()
    cursor.fetchall.return_value = [("main_prod",), ("datamesh_prod",), ("cdcetl_prod",)]
    fake_self.connection = Mock()
    fake_self.connection.execute.return_value = cursor

    result = list(DatabricksSource.get_database_names_raw(fake_self))

    assert result == ["main_prod", "datamesh_prod", "cdcetl_prod"]
    cursor.fetchall.assert_called_once()


# ── DESCRIBE TABLE EXTENDED ... AS JSON (Databricks Runtime 16.2+) ──────────


def test_json_type_to_sql_string_primitives_and_normalisation():
    assert _json_type_to_sql_string(DescribeJsonType(name="int")) == "int"
    assert _json_type_to_sql_string(DescribeJsonType(name="string")) == "string"
    # timestamp_ltz/ntz must normalise to the name the legacy _type_map knows.
    assert _json_type_to_sql_string(DescribeJsonType(name="timestamp_ltz")) == "timestamp"
    assert _json_type_to_sql_string(DescribeJsonType(name="timestamp_ntz")) == "timestamp"
    assert _json_type_to_sql_string(None) == ""
    assert _json_type_to_sql_string(DescribeJsonType()) == ""


def test_json_type_to_sql_string_decimal_and_varchar():
    assert _json_type_to_sql_string(DescribeJsonType(name="decimal", precision=10, scale=2)) == "decimal(10,2)"
    assert _json_type_to_sql_string(DescribeJsonType(name="decimal", precision=10)) == "decimal(10)"
    assert _json_type_to_sql_string(DescribeJsonType(name="decimal")) == "decimal"
    assert _json_type_to_sql_string(DescribeJsonType(name="varchar", length=50)) == "varchar(50)"
    assert _json_type_to_sql_string(DescribeJsonType(name="char", length=10)) == "char(10)"


def test_json_type_to_sql_string_complex_types():
    struct = DescribeJsonType(
        name="struct",
        fields=[
            DescribeJsonField(name="a", type=DescribeJsonType(name="int")),
            DescribeJsonField(name="b", type=DescribeJsonType(name="string")),
        ],
    )
    assert _json_type_to_sql_string(struct) == "struct<a:int,b:string>"
    assert (
        _json_type_to_sql_string(DescribeJsonType(name="array", element_type=DescribeJsonType(name="bigint")))
        == "array<bigint>"
    )
    assert (
        _json_type_to_sql_string(
            DescribeJsonType(
                name="map",
                key_type=DescribeJsonType(name="string"),
                value_type=DescribeJsonType(name="int"),
            )
        )
        == "map<string,int>"
    )
    assert (
        _json_type_to_sql_string(DescribeJsonType(name="array", element_type=struct)) == "array<struct<a:int,b:string>>"
    )


def test_json_type_to_sql_string_returns_empty_for_unusable_complex_types():
    """An array/map whose inner type is missing can't be rendered as a valid type;
    return "" so the caller skips the column instead of emitting array<> / map<,>."""
    assert _json_type_to_sql_string(DescribeJsonType(name="array")) == ""
    assert _json_type_to_sql_string(DescribeJsonType(name="array", element_type=DescribeJsonType())) == ""
    assert _json_type_to_sql_string(DescribeJsonType(name="map", key_type=DescribeJsonType(name="string"))) == ""
    assert _json_type_to_sql_string(DescribeJsonType(name="map", value_type=DescribeJsonType(name="int"))) == ""


def test_fetch_table_describe_json_parses_and_caches():
    dialect = SimpleNamespace()
    connection = Mock()
    connection.info = {}
    connection.execute.return_value.fetchone.return_value = (
        '{"comment": "t", "owner": "o", "columns": [{"name": "c", "type": {"name": "int"}}]}',
    )

    payload = _fetch_table_describe_json(dialect, connection, "db", "sch", "tbl")

    assert payload is not None
    assert payload.comment == "t"
    assert payload.owner == "o"
    assert payload.columns[0].name == "c"
    assert connection.info["databricks_describe_json_supported"] is True
    # Cached — a second lookup does not re-query.
    _fetch_table_describe_json(dialect, connection, "db", "sch", "tbl")
    assert connection.execute.call_count == 1


def test_fetch_table_describe_json_disables_after_query_error():
    """DBR < 16.2: the AS JSON query errors, so the per-connection flag flips and
    later tables on that connection skip the query entirely."""
    dialect = SimpleNamespace()
    connection = Mock()
    connection.info = {}
    connection.execute.side_effect = Exception("[PARSE_SYNTAX_ERROR] near 'AS JSON'")

    assert _fetch_table_describe_json(dialect, connection, "db", "sch", "t1") is None
    assert connection.info["databricks_describe_json_supported"] is False
    # A second table must not even attempt the query.
    assert _fetch_table_describe_json(dialect, connection, "db", "sch", "t2") is None
    assert connection.execute.call_count == 1


def test_fetch_table_describe_json_none_on_unparseable_payload():
    """Supported runtime, bad payload for one table — None for that table only;
    AS JSON stays enabled for the rest of the run."""
    dialect = SimpleNamespace()
    connection = Mock()
    connection.info = {}
    connection.execute.return_value.fetchone.return_value = ("not json {",)

    assert _fetch_table_describe_json(dialect, connection, "db", "sch", "tbl") is None
    assert connection.info["databricks_describe_json_supported"] is True


def test_fetch_table_describe_json_skips_without_db_or_schema():
    connection = Mock()
    connection.info = {}

    assert _fetch_table_describe_json(SimpleNamespace(), connection, None, "sch", "tbl") is None
    assert _fetch_table_describe_json(SimpleNamespace(), connection, "db", None, "tbl") is None
    connection.execute.assert_not_called()


def test_get_columns_builds_from_as_json_payload(monkeypatch):
    payload = DescribeJsonPayload(
        columns=[
            DescribeJsonColumn(name="id", type=DescribeJsonType(name="bigint"), comment="pk"),
            DescribeJsonColumn(name="amount", type=DescribeJsonType(name="decimal", precision=10, scale=2)),
            DescribeJsonColumn(
                name="info",
                type=DescribeJsonType(
                    name="struct",
                    fields=[DescribeJsonField(name="x", type=DescribeJsonType(name="string"), comment="x desc")],
                ),
            ),
        ]
    )
    monkeypatch.setattr(f"{_METADATA}._fetch_table_describe_json", lambda *args, **kwargs: payload)

    cols = get_columns(SimpleNamespace(), Mock(), "tbl", "sch", db_name="db")

    assert [c["name"] for c in cols] == ["id", "amount", "info"]
    assert cols[0]["comment"] == "pk"
    assert cols[0]["ordinal_position"] == 0
    assert cols[1]["system_data_type"] == "decimal(10,2)"
    assert cols[2]["is_complex"] is True
    assert cols[2]["nested_descriptions"] == {("x",): "x desc"}


def test_get_columns_falls_back_to_legacy_when_as_json_unsupported(monkeypatch):
    """DBR < 16.2: _fetch_table_describe_json returns None, so get_columns uses
    the legacy text-DESCRIBE path unchanged."""
    monkeypatch.setattr(f"{_METADATA}._fetch_table_describe_json", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        f"{_METADATA}._get_column_rows",
        lambda *args, **kwargs: [("id", "bigint", "pk"), ("name", "string", None)],
    )

    cols = get_columns(SimpleNamespace(), Mock(), "tbl", "sch", db_name="db")

    assert [c["name"] for c in cols] == ["id", "name"]
    assert cols[0]["comment"] == "pk"
    assert cols[0]["system_data_type"] == "bigint"


def test_get_table_description_uses_as_json_payload(monkeypatch):
    monkeypatch.setattr(
        f"{_METADATA}._fetch_table_describe_json",
        lambda *args, **kwargs: DescribeJsonPayload(comment="my table", location="s3://bucket/path"),
    )
    source = MagicMock()
    source.context.get().database = "db"
    source.external_location_map = {}

    result = DatabricksSource.get_table_description(source, "sch", "tbl", MagicMock())

    assert result == "my table"
    assert source.external_location_map[("db", "sch", "tbl")] == "s3://bucket/path"


def test_get_table_description_filters_dbfs_location(monkeypatch):
    monkeypatch.setattr(
        f"{_METADATA}._fetch_table_describe_json",
        lambda *args, **kwargs: DescribeJsonPayload(comment=None, location="dbfs:/internal/path"),
    )
    source = MagicMock()
    source.context.get().database = "db"
    source.external_location_map = {}

    DatabricksSource.get_table_description(source, "sch", "tbl", MagicMock())

    assert source.external_location_map[("db", "sch", "tbl")] is None


def test_get_owner_ref_uses_as_json_payload(monkeypatch):
    monkeypatch.setattr(
        f"{_METADATA}._fetch_table_describe_json",
        lambda *args, **kwargs: DescribeJsonPayload(owner="data_team"),
    )
    source = MagicMock()
    source.context.get().database = "db"
    source.context.get().database_schema = "sch"
    source._filter_owner_name = DatabricksSource._filter_owner_name.__get__(source)
    source.owner_resolver = Mock()

    DatabricksSource.get_owner_ref(source, "tbl")

    source.owner_resolver.get_owner_ref.assert_called_once_with("data_team")


def test_fetch_table_describe_json_cache_is_size_one():
    """The payload cache holds only the current table — once processing moves on,
    the previous table's payload is evicted, never accumulated for the run."""
    dialect = SimpleNamespace()
    connection = Mock()
    connection.info = {}
    connection.execute.return_value.fetchone.return_value = ('{"comment": "c"}',)

    _fetch_table_describe_json(dialect, connection, "db", "sch", "t1")
    _fetch_table_describe_json(dialect, connection, "db", "sch", "t2")
    _fetch_table_describe_json(dialect, connection, "db", "sch", "t1")

    # t1 was evicted by t2, so the third lookup re-queries.
    assert connection.execute.call_count == 3
    assert list(connection.info["databricks_describe_json"]) == [("db", "sch", "t1")]


def test_get_table_type_cache_is_bounded_to_current_schema():
    """The bulk table-type map is held only for the current schema — moving to a
    new schema evicts the previous one rather than accumulating per catalog."""
    dialect = SimpleNamespace()
    connection = Mock()
    connection.info = {}
    connection.execute.side_effect = [
        [("orders", "MANAGED")],
        [("events", "MANAGED")],
        [("orders", "MANAGED")],
    ]

    get_table_type(dialect, connection, "main_prod", "sales", "orders")
    get_table_type(dialect, connection, "main_prod", "analytics", "events")
    get_table_type(dialect, connection, "main_prod", "sales", "orders")

    # 'sales' was evicted by 'analytics', so the third lookup re-queries.
    assert connection.execute.call_count == 3
    assert list(connection.info["databricks_table_types"]) == [("main_prod", "sales")]
