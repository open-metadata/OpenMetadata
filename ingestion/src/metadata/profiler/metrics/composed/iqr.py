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
Inter Quartile Range Composed Metric definition
"""
# pylint: disable=duplicate-code

from typing import Any, Dict, Optional, Tuple

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import ComposedMetric
from metadata.profiler.metrics.window.first_quartile import FirstQuartile
from metadata.profiler.metrics.window.third_quartile import ThirdQuartile


class InterQuartileRange(ComposedMetric):
    """
    Given the first and third quartile compute the IQR,
    """

    @classmethod
    def name(cls):
        return MetricType.interQuartileRange.value

    @classmethod
    def required_metrics(cls) -> Tuple[str, ...]:
        return FirstQuartile.name(), ThirdQuartile.name()

    @property
    def metric_type(self):
        """
        Override default metric_type definition as
        we now don't care about the column
        """
        return float

    def fn(self, res: Dict[str, Any]) -> Optional[float]:
        """
        Safely compute null ratio based on the profiler
        results of other Metrics
        """
        res_first_quartile = res.get(FirstQuartile.name())
        res_third_quartile = res.get(ThirdQuartile.name())

        if res_first_quartile is not None and res_third_quartile is not None:
            return res_third_quartile - res_first_quartile

        return None
