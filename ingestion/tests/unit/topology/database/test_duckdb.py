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
"""The DuckDB metadata source, run against a real database file."""

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from ingestion.tests.unit.source.database.duckdb._fixtures import DUCKDB_TEST_CONFIG, SHOP_DDL, create_database
from metadata.generated.schema.entity.data.table import Constraint, DataType, TableType
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.duckdb.lineage import DuckDBLineageSource
from metadata.ingestion.source.database.duckdb.metadata import DuckDBSource
from metadata.ingestion.source.database.duckdb.service_spec import ServiceSpec
from metadata.ingestion.source.database.duckdb.usage import DuckDBUsageSource


def source_config(path: Path, **connection) -> dict:
    return {
        "type": "duckdb",
        "serviceName": "local_duckdb",
        "serviceConnection": {
            "config": {
                "type": "DuckDB",
                "databaseFilePath": str(path),
                "connectionOptions": DUCKDB_TEST_CONFIG,
                **connection,
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }


def create_source(path: Path, **connection) -> DuckDBSource:
    source = DuckDBSource.create(source_config(path, **connection), MagicMock(spec=OpenMetadata))
    for key, value in (("database_service", "local_duckdb"), ("database", "shop"), ("database_schema", "main")):
        source.context.get().upsert(key, value)
    return source


@pytest.fixture
def shop_db(tmp_path: Path) -> Path:
    return create_database(tmp_path / "shop.duckdb", SHOP_DDL)


@pytest.fixture
def source(shop_db):
    return create_source(shop_db)


def columns_of(source: DuckDBSource, table: str) -> dict:
    columns, _, _ = source.get_columns_and_constraints("main", table, "shop", source.inspector)
    return {model_str(column.name): column for column in columns}


def _class_path(cls: type) -> str:
    return f"{cls.__module__}.{cls.__name__}"


def test_service_spec_registers_every_workflow():
    assert ServiceSpec.metadata_source_class == _class_path(DuckDBSource)
    assert ServiceSpec.lineage_source_class == _class_path(DuckDBLineageSource)
    assert ServiceSpec.usage_source_class == _class_path(DuckDBUsageSource)
    assert ServiceSpec.profiler_class is not None
    assert ServiceSpec.sampler_class is not None


def test_create_rejects_another_connection_type(shop_db):
    config = source_config(shop_db)
    config["serviceConnection"]["config"] = {"type": "SQLite", "databaseMode": ":memory:"}

    with pytest.raises(InvalidSourceException):
        DuckDBSource.create(config, MagicMock(spec=OpenMetadata))


def test_database_is_named_after_the_file(source):
    assert list(source.get_database_names()) == ["shop"]


def test_configured_database_name_wins(shop_db):
    assert list(create_source(shop_db, databaseName="sales").get_database_names()) == ["sales"]


def test_schemas_tables_and_views(source):
    assert list(source.get_raw_database_schema_names()) == ["analytics", "main"]
    assert [table.name for table in source.query_table_names_and_types("main")] == ["customers", "orders"]
    assert [(view.name, view.type_) for view in source.query_view_names_and_types("main")] == [
        ("customer_totals", TableType.View)
    ]


def test_table_description_and_view_definition(source):
    assert source.get_table_description("main", "customers", source.inspector) == "People who bought something"

    definition = source.get_schema_definition(TableType.View, "customer_totals", "main", source.inspector)
    assert definition.startswith("CREATE VIEW customer_totals AS")


def test_scalar_columns_keep_duckdb_types_for_display(source):
    columns = columns_of(source, "customers")

    assert columns["id"].dataType == DataType.BIGINT
    assert columns["balance"].dataType == DataType.DECIMAL
    assert (columns["balance"].precision, columns["balance"].scale) == (12, 2)
    assert columns["balance"].dataTypeDisplay == "DECIMAL(12,2)"
    assert (columns["visits"].dataType, columns["visits"].dataTypeDisplay) == (DataType.LARGEINT, "UBIGINT")
    assert columns["lifetime_value"].dataType == DataType.LARGEINT
    assert (columns["signed_up"].dataType, columns["signed_up"].dataTypeDisplay) == (
        DataType.TIMESTAMP,
        "TIMESTAMP_NS",
    )
    assert columns["updated_at"].dataType == DataType.TIMESTAMP
    assert columns["current_mood"].dataType == DataType.ENUM
    assert columns["contact"].dataType == DataType.UNION


def test_nested_columns_have_children(source):
    columns = columns_of(source, "customers")

    assert (columns["tags"].dataType, columns["tags"].arrayDataType) == (DataType.ARRAY, DataType.VARCHAR)
    assert (columns["last_three_scores"].dataType, columns["last_three_scores"].arrayDataType) == (
        DataType.ARRAY,
        DataType.INT,
    )
    assert columns["attributes"].dataType == DataType.MAP

    address = columns["address"]
    assert address.dataType == DataType.STRUCT
    assert [model_str(child.name) for child in address.children] == ["street", "zipcode", "geo"]
    assert [model_str(child.name) for child in address.children[2].children] == ["lat", "lon"]

    orders_summary = columns["orders_summary"]
    assert (orders_summary.dataType, orders_summary.arrayDataType) == (DataType.ARRAY, DataType.STRUCT)
    assert [(model_str(child.name), child.dataType) for child in orders_summary.children] == [
        ("order_id", DataType.BIGINT),
        ("total", DataType.DECIMAL),
    ]


def test_column_constraints_and_comments(source):
    customers = columns_of(source, "customers")
    orders = columns_of(source, "orders")

    assert customers["id"].constraint == Constraint.PRIMARY_KEY
    assert customers["email"].constraint == Constraint.UNIQUE
    assert model_str(customers["email"].description) == "Primary contact address"
    assert orders["total"].constraint == Constraint.NOT_NULL


def test_foreign_keys_point_at_the_referenced_table(source):
    _, _, foreign_keys = source.get_columns_and_constraints("main", "orders", "shop", source.inspector)

    assert [(fk["constrained_columns"], fk["referred_table"], fk["referred_columns"]) for fk in foreign_keys] == [
        (["customer_id"], "customers", ["id"])
    ]
