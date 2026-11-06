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
from metadata.profiler.metrics.hybrid.cardinality_distribution import (
    CardinalityDistribution,
)
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
from metadata.profiler.metrics.window.value_rank import ValueRank
from metadata.profiler.registry import MetricRegistry


class Metrics(MetricRegistry):
    """
    Set of all supported metrics and our metric
    definition using SQLAlchemy functions or
    custom implementations
    """

    # Static Metrics
    # pylint: disable=invalid-name
    mean = Mean
    valuesCount = Count  # noqa: N815
    countInSet = CountInSet  # noqa: N815
    columnCount = ColumnCount  # noqa: N815
    distinctCount = DistinctCount  # noqa: N815
    distinctProportion = DistinctRatio  # noqa: N815
    iLikeCount = ILikeCount  # noqa: N815
    likeCount = LikeCount  # noqa: N815
    notLikeCount = NotLikeCount  # noqa: N815
    regexCount = RegexCount  # noqa: N815
    notRegexCount = NotRegexCount  # noqa: N815
    max = Max
    maxLength = MaxLength  # noqa: N815
    min = Min
    minLength = MinLength  # noqa: N815
    nullCount = NullCount  # noqa: N815
    rowCount = RowCount  # noqa: N815
    stddev = StdDev
    sum = Sum
    uniqueCount = UniqueCount  # noqa: N815
    uniqueProportion = UniqueRatio  # noqa: N815
    columnNames = ColumnNames  # noqa: N815

    # Composed Metrics
    duplicateCount = DuplicateCount  # noqa: N815
    iLikeRatio = ILikeRatio  # noqa: N815
    likeRatio = LikeRatio  # noqa: N815
    nullProportion = NullRatio  # noqa: N815
    interQuartileRange = InterQuartileRange  # noqa: N815
    nonParametricSkew = NonParametricSkew  # noqa: N815

    # Window Metrics
    median = Median
    firstQuartile = FirstQuartile  # noqa: N815
    thirdQuartile = ThirdQuartile  # noqa: N815
    valueRank = ValueRank  # noqa: N815

    # System Metrics
    system = System

    # Hybrid Metrics
    histogram = Histogram
    cardinalityDistribution = CardinalityDistribution  # noqa: N815

    # Missing Count
    nullMissingCount = NullMissingCount  # noqa: N815
