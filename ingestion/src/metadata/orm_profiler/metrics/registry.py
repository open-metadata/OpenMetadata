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
from metadata.orm_profiler.metrics.composed.distinct_ratio import DistinctRatio
from metadata.orm_profiler.metrics.composed.duplicate_count import DuplicateCount
from metadata.orm_profiler.metrics.composed.ilike_ratio import ILikeRatio
from metadata.orm_profiler.metrics.composed.like_ratio import LikeRatio
from metadata.orm_profiler.metrics.composed.null_ratio import NullRatio
from metadata.orm_profiler.metrics.composed.unique_ratio import UniqueRatio
from metadata.orm_profiler.metrics.static.column_count import ColumnCount
from metadata.orm_profiler.metrics.static.column_names import ColumnNames
from metadata.orm_profiler.metrics.static.count import Count
from metadata.orm_profiler.metrics.static.count_in_set import CountInSet
from metadata.orm_profiler.metrics.static.distinct_count import DistinctCount
from metadata.orm_profiler.metrics.static.histogram import Histogram
from metadata.orm_profiler.metrics.static.ilike_count import ILikeCount
from metadata.orm_profiler.metrics.static.like_count import LikeCount
from metadata.orm_profiler.metrics.static.max import Max
from metadata.orm_profiler.metrics.static.max_length import MaxLength
from metadata.orm_profiler.metrics.static.mean import Mean
from metadata.orm_profiler.metrics.static.min import Min
from metadata.orm_profiler.metrics.static.min_length import MinLength
from metadata.orm_profiler.metrics.static.not_like_count import NotLikeCount
from metadata.orm_profiler.metrics.static.not_regexp_match_count import NotRegexCount
from metadata.orm_profiler.metrics.static.null_count import NullCount
from metadata.orm_profiler.metrics.static.regexp_match_count import RegexCount
from metadata.orm_profiler.metrics.static.row_count import RowCount
from metadata.orm_profiler.metrics.static.stddev import StdDev
from metadata.orm_profiler.metrics.static.sum import Sum
from metadata.orm_profiler.metrics.static.unique_count import UniqueCount
from metadata.orm_profiler.metrics.system.system import System
from metadata.orm_profiler.metrics.window.median import Median
from metadata.orm_profiler.registry import MetricRegistry


class Metrics(MetricRegistry):
    """
    Set of all supported metrics and our metric
    definition using SQLAlchemy functions or
    custom implementations
    """

    # Static Metrics
    MEAN = Mean
    MEDIAN = Median
    COUNT = Count
    COUNT_IN_SET = CountInSet
    COLUMN_COUNT = ColumnCount
    DISTINCT_COUNT = DistinctCount
    DISTINCT_RATIO = DistinctRatio
    HISTOGRAM = Histogram
    ILIKE_COUNT = ILikeCount
    LIKE_COUNT = LikeCount
    NOT_LIKE_COUNT = NotLikeCount
    REGEX_COUNT = RegexCount
    NOT_REGEX_COUNT = NotRegexCount
    MAX = Max
    MAX_LENGTH = MaxLength
    MIN = Min
    MIN_LENGTH = MinLength
    NULL_COUNT = NullCount
    ROW_COUNT = RowCount
    STDDEV = StdDev
    SUM = Sum
    UNIQUE_COUNT = UniqueCount
    UNIQUE_RATIO = UniqueRatio
    COLUMN_NAMES = ColumnNames

    # Composed Metrics
    DUPLICATE_COUNT = DuplicateCount
    ILIKE_RATIO = ILikeRatio
    LIKE_RATIO = LikeRatio
    NULL_RATIO = NullRatio

    # System Metrics
    SYSTEM = System
