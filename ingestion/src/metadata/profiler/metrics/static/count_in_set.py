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
CountInSet Metric definition
"""
# pylint: disable=duplicate-code
import traceback
from typing import TYPE_CHECKING, List

from sqlalchemy import case, column

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.metrics.pandas_metric_protocol import PandasComputation
from metadata.profiler.orm.functions.sum import SumFn
from metadata.utils.logger import profiler_logger

if TYPE_CHECKING:
    import pandas as pd

logger = profiler_logger()


class CountInSet(StaticMetric):
    """
    COUNT_IN_SET Metric

    Given a column, return the count of values in a given set.

    This Metric needs to be initialised passing the values to look for
    the count:
    add_props(values=["John"])(Metrics.COUNT_IN_SET.value)
    """

    values: List[str]

    @classmethod
    def name(cls):
        return MetricType.countInSet.value

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        """sqlalchemy function"""
        if not hasattr(self, "values"):
            raise AttributeError(
                "CountInSet requires a set of values to be validate: add_props(values=...)(Metrics.COUNT_IN_SET)"
            )

        try:
            set_values = set(self.values)
            return SumFn(
                case(
                    [(column(self.col.name, self.col.type).in_(set_values), 1)], else_=0
                )
            )

        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error trying to run countInSet for {self.col.name}: {exc}")
            return None

    def df_fn(self, dfs=None):
        """pandas function"""
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error trying to run countInSet for {self.col.name}: {err}"
                )
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        """Returns the logic to compute this metrics using Pandas"""
        if not hasattr(self, "values"):
            raise AttributeError(
                "CountInSet requires a set of values to be validate: add_props(values=...)(Metrics.COUNT_IN_SET)"
            )

        return PandasComputation[int, int](
            create_accumulator=lambda: 0,
            update_accumulator=lambda acc, df: CountInSet.update_accumulator(
                acc, df, self.col, self.values
            ),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def update_accumulator(
        running_count: int, df: "pd.DataFrame", column, values: List[str]
    ) -> int:
        """Computes one DataFrame chunk and updates the running count

        Maintains a single running total (not a list). Adds chunk's count
        to the current total and returns the updated sum.
        """
        chunk_count = sum(df[column.name].isin(values))
        return running_count + chunk_count
