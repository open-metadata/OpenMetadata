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

from typing import List

from sqlalchemy import Column, text

from metadata.generated.schema.entity.data.table import (
    PartitionIntervalTypes,
    PartitionProfilerConfig,
)
from metadata.profiler.orm.functions.modulo import ModuloFn
from metadata.profiler.orm.functions.random_num import RandomNumFn
from metadata.utils.logger import profiler_logger
from metadata.utils.sqa_utils import (
    build_query_filter,
    dispatch_to_date_or_datetime,
    get_integer_range_filter,
    get_partition_col_type,
    get_value_filter,
)

RANDOM_LABEL = "random"

logger = profiler_logger()


def build_partition_predicate(
    partition_details: PartitionProfilerConfig,
    columns: List[Column],
):
    """_summary_

    Args:
        partition_details (dict): _description_
        col (Column): _description_

    Returns:
        _type_: _description_
    """
    partition_field = partition_details.partitionColumnName
    if partition_details.partitionIntervalType == PartitionIntervalTypes.COLUMN_VALUE:
        return get_value_filter(
            Column(partition_field),
            partition_details.partitionValues,
        )

    if partition_details.partitionIntervalType == PartitionIntervalTypes.INTEGER_RANGE:
        return get_integer_range_filter(
            Column(partition_field),
            partition_details.partitionIntegerRangeStart,
            partition_details.partitionIntegerRangeEnd,
        )

    type_ = get_partition_col_type(
        partition_field,
        columns,
    )

    date_or_datetime_fn = dispatch_to_date_or_datetime(
        partition_details.partitionInterval,
        text(partition_details.partitionIntervalUnit.value),
        type_,
    )

    return build_query_filter(
        [(Column(partition_field), "ge", date_or_datetime_fn)],
        False,
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
                partition_filter = build_partition_predicate(
                    _self._partition_details,
                    _self.table.__table__.c,
                )
                if self.build_sample:
                    return (
                        _self._base_sample_query(
                            kwargs.get("column"),
                            (ModuloFn(RandomNumFn(), 100)).label(RANDOM_LABEL),
                        )
                        .filter(partition_filter)
                        .cte(f"{_self.table.__tablename__}_rnd")
                    )
                query_results = _self._build_query(*args, **kwargs).select_from(
                    _self._sample if self.sampled else _self.table
                )
                return query_results.first() if self.first else query_results.all()
            return func(_self, *args, **kwargs)

        return handle_and_execute
