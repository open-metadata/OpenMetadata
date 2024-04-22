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

from sqlalchemy import case, column, not_

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.orm.functions.sum import SumFn
from metadata.profiler.orm.registry import is_concatenable


class NotRegexCount(StaticMetric):
    """
    NOT_REGEX_COUNT Metric

    Given a column, and an expression, return the number of
    rows that match the forbidden regex pattern

    This Metric needs to be initialised passing the expression to check
    add_props(expression="j%")(Metrics.NOT_REGEX_COUNT.value)
    """

    expression: str

    @classmethod
    def name(cls):
        return MetricType.notRegexCount.value

    @property
    def metric_type(self):
        return int

    def _is_concatenable(self):
        return is_concatenable(self.col.type)

    @_label
    def fn(self):
        """sqlalchemy function"""
        if not hasattr(self, "expression"):
            raise AttributeError(
                "Not Regex Count requires an expression to be set: add_props(expression=...)(Metrics.NOT_REGEX_COUNT)"
            )
        return SumFn(
            case(
                [
                    (
                        not_(
                            column(self.col.name, self.col.type).regexp_match(
                                self.expression
                            )
                        ),
                        0,
                    )
                ],
                else_=1,
            )
        )

    def df_fn(self, dfs):
        """pandas function"""
        if not hasattr(self, "expression"):
            raise AttributeError(
                "Regex Count requires an expression to be set: add_props(expression=...)(Metrics.REGEX_COUNT)"
            )
        if self._is_concatenable():
            return sum(
                df[self.col.name][
                    df[self.col.name].astype(str).str.contains(self.expression)
                ].count()
                for df in dfs
            )
        raise TypeError(
            f"Don't know how to process type {self.col.type} when computing Not RegExp Match Count"
        )
