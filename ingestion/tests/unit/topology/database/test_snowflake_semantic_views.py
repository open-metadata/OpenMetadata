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

"""Unit tests for Snowflake semantic view ingestion (issue #23680)."""

from unittest.mock import Mock

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.ingestion.source.database.snowflake.utils import get_semantic_view_names


def test_semantic_view_table_type_exists():
    assert TableType.SemanticView.value == "SemanticView"


def test_include_semantic_views_defaults_to_false():
    field = SnowflakeConnection.model_fields["includeSemanticViews"]
    assert field.default is False


def test_get_semantic_view_names_maps_rows_to_semantic_view_type():
    # SHOW SEMANTIC VIEWS returns rows shaped (created_on, name, database, schema, ...)
    rows = [
        ("2026-01-01", "SALES_SEMANTIC", "DB", "PUBLIC"),
        ("2026-01-02", "ORDERS_SEMANTIC", "DB", "PUBLIC"),
    ]
    connection = Mock()
    connection.execute.return_value = iter(rows)

    dialect = Mock()
    # get_semantic_view_names(dialect, ...) binds `dialect` as `self`, so
    # `self.normalize_name(row[1])` calls this single-arg lambda with the name.
    dialect.normalize_name = lambda name: name

    result = get_semantic_view_names(dialect, connection, schema="PUBLIC")

    names = [t.name for t in result.tables]
    assert names == ["SALES_SEMANTIC", "ORDERS_SEMANTIC"]
    assert all(t.type_ == TableType.SemanticView for t in result.tables)
    assert all(t.deleted is None for t in result.tables)
