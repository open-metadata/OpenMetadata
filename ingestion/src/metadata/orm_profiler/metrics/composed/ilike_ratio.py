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
ILIKE Ratio Composed Metric definition
"""
# pylint: disable=duplicate-code

from typing import Any, Dict, Optional, Tuple

from metadata.orm_profiler.metrics.core import ComposedMetric
from metadata.orm_profiler.metrics.static.count import Count
from metadata.orm_profiler.metrics.static.ilike_count import ILikeCount


class ILikeRatio(ComposedMetric):
    """
    Given the total count and ILIKE count,
    compute the ILIKE ratio
    """

    @classmethod
    def name(cls):
        return "iLikeRatio"

    @classmethod
    def required_metrics(cls) -> Tuple[str, ...]:
        return Count.name(), ILikeCount.name()

    @property
    def metric_type(self):
        return float

    def fn(self, res: Dict[str, Any]) -> Optional[float]:
        """
        Safely compute null ratio based on the profiler
        results of other Metrics
        """
        res_count = res.get(Count.name())
        res_ilike = res.get(ILikeCount.name())

        if res_count and res_ilike is not None:
            return res_ilike / res_count

        return None
