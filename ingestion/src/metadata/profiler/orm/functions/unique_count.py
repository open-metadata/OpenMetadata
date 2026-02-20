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
Unique Count Metric functions
"""

from collections import defaultdict
from typing import Tuple

from sqlalchemy import NVARCHAR, TEXT, Column, case, func, literal_column, select
from sqlalchemy.sql import ColumnElement
from sqlalchemy.sql.selectable import CTE

from metadata.profiler.orm.converter.mssql.converter import cast_dict
from metadata.profiler.orm.functions.count import CountFn
from metadata.profiler.orm.registry import Dialects
from metadata.profiler.orm.types.custom_image import CustomImage


def _get_unique_count_expressions(
    col: Column, dialect: str
) -> Tuple[ColumnElement, ColumnElement]:
    """
    Get dialect-specific expressions for unique count computation.

    This centralizes all dialect-specific logic for counting unique values,
    used by both non-dimensional queries and dimensional CTEs.

    Args:
        col: Column to compute unique count for
        dialect: Database dialect name (from session.bind.dialect.name)

    Returns:
        (group_by_expr, count_expr): Tuple of expressions to use in GROUP BY and COUNT()

    Examples:
        - Default: (col, col)
        - MSSQL deprecated types: (func.convert(..., col), CountFn(col))
        - Oracle: (CountFn(col), CountFn(col))
    """
    if dialect == Dialects.MSSQL:
        # The ntext, text, and image data types will be removed in a future version of SQL Server.
        # Avoid using these data types in new development work, and plan to modify applications that currently use them.
        # Use nvarchar(max), varchar(max), and varbinary(max) instead.
        # ref:https://learn.microsoft.com/en-us/sql/t-sql/data-types/ntext-text-and-image-transact-sql?view=sql-server-ver16
        is_mssql_deprecated_datatype = isinstance(
            col.type, (CustomImage, TEXT, NVARCHAR)
        )
        if is_mssql_deprecated_datatype:
            count_expr = CountFn(col)
            group_by_expr = func.convert(
                literal_column(cast_dict.get(type(col.type))), col
            )
            return group_by_expr, count_expr
        else:
            return col, col
    elif dialect == Dialects.Oracle:
        count_fn = CountFn(col)
        return count_fn, count_fn
    else:
        return col, col


# ============================================================================
# Non-dimensional unique count (existing functionality)
# ============================================================================


def _unique_count_query(col, session, sample):
    """
    Build unique count query for non-dimensional case.

    Uses dialect-agnostic logic via _get_unique_count_expressions().
    """
    group_by_expr, count_expr = _get_unique_count_expressions(
        col, session.bind.dialect.name
    )

    return (
        session.query(func.count(count_expr))
        .select_from(sample)
        .group_by(group_by_expr)
        .having(func.count(count_expr) == 1)
    )


def _unique_count_query_mssql(col, session, sample):
    """MSSQL: Use common expression logic"""
    return _unique_count_query(col, session, sample)


def _unique_count_query_oracle(col, session, sample):
    """Oracle: Use common expression logic"""
    return _unique_count_query(col, session, sample)


_unique_count_query_mapper = defaultdict(lambda: _unique_count_query)
_unique_count_query_mapper[Dialects.MSSQL] = _unique_count_query_mssql
_unique_count_query_mapper[Dialects.Oracle] = _unique_count_query_oracle


# ============================================================================
# Dimensional unique count (new functionality for validators)
# ============================================================================


def _unique_count_dimensional_cte(
    col: Column, table, dimension_col: Column, dialect: str
) -> Tuple[CTE, ColumnElement]:
    """
    Build CTE for dimensional unique count validation.

    Uses the same dialect-specific logic as non-dimensional queries via
    _get_unique_count_expressions(), but builds a CTE structure suitable
    for dimensional aggregation.

    Args:
        col: Column to count unique values for
        table: Table to query from
        dimension_col: Dimension column to group by
        dialect: Database dialect name

    Returns:
        (value_counts_cte, unique_count_expr):
            - value_counts_cte: CTE with (dimension, value, occurrence_count)
            - unique_count_expr: Expression to count values with occurrence_count=1
    """
    group_by_expr, count_expr = _get_unique_count_expressions(col, dialect)

    # CTE: Count occurrences of each (dimension, value) pair
    # Also include row_count (COUNT(*)) to track actual row count for impact scoring
    value_counts = (
        select(
            dimension_col.label("dim_value"),
            group_by_expr.label("col_value"),
            func.count(count_expr).label("occurrence_count"),
            func.count().label(
                "row_count"
            ),  # Total rows for this (dimension, value) pair
        )
        .select_from(table)
        .group_by(dimension_col, group_by_expr)
    ).cte("value_counts")

    # Expression: Count values appearing exactly once per dimension
    unique_count_expr = func.sum(
        case((value_counts.c.occurrence_count == 1, 1), else_=0)
    )

    return value_counts, unique_count_expr


# No mapper needed - all dialects use the same function with internal branching
