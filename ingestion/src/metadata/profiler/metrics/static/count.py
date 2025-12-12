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
Count Metric definition
"""
# pylint: disable=duplicate-code

import traceback
from typing import TYPE_CHECKING

from sqlalchemy import column, func

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.metrics.pandas_metric_protocol import PandasComputation
from metadata.profiler.orm.functions.count import CountFn
from metadata.utils.logger import profiler_logger

if TYPE_CHECKING:
    import pandas as pd

logger = profiler_logger()


class Count(StaticMetric):
    """
    COUNT Metric

    Given a column, return the count. Ignores NULL values
    """

    @classmethod
    def name(cls):
        return MetricType.valuesCount.value

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        """sqlalchemy function"""
        return func.count(CountFn(column(self.col.name, self.col.type)))

    def df_fn(self, dfs=None):
        """pandas function"""
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error trying to run Count for {self.col.name}: {err}")
                return 0
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        """Returns the logic to compute this metric using Pandas"""
        return PandasComputation[int, int](
            create_accumulator=lambda: 0,
            update_accumulator=lambda acc, df: Count.update_accumulator(
                acc, df, self.col
            ),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def update_accumulator(running_count: int, df: "pd.DataFrame", column) -> int:
        """Computes one DataFrame chunk and updates the running count

        Counts non-null values in the column.
        Maintains a single running total. Adds chunk's count to the current total.
        """
        chunk_count = df[column.name].count()
        return running_count + chunk_count
