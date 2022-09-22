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
CountInSet Metric definition
"""
# pylint: disable=duplicate-code
import traceback
from typing import List

from sqlalchemy import case, column

from metadata.orm_profiler.metrics.core import StaticMetric, _label
from metadata.orm_profiler.orm.functions.sum import SumFn
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class CountInSet(StaticMetric):
    """
    COUNT_IN_SET Metric

    Given a column, return the count of values in a given set.

    This Metric needs to be initialised passing the values to look for
    the count:
    add_props(values=["John"])(Metrics.COUNT_IN_SET.value)
    """

    values: List[str]

    @classmethod
    def name(cls):
        return "countInSet"

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        if not hasattr(self, "values"):
            raise AttributeError(
                "CountInSet requires a set of values to be validate: add_props(values=...)(Metrics.COUNT_IN_SET)"
            )

        try:
            set_values = set(self.values)
            return SumFn(case([(column(self.col.name).in_(set_values), 1)], else_=0))

        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error trying to run countInSet for {self.col.name}: {exc}")
            return None
