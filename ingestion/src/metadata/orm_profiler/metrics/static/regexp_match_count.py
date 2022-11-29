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
Regex Count Metric definition
"""
# pylint: disable=duplicate-code

from sqlalchemy import case, column

from metadata.orm_profiler.metrics.core import StaticMetric, _label
from metadata.orm_profiler.orm.functions.sum import SumFn


class RegexCount(StaticMetric):
    """
    REGEX_COUNT Metric

    Given a column, and an expression, return the number of
    rows that match it

    This Metric needs to be initialised passing the expression to check
    add_props(expression="j.*")(Metrics.REGEX_COUNT.value)
    """

    expression: str

    @classmethod
    def name(cls):
        return "regexCount"

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        if not hasattr(self, "expression"):
            raise AttributeError(
                "Regex Count requires an expression to be set: add_props(expression=...)(Metrics.REGEX_COUNT)"
            )
        return SumFn(
            case([(column(self.col.name).regexp_match(self.expression), 1)], else_=0)
        )
