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
AVG Metric definition
"""
# pylint: disable=duplicate-code


import math

from sqlalchemy import column, func
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import GenericFunction

from metadata.profiler.metrics.core import CACHE, StaticMetric, _label
from metadata.profiler.orm.functions.length import LenFn
from metadata.profiler.orm.registry import Dialects, is_concatenable, is_quantifiable
from metadata.utils.logger import profiler_logger

logger = profiler_logger()

# pylint: disable=invalid-name
class avg(GenericFunction):
    name = "avg"
    inherit_cache = CACHE


@compiles(avg, Dialects.ClickHouse)
def _(element, compiler, **kw):
    """Handle case for empty table. If empty, clickhouse returns NaN"""
    proc = compiler.process(element.clauses, **kw)
    return f"if(isNaN(avg({proc})), null, avg({proc}))"


@compiles(avg, Dialects.MSSQL)
def _(element, compiler, **kw):
    """
    Cast to decimal to get around potential integer overflow error -
    Error 8115: Arithmetic overflow error converting expression to data type int.
    """
    proc = compiler.process(element.clauses, **kw)
    return f"avg(cast({proc} as decimal))"


class Mean(StaticMetric):
    """
    AVG Metric

    Given a column, return the AVG value.

    - For a quantifiable value, return the usual AVG
    - For a concatenable (str, text...) return the AVG length
    """

    @classmethod
    def name(cls):
        return "mean"

    @property
    def metric_type(self):
        return float

    @_label
    def fn(self):
        """sqlalchemy function"""
        if is_quantifiable(self.col.type):
            return func.avg(column(self.col.name))

        if is_concatenable(self.col.type):
            return func.avg(LenFn(column(self.col.name)))

        logger.debug(
            f"Don't know how to process type {self.col.type} when computing MEAN"
        )
        return None

    # pylint: disable=import-outside-toplevel
    def df_fn(self, dfs=None):
        """dataframe function"""
        from numpy import vectorize

        length_vectorize_func = vectorize(len)
        total_len = sum(df[self.col.name].dropna().shape[0] for df in dfs)
        if is_quantifiable(self.col.type):
            result = [
                df[self.col.name].dropna().mean() * df.shape[0] / total_len
                for df in dfs
                if df[self.col.name].dropna().any()
            ]
            return sum(filter(lambda x: not math.isnan(x), result))

        if is_concatenable(self.col.type):
            result = [
                length_vectorize_func(df[self.col.name].dropna()).mean()
                * df.shape[0]
                / total_len
                for df in dfs
                if df[self.col.name].dropna().any()
            ]

            return sum(filter(lambda x: not math.isnan(x), result))

        logger.warning(
            f"Don't know how to process type {self.col.type} when computing MEAN"
        )
        return 0
