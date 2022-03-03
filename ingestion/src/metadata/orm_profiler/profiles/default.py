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

from sqlalchemy.orm.session import Session

from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiles.core import Profiler


class DefaultProfiler(Profiler):
    """
    Pre-built profiler with a simple
    set of metrics that we can use as
    a default.
    """

    def __init__(
        self,
        session: Session,
        table,
        ignore_cols: Optional[List[str]] = None,
    ):
        _metrics = [
            # Table Metrics
            Metrics.ROW_COUNT.value,
            # Column Metrics
            Metrics.MEAN.value,
            Metrics.COUNT.value,
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
            Metrics.HISTOGRAM.value,
        ]
        super().__init__(
            *_metrics, session=session, table=table, ignore_cols=ignore_cols
        )
