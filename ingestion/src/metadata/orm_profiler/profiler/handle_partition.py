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
Helper submodule for partitioned tables
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import text
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import DeclarativeMeta
from sqlalchemy.orm.session import Session

from metadata.orm_profiler.orm.functions.modulo import ModuloFn
from metadata.orm_profiler.orm.functions.random_num import RandomNumFn
from metadata.utils.logger import profiler_logger

RANDOM_LABEL = "random"

logger = profiler_logger()


def get_partition_cols(session: Session, table: DeclarativeMeta) -> list:
    """Get partiton columns

    Args:
        session: sqlalchemy session
        table: orm table object
    """
    return get_partition_details(session, table).get("column_names")[0]


def get_partition_details(session: Session, table: DeclarativeMeta) -> Optional[dict]:
    """get partition details

    Args:
        session: sqlalchemy session
        table: orm table object
    """
    partition_details = [
        el for el in get_table_indexes(session, table) if el.get("name") == "partition"
    ]
    if partition_details:
        return partition_details[0]
    return None


def get_table_indexes(session: Session, table: DeclarativeMeta) -> list[dict]:
    """get indexes for a specific table

    Args:
        session: sqlalchemy session
        table: orm table object
    Returns:
        list[dict]
    """
    return inspect(session.get_bind()).get_indexes(
        table.__tablename__,
        table.__table_args__.get("schema"),
    )


def is_partitioned(session: Session, table: DeclarativeMeta) -> bool:
    """Check weather a table is partitioned

    Args:
        session: sqlalchemy session
        table: orm table object
    Returns:
        bool
    """
    if not get_partition_details(session, table):
        return False
    return True


def format_partition_values(partition_values: list, col_type) -> str:
    """Format values for predicate based on its type

    Args:
        partition_datetime: datetime field for the query predicate
    Returns:
        str:
    """
    if str(col_type) in {"INT", "BIGINT", "INTEGER"}:
        return ",".join(f"{x}" for x in partition_values)

    return ",".join(f"'{x}'" for x in partition_values)


def format_partition_datetime(partition_datetime: str, col_type) -> str:
    """Formate datetime based on datetime field type and returns
    its string representation

    Args:
        partition_datetime: datetime field for the query predicate
    Returns:
        str:
    """
    if str(col_type) in {"DATE"}:
        return partition_datetime.strftime("%Y-%m-%d")

    return partition_datetime.strftime("%Y-%m-%d %H:%M:%S")


def build_partition_predicate(partition_details: dict, col):
    """Build partition predicate

    Args:
        partition_details: details about the partition
        col: partition col -- used to ge the type

    Returns:
        text predicat for query

    """
    col_type = None
    if col is not None:
        col_type = col.type
    if partition_details["partition_values"]:
        return text(
            f"{partition_details['partition_field']} in "
            f"({format_partition_values(partition_details['partition_values'], col_type)})"
        )
    if partition_details["partition_field"] == "_PARTITIONDATE":
        col_type = "DATE"
    return text(
        f"{partition_details['partition_field']} BETWEEN "
        f"'{format_partition_datetime(partition_details['partition_start'], col_type)}' "
        f"AND '{format_partition_datetime(partition_details['partition_end'], col_type)}'"
    )


# pylint: disable=invalid-name,protected-access
class partition_filter_handler:
    """Decorator to handle partioned queries (hence lowercase class name)

    Attributes:
        first (bool): whether to return just the first row
        sampled (bool): whether data should be sampled
        build_sample (bool): whether to build the sample data set
    """

    def __init__(
        self,
        first: bool = True,
        sampled: bool = False,
        build_sample: bool = False,
    ):
        self.first = first
        self.sampled = sampled
        self.build_sample = build_sample

    def __call__(self, func):
        def handle_and_execute(_self, *args, **kwargs):
            """Handle partitioned queries"""
            if _self._partition_details:
                partition_field = _self._partition_details["partition_field"]
                partition_filter = build_partition_predicate(
                    _self._partition_details,
                    _self.table.__table__.c.get(partition_field),
                )
                if self.build_sample:
                    return (
                        _self.session.query(
                            _self.table,
                            (ModuloFn(RandomNumFn(), 100)).label(RANDOM_LABEL),
                        )
                        .filter(partition_filter)
                        .cte(f"{_self.table.__tablename__}_rnd")
                    )
                query_results = _self._build_query(*args, **kwargs).select_from(
                    _self._sample if self.sampled else _self.table
                )
                # we don't have to add a filter if it has partition field as the query already has a filter
                if not partition_field:
                    query_results = query_results.filter(partition_filter)
                return query_results.first() if self.first else query_results.all()
            return func(_self, *args, **kwargs)

        return handle_and_execute
