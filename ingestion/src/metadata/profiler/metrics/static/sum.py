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
SUM Metric definition
"""
from functools import partial
from typing import TYPE_CHECKING, Callable, Optional

from sqlalchemy import column

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.generated.schema.entity.data.table import Table
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor
from metadata.profiler.metrics.core import StaticMetric, T, _label
from metadata.profiler.metrics.pandas_metric_protocol import PandasComputation
from metadata.profiler.orm.functions.length import LenFn
from metadata.profiler.orm.functions.sum import SumFn
from metadata.profiler.orm.registry import is_concatenable, is_quantifiable
from metadata.utils.logger import profiler_logger

# pylint: disable=duplicate-code

if TYPE_CHECKING:
    import pandas as pd

logger = profiler_logger()


class Sum(StaticMetric):
    """
    SUM Metric

    Given a column, return the sum of its values.

    Only works for quantifiable types
    """

    @classmethod
    def name(cls):
        return MetricType.sum.value

    @_label
    def fn(self):
        """sqlalchemy function"""
        if is_quantifiable(self.col.type):
            return SumFn(column(self.col.name, self.col.type))

        if is_concatenable(self.col.type):
            return SumFn(LenFn(column(self.col.name, self.col.type)))

        return None

    def df_fn(self, dfs=None):
        """pandas function"""
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(
                    f"Error while computing min for column {self.col.name}: {err}"
                )
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        """Returns the logic to compute this metrics using Pandas"""
        return PandasComputation[Optional[float], Optional[float]](
            create_accumulator=lambda: None,
            update_accumulator=lambda acc, df: Sum.update_accumulator(
                acc, df, self.col
            ),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def update_accumulator(
        current_sum: Optional[float], df: "pd.DataFrame", column
    ) -> Optional[float]:
        """Computes one DataFrame chunk and updates the running maximum

        Maintains a single maximum value (not a list). Compares chunk's max
        with current maximum and returns the larger value.
        """
        import pandas as pd

        chunk_sum = None

        if is_quantifiable(column.type):
            try:
                series = df[column.name].dropna()
                if not series.empty:
                    chunk_sum = df[column.name].sum()
            except (TypeError, ValueError):
                try:
                    chunk_sum = df[column.name].astype(float).sum()
                except Exception:
                    return None

            if chunk_sum is None or pd.isnull(chunk_sum):
                return current_sum

            if current_sum is None:
                return chunk_sum

            return current_sum + chunk_sum
        return None

    def nosql_fn(self, adaptor: NoSQLAdaptor) -> Callable[[Table], Optional[T]]:
        """nosql function"""
        if is_quantifiable(self.col.type):
            return partial(adaptor.sum, column=self.col)
        return lambda table: None
