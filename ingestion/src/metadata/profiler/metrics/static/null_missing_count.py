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
Null Count Metric definition
"""
# pylint: disable=duplicate-code


from sqlalchemy import case, column

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.orm.functions.sum import SumFn


class NullMissingCount(StaticMetric):
    """
    NULL + Empty COUNT Metric

    Given a column, return the null count.

    We are building a CASE WHEN structure:
    ```
    SUM(
        CASE is not null THEN 1
        ELSE 0
    )
    ```
    """

    @classmethod
    def name(cls):
        """
        Returns the name of the metric.
        """
        return MetricType.nullCount.value

    @property
    def metric_type(self):
        """
        Returns the type of the metric.
        """
        return int

    @_label
    def fn(self):
        """
        Returns the SQLAlchemy function for calculating the metric.
        """
        return SumFn(
            case(
                [
                    (column(self.col.name, self.col.type).is_(None), 1),
                    (column(self.col.name, self.col.type).__eq__(""), 1),
                ],
                else_=0,
            )
        )

    def df_fn(self, dfs=None):
        """
        Returns the pandas function for calculating the metric.
        """
        return sum(df[self.col.name].isnull().sum() for df in dfs)
