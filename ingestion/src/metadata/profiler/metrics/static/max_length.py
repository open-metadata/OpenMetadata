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
MAX_LENGTH Metric definition
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


class MaxLength(StaticMetric):
    """
    MAX_LENGTH Metric

    Given a column, return the MAX LENGTH value.

    Only works for concatenable types
    """

    @classmethod
    def name(cls):
        return MetricType.maxLength.value

    @property
    def metric_type(self):
        return int

    def _is_concatenable(self):
        return is_concatenable(self.col.type)

    @_label
    def fn(self):
        """sqlalchemy function"""
        if self._is_concatenable():
            return func.max(LenFn(column(self.col.name, self.col.type)))

        logger.debug(
            f"Don't know how to process type {self.col.type} when computing MAX_LENGTH"
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
                    f"Don't know how to process type {self.col.type} when computing MAX_LENGTH"
                )
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        """Returns the logic to compute this metrics using Pandas"""
        return PandasComputation[Optional[int], Optional[int]](
            create_accumulator=lambda: None,
            update_accumulator=lambda acc, df: MaxLength.update_accumulator(
                acc, df, self.col
            ),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def update_accumulator(
        current_max: Optional[int], df: "pd.DataFrame", column
    ) -> Optional[int]:
        """Computes one DataFrame chunk and updates the running maximum"""
        import pandas as pd
        from numpy import vectorize

        length_vectorize_func = vectorize(len)
        chunk_max = None

        if is_concatenable(column.type):
            max_val = length_vectorize_func(df[column.name].dropna().astype(str)).max()
            if not pd.isnull(max_val):
                chunk_max = max_val

        if chunk_max is None or pd.isnull(chunk_max):
            return current_max

        if current_max is None:
            return chunk_max

        return max(current_max, chunk_max)
