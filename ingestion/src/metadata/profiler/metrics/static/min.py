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
Min Metric definition
"""
from functools import partial
from typing import Callable, Optional

from sqlalchemy import TIME, column
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import GenericFunction

from metadata.generated.schema.entity.data.table import Table
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor
from metadata.profiler.metrics.core import CACHE, StaticMetric, T, _label
from metadata.profiler.orm.functions.length import LenFn
from metadata.profiler.orm.registry import (
    FLOAT_SET,
    Dialects,
    is_concatenable,
    is_date_time,
    is_quantifiable,
)

# pylint: disable=duplicate-code


class MinFn(GenericFunction):
    name = __qualname__
    inherit_cache = CACHE


@compiles(MinFn)
def _(element, compiler, **kw):
    col = compiler.process(element.clauses, **kw)
    return f"MIN({col})"


@compiles(MinFn, Dialects.Trino)
def _(element, compiler, **kw):
    col = compiler.process(element.clauses, **kw)
    first_clause = element.clauses.clauses[0]
    # Check if the first clause is an instance of LenFn and its type is not in FLOAT_SET
    # or if the type of the first clause is date time
    if (
        isinstance(first_clause, LenFn)
        and type(first_clause.clauses.clauses[0].type) not in FLOAT_SET
    ) or is_date_time(first_clause.type):
        # If the condition is true, return the minimum value of the column
        return f"MIN({col})"
    return f"IF(is_nan(MIN({col})), NULL, MIN({col}))"


@compiles(MinFn, Dialects.MySQL)
@compiles(MinFn, Dialects.MariaDB)
def _(element, compiler, **kw):
    col = compiler.process(element.clauses, **kw)
    col_type = element.clauses.clauses[0].type
    if isinstance(col_type, TIME):
        # Mysql Sqlalchemy returns timedelta which is not supported pydantic type
        # hence we profile the time by modifying it in seconds
        return f"MIN(TIME_TO_SEC({col}))"
    return f"MIN({col})"


class Min(StaticMetric):
    """
    MIN Metric

    Given a column, return the min value.
    """

    @classmethod
    def name(cls):
        return "min"

    @_label
    def fn(self):
        """sqlalchemy function"""
        if is_concatenable(self.col.type):
            return MinFn(LenFn(column(self.col.name, self.col.type)))

        if (not is_quantifiable(self.col.type)) and (not is_date_time(self.col.type)):
            return None
        return MinFn(column(self.col.name, self.col.type))

    def df_fn(self, dfs=None):
        """pandas function"""
        if is_quantifiable(self.col.type):
            return min((df[self.col.name].min() for df in dfs))
        if is_date_time(self.col.type):
            min_ = min((df[self.col.name].min() for df in dfs))
            return int(min_.timestamp() * 1000)
        return 0

    def nosql_fn(self, adaptor: NoSQLAdaptor) -> Callable[[Table], Optional[T]]:
        """nosql function"""
        if is_quantifiable(self.col.type):
            return partial(adaptor.min, column=self.col)
        return lambda table: None
