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
from typing import Union, Optional, Callable

from inflect import engine
import sql_metadata
import sqlalchemy
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import DeclarativeMeta
from sqlalchemy.orm.session import Session
from sqlalchemy.engine import Engine
from sqlalchemy.engine import Connection
from sqlalchemy import text

from metadata.utils.logger import profiler_logger
from metadata.orm_profiler.orm.functions.modulo import ModuloFn
from metadata.orm_profiler.orm.functions.random_num import RandomNumFn
from metadata.orm_profiler.profiler.sampler import RANDOM_LABEL

logger = profiler_logger()


def get_partition_cols(session: Session, table: DeclarativeMeta) -> list:
    """Get partiton columns
    
    Args:
        session: sqlalchemy session
        table: orm table object
    """
    return get_partition_details().get("column_names")[0]


def get_partition_details(session: Session, table: DeclarativeMeta) -> Optional[dict]:
    """get partition details

    Args:
        session: sqlalchemy session
        table: orm table object
    """
    return [
        el for el in get_table_indexes(session, table) 
        if el.get("name") == "partition"
        ][0] or None


def get_table_indexes(session: Session, table: DeclarativeMeta) -> list[dict]:
    """get indexes for a specific table
    
    Args:
        session: sqlalchemy session
        table: orm table object
    Returns:
        list[dict]
    """
    return  inspect(session.get_bind()).get_indexex(
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
    if str(col_type) in {"INT", "BIGINT", "INTEGER"}:
        return ','.join(f"{x}" for x in partition_values)

    return ','.join(f"'{x}'" for x in partition_values)


def build_partition_predicate(partition_details, col_type):
    if partition_details.partition_values:
        return text(
            f"{partition_details.partition_field} in ({format_partition_values(partition_details.partition_values, col_type)})"
            )

    return text(
        f"{partition_details.partition_field} BETWEEN '{partition_details.start}' AND '{partition_details.end}'"
        )


def bigquery_required_partition_filter_handler(first: bool = True, sampled: bool = False, build_sample: bool = False):
    def decorate(fn: Callable):
        def handle_and_execute(self, *args, **kwargs):
            if self._partition_details:
                partition_filter = build_partition_predicate(self._partition_details, self.table.__table__.c.get(self._partition_details.partition_field).type)

                if build_sample:
                    return self.session.query(
                        self.table, (ModuloFn(RandomNumFn(), 100)).label(RANDOM_LABEL)
                    ).filter(partition_filter).cte(f"{self.table.__tablename__}_rnd")

                query_results = self._build_query(*args, **kwargs).select_from(self._sample if sampled else self._table).filter(partition_filter)
                if first:
                    return query_results.first()
                return query_results.all()

            return fn(self, *args, **kwargs)


        return handle_and_execute

    return decorate
