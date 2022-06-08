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
Count Metric definition
"""
# pylint: disable=duplicate-code

from sqlalchemy import column, func

from metadata.orm_profiler.metrics.core import StaticMetric, _label


class Count(StaticMetric):
    """
    COUNT Metric

    Given a column, return the count. Ignores NULL values
    """

    @classmethod
    def name(cls):
        return "valuesCount"

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        return func.count(column(self.col.name))
