#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
sqlalchemy utility functions
"""

import traceback
from typing import Any, Dict, List, Optional, Tuple, Union

import sqlalchemy
from sqlalchemy import Column, and_, func, or_
from sqlalchemy.orm import DeclarativeMeta, Query
from sqlalchemy.orm.util import AliasedClass
from sqlalchemy.sql.elements import BinaryExpression
from sqlalchemy.sql.expression import TextClause
from sqlalchemy.sql.sqltypes import ARRAY, String

from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.profiler.orm.functions.datetime import (
    DateAddFn,
    DatetimeAddFn,
    TimestampAddFn,
)
from metadata.utils.logger import query_runner_logger

logger = query_runner_logger()


# pylint: disable=cell-var-from-loop
def build_query_filter(
    filters: List[Tuple[Column, str, Any]], or_filter: bool = False
) -> Optional[BinaryExpression]:
    """Dynamically build query filter

    Args:
        filters (List[Tuple[Column, str, Any]]): list of tuples representing filters.
            The first value is the column, the second the comparison operators (e.g. "ge", "lt", "eq", "in", etc.) and
            the last value the comparison value. e.g. (Column("foo"), "ge", 1) will produce "foo >= 1".
        or_filter (bool, optional): whether to perform an OR or AND condition. Defaults to False (i.e. AND).

    Returns:
        BinaryExpression: a filter pattern
    """
    list_of_filters = []
    for filter_ in filters:
        column, operator, value = filter_
        try:
            filter_attr = (
                next(
                    filter(
                        lambda x: hasattr(column, x % operator), ["%s", "%s_", "__%s__"]
                    ),
                    None,
                )
                % operator
            )  # type: ignore
        except TypeError as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error when looking for operator {operator} - {err}")
        else:
            list_of_filters.append(getattr(column, filter_attr)(value))

    if not list_of_filters:
        logger.debug("No filters found.")
        return None

    if or_filter:
        return or_(*list_of_filters)
    return and_(*list_of_filters)


def get_integer_range_filter(
    partition_field, integer_range_start, integer_range_end
) -> Optional[BinaryExpression]:
    """Get the query filter for integer range

    Args:
        partition_field (str): partition field
        integer_range_start (int): integer range start
        integer_range_end (int): integer range end

    Returns:
        Optional[BinaryExpression]
    """
    return build_query_filter(
        [
            (
                partition_field,
                "ge",
                integer_range_start,
            ),
            (
                partition_field,
                "le",
                integer_range_end,
            ),
        ],
        False,
    )


def get_value_filter(partition_field, values) -> Optional[BinaryExpression]:
    """Get the query filter for values

    Args:
        partition_field (str): partition field
        values (list): list of values to partition by

    Returns:
        Optional[BinaryExpression]
    """
    return build_query_filter(
        [
            (
                partition_field,
                "in",
                values,
            )
        ],
        False,
    )


def dispatch_to_date_or_datetime(
    partition_interval: int,
    partition_interval_unit: TextClause,
    type_,
):
    """Dispatch to date or datetime function based on the type

    Args:
        partition_field (_type_): _description_
        partition_interval (_type_): _description_
        partition_interval_unit (_type_): _description_
    """
    if isinstance(type_, (sqlalchemy.DATE)):
        return DateAddFn(partition_interval, partition_interval_unit)
    if isinstance(type_, sqlalchemy.DATETIME):
        return DatetimeAddFn(partition_interval, partition_interval_unit)
    return TimestampAddFn(partition_interval, partition_interval_unit)


def get_partition_col_type(partition_column_name: str, columns: List[Column]):
    """From partition field, get the type

    Args:
        partition_column_name (str): column name
        columns (List[Column]): list of table columns

    Returns:
        _type_: type
    """
    partition_field = (
        partition_column_name.lower()
    )  # normalize field name as we'll be looking by key

    col = columns.get(partition_field)
    if (
        col is not None
    ):  # if col is None, this means we have BQ pseudo columns _PARTITIONDATE or _PARTITIONTIME
        return col.type
    if partition_field == "_partitiondate":
        return sqlalchemy.DATE()
    if partition_field == "_partitiontime":
        return sqlalchemy.DATETIME()
    return None


def get_query_filter_for_runner(kwargs: Dict) -> Optional[BinaryExpression]:
    """Get query filters from kwargs. IMPORTANT, this will update the original dictionary
    passed in the function argument.

    Args:
        kwargs (Dict): kwargs
    """
    if kwargs.get("query_filter_"):
        query_filter = kwargs.pop("query_filter_")
        filter_ = build_query_filter(**query_filter)
    else:
        filter_ = None

    return filter_


def handle_array(
    query: Query, column: Column, table: Union[DeclarativeMeta, AliasedClass]
) -> Query:
    """Handle query for array. The curent implementation is
    specific to BigQuery. This should be refactored in the future
    to add a more generic support

    Args:
        query (Query): query object
        column (Column): SQA Column object
        table (Union[DeclarativeMeta, AliasedClass]): table or aliased
    Returns:
        Query: query object with the FROM clause set
    """
    # pylint: disable=protected-access
    if not hasattr(column, "_is_array"):
        return query.select_from(table)
    if column._is_array:
        return query.select_from(
            table,
            func.unnest(
                # unnest expects an array. This type is not used anywhere else
                Column(column._array_col, ARRAY(String))
            ).alias(column._array_col),
        )
    return query.select_from(table)


def is_array(kwargs: Dict) -> bool:
    """Check if the kwargs has array.
    If array True is returned, we'll pop the is_array kw
    and keep the array_col kw

    Args:
        kwargs (Dict): kwargs

    Returns:
        bool: True if array, False otherwise
    """
    if kwargs.get("is_array"):
        return kwargs.pop("is_array")

    try:
        kwargs.pop("is_array")
        kwargs.pop("array_col")
    except KeyError:
        pass
    return False


def update_mssql_ischema_names(ischema_names):
    return ischema_names.update(
        {
            "nvarchar": create_sqlalchemy_type("NVARCHAR"),
            "nchar": create_sqlalchemy_type("NCHAR"),
            "ntext": create_sqlalchemy_type("NTEXT"),
            "bit": create_sqlalchemy_type("BIT"),
            "image": create_sqlalchemy_type("IMAGE"),
            "binary": create_sqlalchemy_type("BINARY"),
            "smallmoney": create_sqlalchemy_type("SMALLMONEY"),
            "money": create_sqlalchemy_type("MONEY"),
            "real": create_sqlalchemy_type("REAL"),
            "smalldatetime": create_sqlalchemy_type("SMALLDATETIME"),
            "datetime2": create_sqlalchemy_type("DATETIME2"),
            "datetimeoffset": create_sqlalchemy_type("DATETIMEOFFSET"),
            "sql_variant": create_sqlalchemy_type("SQL_VARIANT"),
            "uniqueidentifier": create_sqlalchemy_type("UUID"),
            "xml": create_sqlalchemy_type("XML"),
        }
    )
