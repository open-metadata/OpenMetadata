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
LIKE Ratio Composed Metric definition
"""
# pylint: disable=duplicate-code

from typing import Any, Dict, Optional, Tuple

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import ComposedMetric
from metadata.profiler.metrics.static.count import Count
from metadata.profiler.metrics.static.like_count import LikeCount


class LikeRatio(ComposedMetric):
    """
    Given the total count and LIKE count,
    compute the LIKE ratio
    """

    @classmethod
    def name(cls):
        return MetricType.likeRatio.value

    @classmethod
    def required_metrics(cls) -> Tuple[str, ...]:
        return Count.name(), LikeCount.name()

    @property
    def metric_type(self):
        return float

    def fn(self, res: Dict[str, Any]) -> Optional[float]:
        """
        Safely compute null ratio based on the profiler
        results of other Metrics
        """
        res_count = res.get(Count.name())
        res_like = res.get(LikeCount.name())

        if res_count and res_like is not None:
            return res_like / res_count

        return None
