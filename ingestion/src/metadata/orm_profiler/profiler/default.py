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
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import DeclarativeMeta
from sqlalchemy.orm.session import Session

from metadata.orm_profiler.metrics.core import Metric, add_props
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.core import Profiler
from metadata.utils.constants import TEN_MIN


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
        session: Session,
        table: DeclarativeMeta,
        ignore_cols: Optional[List[str]] = None,
        profile_date: datetime = datetime.now(),
        profile_sample: Optional[float] = None,
        timeout_seconds: Optional[int] = TEN_MIN,
        partition_details: Optional[Dict] = None,
        profile_sample_query: Optional[str] = None,
    ):

        _metrics = get_default_metrics(table)

        super().__init__(
            *_metrics,
            session=session,
            table=table,
            ignore_cols=ignore_cols,
            profile_date=profile_date,
            profile_sample=profile_sample,
            timeout_seconds=timeout_seconds,
            partition_details=partition_details,
            profile_sample_query=profile_sample_query,
        )
