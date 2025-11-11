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
MIN_LENGTH Metric definition
"""
# pylint: disable=duplicate-code


from typing import TYPE_CHECKING, Optional

from sqlalchemy import column, func

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.metrics.pandas_metric_protocol import PandasComputation
from metadata.profiler.orm.functions.length import LenFn
from metadata.profiler.orm.registry import is_concatenable
from metadata.utils.logger import profiler_logger

if TYPE_CHECKING:
    import pandas as pd

logger = profiler_logger()


class MinLength(StaticMetric):
    """
    MIN_LENGTH Metric

    Given a column, return the MIN LENGTH value.

    Only works for concatenable types
    """

    @classmethod
    def name(cls):
        return MetricType.minLength.value

    @property
    def metric_type(self):
        return int

    def _is_concatenable(self):
        return is_concatenable(self.col.type)

    @_label
    def fn(self):
        """sqlalchemy function"""
        if self._is_concatenable():
            return func.min(LenFn(column(self.col.name, self.col.type)))

        logger.debug(
            f"Don't know how to process type {self.col.type} when computing MIN_LENGTH"
        )
        return None

    # pylint: disable=import-outside-toplevel
    def df_fn(self, dfs=None):
        """dataframe function"""
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()

        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(
                    f"Don't know how to process type {self.col.type} when computing MIN_LENGTH"
                )
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        """Returns the logic to compute this metrics using Pandas"""
        return PandasComputation[Optional[int], Optional[int]](
            create_accumulator=lambda: None,
            update_accumulator=lambda acc, df: MinLength.update_accumulator(
                acc, df, self.col
            ),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def update_accumulator(
        current_min: Optional[int], df: "pd.DataFrame", column
    ) -> Optional[int]:
        """Computes one DataFrame chunk and updates the running minimum"""
        import pandas as pd
        from numpy import vectorize

        length_vectorize_func = vectorize(len)
        chunk_min = None

        if is_concatenable(column.type):
            min_val = length_vectorize_func(df[column.name].dropna().astype(str)).min()
            if not pd.isnull(min_val):
                chunk_min = min_val

        if chunk_min is None or pd.isnull(chunk_min):
            return current_min

        if current_min is None:
            return chunk_min

        return min(current_min, chunk_min)
