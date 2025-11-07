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

import traceback
from typing import TYPE_CHECKING

from sqlalchemy import case, column

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.metrics.pandas_metric_protocol import PandasComputation
from metadata.profiler.orm.functions.regexp import RegexpMatchFn
from metadata.profiler.orm.functions.sum import SumFn
from metadata.profiler.orm.registry import is_concatenable
from metadata.utils.logger import profiler_logger

if TYPE_CHECKING:
    import pandas as pd

logger = profiler_logger()


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
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error trying to run RegExp Match Count for {self.col.name}: {err}"
                )
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        """Returns the logic to compute this metric using Pandas"""
        if not hasattr(self, "expression"):
            raise AttributeError(
                "Regex Count requires an expression to be set: add_props(expression=...)(Metrics.REGEX_COUNT)"
            )

        return PandasComputation[int, int](
            create_accumulator=lambda: 0,
            update_accumulator=lambda acc, df: RegexCount.update_accumulator(
                acc, df, self.col, self.expression
            ),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def update_accumulator(
        running_count: int, df: "pd.DataFrame", column, expression: str
    ) -> int:
        """Computes one DataFrame chunk and updates the running count

        Maintains a single running total (not a list). Adds chunk's count
        to the current total and returns the updated sum.
        """
        if not is_concatenable(column.type):
            raise TypeError(
                f"Don't know how to process type {column.type} when computing RegExp Match Count"
            )
        chunk_count = (
            df[column.name].astype(str).str.contains(expression, na=False).sum()
        )
        return running_count + chunk_count
