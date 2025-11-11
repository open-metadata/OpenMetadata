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
Table Count Metric definition
"""
from typing import TYPE_CHECKING, Callable

from sqlalchemy import func

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.generated.schema.entity.data.table import Table
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.metrics.pandas_metric_protocol import PandasComputation
from metadata.utils.logger import profiler_logger

if TYPE_CHECKING:
    import pandas as pd

logger = profiler_logger()


class RowCount(StaticMetric):
    """
    ROW_NUMBER Metric

    Count all rows on a table
    """

    @classmethod
    def name(cls):
        return MetricType.rowCount.value

    @classmethod
    def is_col_metric(cls) -> bool:
        """
        Mark the class as a Table Metric
        """
        return False

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        """sqlalchemy function"""
        return func.count()

    def df_fn(self, dfs=None):
        """pandas function"""
        try:
            computation = self.get_pandas_computation()
            accumulator = computation.create_accumulator()
            for df in dfs:
                accumulator = computation.update_accumulator(accumulator, df)
            return computation.aggregate_accumulator(accumulator)
        except Exception as err:
            logger.debug(f" Failure when Computing RowCount.\n Error: {err}")
            return 0

    def get_pandas_computation(self) -> PandasComputation:
        """Returns the logic to compute this metrics using Pandas"""
        return PandasComputation[int, int](
            create_accumulator=lambda: 0,
            update_accumulator=lambda acc, df: RowCount.update_accumulator(acc, df),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def update_accumulator(running_count: int, df: "pd.DataFrame") -> int:
        """Computes one DataFrame chunk and updates the running count

        Maintains a single running total of rows. Adds the chunk's row count
        to the current total and returns the updated sum.
        """
        return running_count + len(df.index)

    @classmethod
    def nosql_fn(cls, client: NoSQLAdaptor) -> Callable[[Table], int]:
        return client.item_count
