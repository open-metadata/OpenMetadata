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
Like Count Metric definition
"""
# pylint: disable=duplicate-code

from sqlalchemy import case, column

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.orm.functions.sum import SumFn


class NotLikeCount(StaticMetric):
    """
    NOT_LIKE_COUNT Metric

    Given a column, and an expression, return the number of
    rows that match the forbidden regex pattern

    This Metric needs to be initialised passing the expression to check
    add_props(expression="j%")(Metrics.NOT_LIKE_COUNT.value)
    """

    expression: str

    @classmethod
    def name(cls):
        return MetricType.notLikeCount.value

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        if not hasattr(self, "expression"):
            raise AttributeError(
                "Not Like Count requires an expression to be set: add_props(expression=...)(Metrics.NOT_LIKE_COUNT)"
            )
        return SumFn(
            case(
                [(column(self.col.name, self.col.type).not_like(self.expression), 0)],
                else_=1,
            )
        )
