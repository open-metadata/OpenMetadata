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
