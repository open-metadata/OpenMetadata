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
Tests for CommonDbSourceService._prepare_foreign_constraints
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.table import (
    Column,
    ConstraintType,
    DataType,
    Table,
    TableConstraint,
)
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.database_service import DatabaseServiceSource


@pytest.fixture
def source():
    """Create a mock CommonDbSourceService with the minimal context needed."""
    mock_source = MagicMock()
    mock_source._prepare_foreign_constraints = (
        CommonDbSourceService._prepare_foreign_constraints.__get__(mock_source)
    )

    context = MagicMock()
    context.database_service = "test_service"
    context.database = "test_db"
    context.foreign_tables = []
    mock_source.context.get.return_value = context
    mock_source.context.get_global.return_value = context

    return mock_source


MOCK_COLUMNS = [
    Column(name="id", dataType=DataType.INT),
    Column(name="order_id", dataType=DataType.INT),
]


class TestPrepareForeignConstraintsReferredSchema:
    """Test referred_schema resolution in _prepare_foreign_constraints."""

    def test_explicit_referred_schema_used_for_cross_schema_fk(self, source):
        """When referred_schema is explicitly set (cross-schema FK),
        it should be used instead of the current schema."""
        mock_referred_table = MagicMock(spec=Table)
        mock_referred_table.columns = MOCK_COLUMNS
        source.metadata.get_by_name.return_value = mock_referred_table

        with patch(
            "metadata.ingestion.source.database.common_db_source.fqn._build",
            return_value="test_service.test_db.other_schema.orders.order_id",
        ), patch(
            "metadata.ingestion.source.database.common_db_source.get_relationship_type",
            return_value=None,
        ):
            result = source._prepare_foreign_constraints(
                supports_database=False,
                column={
                    "referred_schema": "other_schema",
                    "referred_table": "orders",
                    "referred_columns": ["order_id"],
                    "constrained_columns": ["order_id"],
                },
                table_name="line_items",
                schema_name="current_schema",
                db_name="test_db",
                columns=MOCK_COLUMNS,
            )

        source.metadata.get_by_name.assert_called_once_with(
            entity=Table,
            fqn="test_service.test_db.other_schema.orders",
        )
        assert result is not None
        assert result.constraintType == ConstraintType.FOREIGN_KEY

    def test_schema_name_fallback_when_referred_schema_is_none(self, source):
        """When referred_schema is None (same-schema FK, e.g. Snowflake),
        it should fall back to schema_name."""
        mock_referred_table = MagicMock(spec=Table)
        mock_referred_table.columns = MOCK_COLUMNS
        source.metadata.get_by_name.return_value = mock_referred_table

        with patch(
            "metadata.ingestion.source.database.common_db_source.fqn._build",
            return_value="test_service.test_db.public.orders.order_id",
        ), patch(
            "metadata.ingestion.source.database.common_db_source.get_relationship_type",
            return_value=None,
        ):
            result = source._prepare_foreign_constraints(
                supports_database=False,
                column={
                    "referred_schema": None,
                    "referred_table": "orders",
                    "referred_columns": ["order_id"],
                    "constrained_columns": ["order_id"],
                },
                table_name="line_items",
                schema_name="public",
                db_name="test_db",
                columns=MOCK_COLUMNS,
            )

        source.metadata.get_by_name.assert_called_once_with(
            entity=Table,
            fqn="test_service.test_db.public.orders",
        )
        assert result is not None
        assert result.constraintType == ConstraintType.FOREIGN_KEY

    def test_schema_name_fallback_when_referred_schema_is_empty_string(self, source):
        """When referred_schema is an empty string, it should fall back
        to schema_name."""
        mock_referred_table = MagicMock(spec=Table)
        mock_referred_table.columns = MOCK_COLUMNS
        source.metadata.get_by_name.return_value = mock_referred_table

        with patch(
            "metadata.ingestion.source.database.common_db_source.fqn._build",
            return_value="test_service.test_db.public.orders.order_id",
        ), patch(
            "metadata.ingestion.source.database.common_db_source.get_relationship_type",
            return_value=None,
        ):
            result = source._prepare_foreign_constraints(
                supports_database=False,
                column={
                    "referred_schema": "",
                    "referred_table": "orders",
                    "referred_columns": ["order_id"],
                    "constrained_columns": ["order_id"],
                },
                table_name="line_items",
                schema_name="public",
                db_name="test_db",
                columns=MOCK_COLUMNS,
            )

        source.metadata.get_by_name.assert_called_once_with(
            entity=Table,
            fqn="test_service.test_db.public.orders",
        )
        assert result is not None

    def test_supports_database_uses_referred_database(self, source):
        """When supports_database is True, the referred_database from
        the column dict should be used instead of the context database."""
        mock_referred_table = MagicMock(spec=Table)
        mock_referred_table.columns = MOCK_COLUMNS
        source.metadata.get_by_name.return_value = mock_referred_table

        with patch(
            "metadata.ingestion.source.database.common_db_source.fqn._build",
            return_value="test_service.other_db.public.orders.order_id",
        ), patch(
            "metadata.ingestion.source.database.common_db_source.get_relationship_type",
            return_value=None,
        ):
            result = source._prepare_foreign_constraints(
                supports_database=True,
                column={
                    "referred_schema": "public",
                    "referred_database": "other_db",
                    "referred_table": "orders",
                    "referred_columns": ["order_id"],
                    "constrained_columns": ["order_id"],
                },
                table_name="line_items",
                schema_name="public",
                db_name="test_db",
                columns=MOCK_COLUMNS,
            )

        source.metadata.get_by_name.assert_called_once_with(
            entity=Table,
            fqn="test_service.other_db.public.orders",
        )
        assert result is not None

    def test_referred_table_not_found_appends_to_global_foreign_tables(self, source):
        """When the referred table is not found in metadata, the FK should
        be added to global foreign_tables for deferred resolution."""
        source.metadata.get_by_name.return_value = None

        result = source._prepare_foreign_constraints(
            supports_database=False,
            column={
                "referred_schema": None,
                "referred_table": "orders",
                "referred_columns": ["order_id"],
                "constrained_columns": ["order_id"],
            },
            table_name="line_items",
            schema_name="public",
            db_name="test_db",
            columns=MOCK_COLUMNS,
        )

        assert result is None
        assert len(source.context.get_global.return_value.foreign_tables) == 1


