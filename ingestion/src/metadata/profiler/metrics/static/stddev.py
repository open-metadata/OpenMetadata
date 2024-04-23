#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
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


from sqlalchemy import column
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import CACHE, StaticMetric, _label
from metadata.profiler.orm.functions.length import LenFn
from metadata.profiler.orm.registry import (
    FLOAT_SET,
    Dialects,
    is_concatenable,
    is_date_time,
    is_quantifiable,
)
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


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
    This actually returns the squared STD, but as
    it is only required for tests we can live with it.
    """

    proc = compiler.process(element.clauses, **kw)
    return "AVG(%s * %s) - AVG(%s) * AVG(%s)" % ((proc,) * 4)


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
        import pandas as pd  # pylint: disable=import-outside-toplevel

        if is_quantifiable(self.col.type):
            try:
                df = pd.to_numeric(pd.concat(df[self.col.name] for df in dfs))
                if not df.empty:
                    return df.std()
                return None
            except MemoryError:
                logger.error(
                    f"Unable to compute Standard Deviation for {self.col.name} due to memory constraints."
                    f"We recommend using a smaller sample size or partitionning."
                )
                return None

        logger.debug(
            f"{self.col.name} has type {self.col.type}, which is not listed as quantifiable."
            + " We won't compute STDDEV for it."
        )
        return None
