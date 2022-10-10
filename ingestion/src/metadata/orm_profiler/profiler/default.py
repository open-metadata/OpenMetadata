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
Default simple profiler to use
"""
from typing import List, Optional

from sqlalchemy.orm import DeclarativeMeta

from metadata.generated.schema.entity.data.table import ColumnProfilerConfig
from metadata.interfaces.profiler_protocol import ProfilerProtocol
from metadata.orm_profiler.metrics.core import Metric, add_props
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.core import Profiler


def get_default_metrics(table: DeclarativeMeta) -> List[Metric]:
    return [
        # Table Metrics
        Metrics.ROW_COUNT.value,
        add_props(table=table)(Metrics.COLUMN_COUNT.value),
        add_props(table=table)(Metrics.COLUMN_NAMES.value),
        # Column Metrics
        Metrics.MEDIAN.value,
        Metrics.MEAN.value,
        Metrics.COUNT.value,
        Metrics.DISTINCT_COUNT.value,
        Metrics.DISTINCT_RATIO.value,
        Metrics.MIN.value,
        Metrics.MIN_LENGTH.value,
        Metrics.MAX.value,
        Metrics.MAX_LENGTH.value,
        Metrics.NULL_COUNT.value,
        Metrics.NULL_RATIO.value,
        Metrics.STDDEV.value,
        Metrics.SUM.value,
        Metrics.UNIQUE_COUNT.value,
        Metrics.UNIQUE_RATIO.value,
        # Metrics.HISTOGRAM.value,  # TODO: enable it back after #4368
    ]


class DefaultProfiler(Profiler):
    """
    Pre-built profiler with a simple
    set of metrics that we can use as
    a default.
    """

    def __init__(
        self,
        profiler_interface: ProfilerProtocol,
        include_columns: Optional[List[ColumnProfilerConfig]] = None,
        exclude_columns: Optional[List[str]] = None,
    ):

        _metrics = get_default_metrics(profiler_interface.table)

        super().__init__(
            *_metrics,
            profiler_interface=profiler_interface,
            include_columns=include_columns,
            exclude_columns=exclude_columns,
        )
