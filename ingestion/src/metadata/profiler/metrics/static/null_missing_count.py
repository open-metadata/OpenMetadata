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
Null Count Metric definition
"""
# pylint: disable=duplicate-code

from typing import TYPE_CHECKING

from sqlalchemy import case, column

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.metrics.pandas_metric_protocol import PandasComputation
from metadata.profiler.orm.functions.sum import SumFn
from metadata.utils.logger import profiler_logger

if TYPE_CHECKING:
    import pandas as pd

logger = profiler_logger()


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
        """pandas function"""
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(
                    f"Error while computing 'Null Missing Count' for column '{self.col.name}': {err}"
                )
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        """Returns the logic to compute this metrics using Pandas"""
        return PandasComputation[int, int](
            create_accumulator=lambda: 0,
            update_accumulator=lambda acc, df: NullMissingCount.update_accumulator(
                acc, df, self.col
            ),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def update_accumulator(current_count: int, df: "pd.DataFrame", column) -> int:
        """Computes one DataFrame chunk and updates the running null/missing count

        Maintains a single count value. Adds chunk's null and empty string count
        to the current total and returns the sum.
        """
        chunk_null_count = df[column.name].isnull().sum()
        chunk_empty_count = (df[column.name] == "").sum()
        return current_count + chunk_null_count + chunk_empty_count
