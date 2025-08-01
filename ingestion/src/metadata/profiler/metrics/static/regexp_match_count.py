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
Regex Count Metric definition
"""
# pylint: disable=duplicate-code

from sqlalchemy import case, column

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.orm.functions.regexp import RegexpMatchFn
from metadata.profiler.orm.functions.sum import SumFn
from metadata.profiler.orm.registry import is_concatenable


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
        return MetricType.regexCount.value

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
                "Regex Count requires an expression to be set: add_props(expression=...)(Metrics.REGEX_COUNT)"
            )
        return SumFn(
            case(
                [
                    (
                        RegexpMatchFn(
                            column(self.col.name, self.col.type), self.expression
                        ),
                        1,
                    )
                ],
                else_=0,
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
            f"Don't know how to process type {self.col.type} when computing RegExp Match Count"
        )
