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
Non Parametric Skew definition
"""
# pylint: disable=duplicate-code

from typing import Any, Dict, Optional, Tuple

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import ComposedMetric
from metadata.profiler.metrics.static.mean import Mean
from metadata.profiler.metrics.static.stddev import StdDev
from metadata.profiler.metrics.window.median import Median


class NonParametricSkew(ComposedMetric):
    """
    Return the non parametric skew of a column
    """

    @classmethod
    def name(cls):
        return MetricType.nonParametricSkew.value

    @classmethod
    def required_metrics(cls) -> Tuple[str, ...]:
        return Mean.name(), StdDev.name(), Median.name()

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
        res_mean = res.get(Mean.name())
        res_stddev = res.get(StdDev.name())
        res_median = res.get(Median.name())

        if res_mean is not None and res_stddev is not None and res_median is not None:
            try:
                return (float(res_mean) - float(res_median)) / float(
                    res_stddev
                )  # convert from decimal
            except ZeroDivisionError:
                return None
        return None
