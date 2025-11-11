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
AVG Metric definition
"""
from functools import partial
from typing import TYPE_CHECKING, Callable, NamedTuple, Optional

from sqlalchemy import column
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import GenericFunction

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.generated.schema.entity.data.table import Table
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor
from metadata.profiler.metrics.core import CACHE, StaticMetric, T, _label
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

# pylint: disable=duplicate-code

if TYPE_CHECKING:
    import pandas as pd


logger = profiler_logger()


class SumAndCount(NamedTuple):
    """Running sum and count for computing mean efficiently"""

    sum_value: float
    count_value: int


class AvgFn(GenericFunction):
    name = "avg"
    inherit_cache = CACHE


@compiles(AvgFn, Dialects.ClickHouse)
def _(element, compiler, **kw):
    """Handle case for empty table. If empty, clickhouse returns NaN"""
    proc = compiler.process(element.clauses, **kw)
    return f"if(isNaN(avg({proc})), null, avg({proc}))"


@compiles(AvgFn, Dialects.Redshift)
def _(element, compiler, **kw):
    """
    Cast to decimal to get around potential integer overflow error
    """
    proc = compiler.process(element.clauses, **kw)
    return f"avg(CAST({proc} AS DECIMAL(38,0)))"


@compiles(AvgFn, Dialects.MSSQL)
def _(element, compiler, **kw):
    """
    Cast to decimal to get around potential integer overflow error -
    Error 8115: Arithmetic overflow error converting expression to data type int.
    """
    proc = compiler.process(element.clauses, **kw)
    return f"avg(cast({proc} as decimal))"


@compiles(AvgFn, Dialects.Trino)
def _(element, compiler, **kw):
    proc = compiler.process(element.clauses, **kw)
    first_clause = element.clauses.clauses[0]
    # Check if the first clause is an instance of LenFn and its type is not in FLOAT_SET
    # or if the type of the first clause is date time
    if (
        isinstance(first_clause, LenFn)
        and type(first_clause.clauses.clauses[0].type) not in FLOAT_SET
    ) or is_date_time(first_clause.type):
        # If the condition is true, return the mean value of the column
        return f"avg({proc})"
    return f"IF(is_nan(avg({proc})), NULL, avg({proc}))"


class Mean(StaticMetric):
    """
    AVG Metric

    Given a column, return the AVG value.

    - For a quantifiable value, return the usual AVG
    - For a concatenable (str, text...) return the AVG length
    """

    @classmethod
    def name(cls):
        return MetricType.mean.value

    @property
    def metric_type(self):
        return float

    @_label
    def fn(self):
        """sqlalchemy function"""
        if is_quantifiable(self.col.type):
            return AvgFn(column(self.col.name, self.col.type))

        if is_concatenable(self.col.type):
            return AvgFn(LenFn(column(self.col.name, self.col.type)))

        logger.debug(
            f"Don't know how to process type {self.col.type} when computing MEAN"
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
                    f"Error while computing mean for column {self.col.name}: {err}"
                )
                return None
        mean = computation.aggregate_accumulator(accumulator)

        if mean is None:
            logger.warning(
                f"Don't know how to process type {self.col.type} when computing MEAN"
            )
            return None
        return mean

    def get_pandas_computation(self) -> PandasComputation:
        return PandasComputation[SumAndCount, Optional[float]](
            create_accumulator=lambda: SumAndCount(0.0, 0),
            update_accumulator=lambda acc, df: Mean.update_accumulator(
                acc, df, self.col
            ),
            aggregate_accumulator=Mean.aggregate_accumulator,
        )

    @staticmethod
    def update_accumulator(
        sum_and_count: SumAndCount, df: "pd.DataFrame", column
    ) -> SumAndCount:
        """Optimized accumulator: maintains running sum and count (O(1) memory)

        Instead of storing per-chunk means, directly accumulates sum and count.
        This reduces memory from O(chunks) to O(1).
        """
        import pandas as pd
        from numpy import vectorize

        length_vectorize_func = vectorize(len)
        clean_df = df[column.name].dropna()

        if clean_df.empty:
            return sum_and_count

        chunk_count = clean_df.count()
        chunk_sum = None

        if is_quantifiable(column.type):
            chunk_sum = clean_df.sum()
        elif is_concatenable(column.type):
            chunk_sum = length_vectorize_func(clean_df.astype(str)).sum()

        if chunk_sum is None or pd.isnull(chunk_sum):
            return sum_and_count

        return SumAndCount(
            sum_value=sum_and_count.sum_value + chunk_sum,
            count_value=sum_and_count.count_value + chunk_count,
        )

    @staticmethod
    def aggregate_accumulator(
        sum_and_count: SumAndCount,
    ) -> Optional[float]:
        """Compute final mean from running sum and count"""
        if sum_and_count.count_value == 0:
            return None
        return sum_and_count.sum_value / sum_and_count.count_value

    def nosql_fn(self, adaptor: NoSQLAdaptor) -> Callable[[Table], Optional[T]]:
        """nosql function"""
        if is_quantifiable(self.col.type):
            return partial(adaptor.mean, column=self.col)
        return lambda table: None
