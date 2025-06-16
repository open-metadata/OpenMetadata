#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
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
from metadata.profiler.metrics.composed.distinct_ratio import DistinctRatio
from metadata.profiler.metrics.composed.duplicate_count import DuplicateCount
from metadata.profiler.metrics.composed.ilike_ratio import ILikeRatio
from metadata.profiler.metrics.composed.iqr import InterQuartileRange
from metadata.profiler.metrics.composed.like_ratio import LikeRatio
from metadata.profiler.metrics.composed.non_parametric_skew import NonParametricSkew
from metadata.profiler.metrics.composed.null_ratio import NullRatio
from metadata.profiler.metrics.composed.unique_ratio import UniqueRatio
from metadata.profiler.metrics.hybrid.histogram import Histogram
from metadata.profiler.metrics.static.column_count import ColumnCount
from metadata.profiler.metrics.static.column_names import ColumnNames
from metadata.profiler.metrics.static.count import Count
from metadata.profiler.metrics.static.count_in_set import CountInSet
from metadata.profiler.metrics.static.distinct_count import DistinctCount
from metadata.profiler.metrics.static.ilike_count import ILikeCount
from metadata.profiler.metrics.static.like_count import LikeCount
from metadata.profiler.metrics.static.max import Max
from metadata.profiler.metrics.static.max_length import MaxLength
from metadata.profiler.metrics.static.mean import Mean
from metadata.profiler.metrics.static.min import Min
from metadata.profiler.metrics.static.min_length import MinLength
from metadata.profiler.metrics.static.not_like_count import NotLikeCount
from metadata.profiler.metrics.static.not_regexp_match_count import NotRegexCount
from metadata.profiler.metrics.static.null_count import NullCount
from metadata.profiler.metrics.static.null_missing_count import NullMissingCount
from metadata.profiler.metrics.static.regexp_match_count import RegexCount
from metadata.profiler.metrics.static.row_count import RowCount
from metadata.profiler.metrics.static.stddev import StdDev
from metadata.profiler.metrics.static.sum import Sum
from metadata.profiler.metrics.static.unique_count import UniqueCount
from metadata.profiler.metrics.system.system import System
from metadata.profiler.metrics.window.first_quartile import FirstQuartile
from metadata.profiler.metrics.window.median import Median
from metadata.profiler.metrics.window.third_quartile import ThirdQuartile
from metadata.profiler.registry import MetricRegistry


class Metrics(MetricRegistry):
    """
    Set of all supported metrics and our metric
    definition using SQLAlchemy functions or
    custom implementations
    """

    # Static Metrics
    MEAN = Mean
    COUNT = Count
    COUNT_IN_SET = CountInSet
    COLUMN_COUNT = ColumnCount
    DISTINCT_COUNT = DistinctCount
    DISTINCT_RATIO = DistinctRatio
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
    IQR = InterQuartileRange
    NON_PARAMETRIC_SKEW = NonParametricSkew

    # Window Metrics
    MEDIAN = Median
    FIRST_QUARTILE = FirstQuartile
    THIRD_QUARTILE = ThirdQuartile

    # System Metrics
    SYSTEM = System

    # Hybrid Metrics
    HISTOGRAM = Histogram

    # Missing Count
    NULL_MISSING_COUNT = NullMissingCount