class TestNormalizeTableConstraints:
    """Test DatabaseServiceSource.normalize_table_constraints."""

    def test_case_mismatch_is_normalized(self):
        """Constraint column names with different casing should be
        normalized to match actual column definitions."""
        columns = [
            Column(name="Entity_ID", dataType=DataType.INT),
            Column(name="Entity_Type", dataType=DataType.INT),
        ]
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.CLUSTER_KEY,
                columns=["Entity_id", "Entity_Type"],
            )
        ]
        result = DatabaseServiceSource.normalize_table_constraints(constraints, columns)
        assert result[0].columns == ["Entity_ID", "Entity_Type"]

    def test_all_lowercase_constraint_columns(self):
        """Fully lowercase constraint columns should resolve to actual casing."""
        columns = [
            Column(name="OrderID", dataType=DataType.INT),
            Column(name="CustomerName", dataType=DataType.STRING),
        ]
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.PRIMARY_KEY,
                columns=["orderid", "customername"],
            )
        ]
        result = DatabaseServiceSource.normalize_table_constraints(constraints, columns)
        assert result[0].columns == ["OrderID", "CustomerName"]

    def test_already_matching_columns_unchanged(self):
        """Columns that already match should pass through unchanged."""
        columns = [
            Column(name="id", dataType=DataType.INT),
            Column(name="name", dataType=DataType.STRING),
        ]
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.UNIQUE,
                columns=["id", "name"],
            )
        ]
        result = DatabaseServiceSource.normalize_table_constraints(constraints, columns)
        assert result[0].columns == ["id", "name"]

    def test_unmatched_columns_preserved(self):
        """Constraint columns not found in column definitions should be
        kept as-is (fallback)."""
        columns = [
            Column(name="id", dataType=DataType.INT),
        ]
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.CLUSTER_KEY,
                columns=["id", "missing_col"],
            )
        ]
        result = DatabaseServiceSource.normalize_table_constraints(constraints, columns)
        assert result[0].columns == ["id", "missing_col"]

    def test_empty_constraints_returns_empty(self):
        """Empty or None constraints should return an empty list."""
        columns = [Column(name="id", dataType=DataType.INT)]
        assert DatabaseServiceSource.normalize_table_constraints([], columns) == []
        assert DatabaseServiceSource.normalize_table_constraints(None, columns) == []

    def test_empty_columns_returns_constraints_unchanged(self):
        """Empty columns list should return constraints as-is."""
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.PRIMARY_KEY,
                columns=["id"],
            )
        ]
        result = DatabaseServiceSource.normalize_table_constraints(constraints, [])
        assert result[0].columns == ["id"]

    def test_multiple_constraints_normalized(self):
        """All constraints in the list should be normalized."""
        columns = [
            Column(name="Entity_ID", dataType=DataType.INT),
            Column(name="Created_At", dataType=DataType.DATETIME),
        ]
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.CLUSTER_KEY,
                columns=["entity_id"],
            ),
            TableConstraint(
                constraintType=ConstraintType.PRIMARY_KEY,
                columns=["ENTITY_ID"],
            ),
        ]
        result = DatabaseServiceSource.normalize_table_constraints(constraints, columns)
        assert result[0].columns == ["Entity_ID"]
        assert result[1].columns == ["Entity_ID"]

    def test_constraint_with_none_columns_skipped(self):
        """Constraints with None columns field should not cause errors."""
        columns = [Column(name="id", dataType=DataType.INT)]
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.CLUSTER_KEY,
                columns=None,
            ),
            TableConstraint(
                constraintType=ConstraintType.PRIMARY_KEY,
                columns=["ID"],
            ),
        ]
        result = DatabaseServiceSource.normalize_table_constraints(constraints, columns)
        assert result[0].columns is None
        assert result[1].columns == ["id"]
