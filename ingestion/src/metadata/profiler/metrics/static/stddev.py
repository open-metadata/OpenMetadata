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
Population Standard deviation Metric definition
"""

# Keep SQA docs style defining custom constructs
# pylint: disable=consider-using-f-string,duplicate-code

import math
from typing import TYPE_CHECKING, NamedTuple, Optional

from sqlalchemy import column
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import CACHE, StaticMetric, _label
from metadata.profiler.metrics.pandas_metric_protocol import PandasComputation
from metadata.profiler.orm.functions.length import LenFn
from metadata.profiler.orm.registry import (
    FLOAT_SET,
    Dialects,
    is_concatenable,
    is_date_time,
    is_quantifiable,
)
from metadata.utils.logger import profiler_logger

if TYPE_CHECKING:
    import pandas as pd

logger = profiler_logger()


class SumSumSquaresCount(NamedTuple):
    """Running sum, sum of squares, and count for computing stddev efficiently"""

    sum_value: float
    sum_squares_value: float
    count_value: int


class StdDevFn(FunctionElement):
    name = __qualname__
    inherit_cache = CACHE


@compiles(StdDevFn)
def _(element, compiler, **kw):
    return "STDDEV_POP(%s)" % compiler.process(element.clauses, **kw)


@compiles(StdDevFn, Dialects.MSSQL)
def _(element, compiler, **kw):
    return "STDEVP(%s)" % compiler.process(element.clauses, **kw)


@compiles(StdDevFn, Dialects.SQLite)  # Needed for unit tests
def _(element, compiler, **kw):
    """
    SQLite standard deviation using computational formula.
    Requires SQRT function (registered via tests/unit/conftest.py for unit tests).
    """
    proc = compiler.process(element.clauses, **kw)
    return "SQRT(AVG(%s * %s) - AVG(%s) * AVG(%s))" % ((proc,) * 4)


@compiles(StdDevFn, Dialects.Trino)
def _(element, compiler, **kw):
    proc = compiler.process(element.clauses, **kw)
    first_clause = element.clauses.clauses[0]
    # Check if the first clause is an instance of LenFn and its type is not in FLOAT_SET
    # or if the type of the first clause is date time
    if (
        isinstance(first_clause, LenFn)
        and type(first_clause.clauses.clauses[0].type) not in FLOAT_SET
    ) or is_date_time(first_clause.type):
        # If the condition is true, return the stddev value of the column
        return f"STDDEV_POP({proc})"
    return f"IF(is_nan(STDDEV_POP({proc})), NULL, STDDEV_POP({proc}))"


@compiles(StdDevFn, Dialects.ClickHouse)
def _(element, compiler, **kw):
    """Returns stdv for clickhouse database and handle empty tables.
    If table is empty, clickhouse returns NaN.
    """
    proc = compiler.process(element.clauses, **kw)
    return "if(isNaN(stddevPop(%s)), null, stddevPop(%s))" % ((proc,) * 2)


@compiles(StdDevFn, Dialects.Druid)
def _(element, compiler, **kw):  # pylint: disable=unused-argument
    """returns  stdv for druid. Could not validate with our cluster
    we might need to look into installing the druid-stats module
    https://druid.apache.org/docs/latest/configuration/extensions/#loading-extensions
    """
    return "NULL"


class StdDev(StaticMetric):
    """
    STD Metric

    Given a column, return the Standard Deviation value.
    """

    @classmethod
    def name(cls):
        return MetricType.stddev.value

    @property
    def metric_type(self):
        return float

    @_label
    def fn(self):
        """sqlalchemy function"""
        if is_quantifiable(self.col.type):
            return StdDevFn(column(self.col.name, self.col.type))

        if is_concatenable(self.col.type):
            return StdDevFn(LenFn(column(self.col.name, self.col.type)))

        logger.debug(
            f"{self.col} has type {self.col.type}, which is not listed as quantifiable."
            + " We won't compute STDDEV for it."
        )
        return None

    def df_fn(self, dfs=None):
        """pandas function"""
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except MemoryError:
                logger.error(
                    f"Unable to compute 'Standard Deviation' for {self.col.name} due to memory constraints."
                    f"We recommend using a smaller sample size or partitionning."
                )
                return None
            except Exception as err:
                logger.debug(
                    f"Error while computing 'Standard Deviation' for column {self.col.name}: {err}"
                )
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        """Get pandas computation with accumulator for efficient stddev calculation

        Returns:
            PandasComputation: Computation protocol with create/update/aggregate methods
        """
        return PandasComputation[SumSumSquaresCount, Optional[float]](
            create_accumulator=lambda: SumSumSquaresCount(0.0, 0.0, 0),
            update_accumulator=lambda acc, df: StdDev.update_accumulator(
                acc, df, self.col
            ),
            aggregate_accumulator=StdDev.aggregate_accumulator,
        )

    @staticmethod
    def update_accumulator(
        sum_sum_squares_count: SumSumSquaresCount, df: "pd.DataFrame", column
    ) -> SumSumSquaresCount:
        """Optimized accumulator: maintains running sum, sum of squares, and count

        Instead of concatenating dataframes, directly accumulates the necessary
        statistics for computing standard deviation. This is memory efficient (O(1))
        and enables proper aggregation of "Others" in dimensional validation.

        Formula for variance across multiple groups:
        variance = (sum_squares / count) - (sum / count)²
        stddev = √variance

        Args:
            sum_sum_squares_count: Current accumulator state
            df: DataFrame chunk to process
            column: Column to compute stddev for

        Returns:
            Updated accumulator with new chunk's statistics added
        """
        import pandas as pd

        clean_df = df[column.name].dropna()

        if clean_df.empty:
            return sum_sum_squares_count

        chunk_count = len(clean_df)

        if is_quantifiable(column.type):
            numeric_df = pd.to_numeric(clean_df, errors="coerce").dropna()
            if numeric_df.empty:
                return sum_sum_squares_count

            chunk_sum = numeric_df.sum()
            chunk_sum_squares = (numeric_df**2).sum()
            chunk_count = len(numeric_df)

        else:
            return sum_sum_squares_count

        if pd.isnull(chunk_sum) or pd.isnull(chunk_sum_squares):
            return sum_sum_squares_count

        return SumSumSquaresCount(
            sum_value=sum_sum_squares_count.sum_value + chunk_sum,
            sum_squares_value=sum_sum_squares_count.sum_squares_value
            + chunk_sum_squares,
            count_value=sum_sum_squares_count.count_value + chunk_count,
        )

    @staticmethod
    def aggregate_accumulator(
        sum_sum_squares_count: SumSumSquaresCount,
    ) -> Optional[float]:
        """Compute final stddev from running sum, sum of squares, and count

        Uses the computational formula for variance:
        variance = E[X²] - E[X]²
                 = (sum_squares / count) - (sum / count)²

        Args:
            sum_sum_squares_count: Accumulated statistics

        Returns:
            Population standard deviation, or None if no data
        """
        if sum_sum_squares_count.count_value == 0:
            return None

        mean = sum_sum_squares_count.sum_value / sum_sum_squares_count.count_value
        mean_of_squares = (
            sum_sum_squares_count.sum_squares_value / sum_sum_squares_count.count_value
        )

        variance = mean_of_squares - (mean**2)

        # Handle floating point precision issues
        if variance < 0:
            if abs(variance) < 1e-10:  # Close to zero due to floating point
                variance = 0
            else:
                logger.warning(
                    f"Negative variance ({variance}) encountered, returning None"
                )
                return None

        return math.sqrt(variance)
