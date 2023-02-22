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
from typing import Any, Dict, List, Optional, Tuple

import sqlalchemy
from sqlalchemy import Column, and_, or_
from sqlalchemy.sql.elements import BinaryExpression
from sqlalchemy.sql.expression import TextClause

from metadata.profiler.orm.functions.datetime import DateAddFn, DatetimeAddFn
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
    return DatetimeAddFn(partition_interval, partition_interval_unit)


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
