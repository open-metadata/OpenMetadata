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
Tests for SqlColumnHandlerMixin._filter_invalid_constraints.

Fixes https://github.com/open-metadata/OpenMetadata/issues/26198
Redshift AUTO-distribution materialized views expose hidden system
columns (e.g. a_oid, b_oid) that produce DIST_KEY constraints
referencing columns absent from the processed column list.
"""

from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    ConstraintType,
    DataType,
    TableConstraint,
)
from metadata.ingestion.source.database.sql_column_handler import SqlColumnHandlerMixin


def _column(name: str) -> Column:
    return Column(
        name=ColumnName(root=name),
        dataType=DataType.VARCHAR,
    )


class TestFilterInvalidConstraints:
    def test_keeps_valid_constraints(self):
        columns = [_column("col1"), _column("col2")]
        constraints = [
            TableConstraint(constraintType=ConstraintType.PRIMARY_KEY, columns=["col1"]),
            TableConstraint(constraintType=ConstraintType.UNIQUE, columns=["col1", "col2"]),
        ]

        result = SqlColumnHandlerMixin._filter_invalid_constraints(columns, constraints)

        assert len(result) == 2
        assert result[0].constraintType == ConstraintType.PRIMARY_KEY
        assert result[1].constraintType == ConstraintType.UNIQUE

    def test_removes_constraint_with_missing_column(self):
        columns = [_column("col1"), _column("col2")]
        constraints = [
            TableConstraint(constraintType=ConstraintType.PRIMARY_KEY, columns=["col1"]),
            TableConstraint(constraintType=ConstraintType.DIST_KEY, columns=["a_oid"]),
        ]

        result = SqlColumnHandlerMixin._filter_invalid_constraints(columns, constraints)

        assert len(result) == 1
        assert result[0].constraintType == ConstraintType.PRIMARY_KEY

    def test_removes_constraint_with_partial_missing_columns(self):
        columns = [_column("col1"), _column("col2")]
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.SORT_KEY,
                columns=["col1", "hidden_col"],
            ),
        ]

        result = SqlColumnHandlerMixin._filter_invalid_constraints(columns, constraints)

        assert len(result) == 0

    def test_filters_constraint_with_no_columns(self):
        columns = [_column("col1")]
        constraints = [
            TableConstraint(constraintType=ConstraintType.UNIQUE, columns=None),
        ]

        result = SqlColumnHandlerMixin._filter_invalid_constraints(columns, constraints)

        assert len(result) == 0

    def test_empty_constraints(self):
        columns = [_column("col1")]

        result = SqlColumnHandlerMixin._filter_invalid_constraints(columns, [])

        assert result == []

    def test_empty_columns_filters_all(self):
        constraints = [
            TableConstraint(constraintType=ConstraintType.DIST_KEY, columns=["a_oid"]),
            TableConstraint(constraintType=ConstraintType.SORT_KEY, columns=["b_oid"]),
        ]

        result = SqlColumnHandlerMixin._filter_invalid_constraints([], constraints)

        assert len(result) == 0

    def test_redshift_auto_dist_scenario(self):
        """Simulate the exact scenario from issue #26198:
        Materialized view with AUTO distribution creates hidden columns
        a_oid and b_oid with distkey=True, but these columns fail to
        process into Column objects.
        """
        columns = [_column("col1"), _column("col2"), _column("col3")]
        constraints = [
            TableConstraint(constraintType=ConstraintType.PRIMARY_KEY, columns=["col1"]),
            TableConstraint(constraintType=ConstraintType.DIST_KEY, columns=["a_oid"]),
            TableConstraint(constraintType=ConstraintType.DIST_KEY, columns=["b_oid"]),
            TableConstraint(constraintType=ConstraintType.SORT_KEY, columns=["col2"]),
        ]

        result = SqlColumnHandlerMixin._filter_invalid_constraints(columns, constraints)

        assert len(result) == 2
        assert result[0].constraintType == ConstraintType.PRIMARY_KEY
        assert result[0].columns == ["col1"]
        assert result[1].constraintType == ConstraintType.SORT_KEY
        assert result[1].columns == ["col2"]

    def test_none_table_constraints_returns_empty(self):
        columns = [_column("col1")]

        result = SqlColumnHandlerMixin._filter_invalid_constraints(columns, None)

        assert result == []

    def test_none_table_columns_returns_empty(self):
        constraints = [
            TableConstraint(constraintType=ConstraintType.PRIMARY_KEY, columns=["col1"]),
        ]

        result = SqlColumnHandlerMixin._filter_invalid_constraints(None, constraints)

        assert result == []

    def test_none_constraint_in_list_is_skipped(self):
        columns = [_column("col1")]
        constraints = [
            TableConstraint(constraintType=ConstraintType.PRIMARY_KEY, columns=["col1"]),
            None,
        ]

        result = SqlColumnHandlerMixin._filter_invalid_constraints(columns, constraints)

        assert len(result) == 1
        assert result[0].constraintType == ConstraintType.PRIMARY_KEY

    def test_case_insensitive_matching(self):
        """Constraint column names with different casing should still be
        kept.  Some connectors (e.g. BigQuery) return constraint column
        names in a different case than the processed column definitions.
        """
        columns = [_column("column_a"), _column("column_b")]
        constraints = [
            TableConstraint(
                constraintType=ConstraintType.PRIMARY_KEY,
                columns=["COLUMN_A"],
            ),
            TableConstraint(
                constraintType=ConstraintType.UNIQUE,
                columns=["Column_A", "Column_B"],
            ),
        ]

        result = SqlColumnHandlerMixin._filter_invalid_constraints(columns, constraints)

        assert len(result) == 2
