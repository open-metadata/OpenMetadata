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
OpenMetadata Profiler supported metrics

Use these registries to avoid messy imports.

Note that we are using our own Registry definition
that allows us to directly call our metrics without
having the verbosely pass .value all the time...
"""

from metadata.orm_profiler.metrics.composed.null_ratio import NullRatio
from metadata.orm_profiler.metrics.static.count import Count
from metadata.orm_profiler.metrics.static.min import Min
from metadata.orm_profiler.metrics.static.null_count import NullCount
from metadata.orm_profiler.metrics.static.row_number import RowNumber
from metadata.orm_profiler.metrics.static.stddev import StdDev
from metadata.orm_profiler.registry import MetricRegistry


class Metrics(MetricRegistry):
    """
    Set of all supported metrics and our metric
    definition using SQLAlchemy functions or
    custom implementations
    """

    # Static Metrics
    ROW_NUMBER = RowNumber
    MIN = Min
    COUNT = Count
    NULL_COUNT = NullCount
    STDDEV = StdDev

    # Composed Metrics
    NULL_RATIO = NullRatio
