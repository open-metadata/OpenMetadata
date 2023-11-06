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
Max Metric definition
"""
# pylint: disable=duplicate-code


from sqlalchemy import TIME, column
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import GenericFunction

from metadata.profiler.metrics.core import CACHE, StaticMetric, _label
from metadata.profiler.orm.functions.length import LenFn
from metadata.profiler.orm.registry import (
    FLOAT_SET,
    Dialects,
    is_concatenable,
    is_date_time,
    is_quantifiable,
)


class MaxFn(GenericFunction):
    name = __qualname__
    inherit_cache = CACHE


@compiles(MaxFn)
def _(element, compiler, **kw):
    col = compiler.process(element.clauses, **kw)
    return f"MAX({col})"


@compiles(MaxFn, Dialects.Trino)
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
        return f"MAX({col})"
    return f"IF(is_nan(MAX({col})), NULL, MAX({col}))"


@compiles(MaxFn, Dialects.MySQL)
@compiles(MaxFn, Dialects.MariaDB)
def _(element, compiler, **kw):
    col = compiler.process(element.clauses, **kw)
    col_type = element.clauses.clauses[0].type
    if isinstance(col_type, TIME):
        # Mysql Sqlalchemy returns timedelta which is not supported pydantic type
        # hence we profile the time by modifying it in seconds
        return f"MAX(TIME_TO_SEC({col}))"
    return f"MAX({col})"


class Max(StaticMetric):
    """
    MAX Metric

    Given a column, return the max value.
    """

    @classmethod
    def name(cls):
        return "max"

    @_label
    def fn(self):
        """sqlalchemy function"""
        if is_concatenable(self.col.type):
            return MaxFn(LenFn(column(self.col.name, self.col.type)))
        if (not is_quantifiable(self.col.type)) and (not is_date_time(self.col.type)):
            return None
        return MaxFn(column(self.col.name, self.col.type))

    def df_fn(self, dfs=None):
        """pandas function"""
        if is_quantifiable(self.col.type) or is_date_time(self.col.type):
            return max((df[self.col.name].max() for df in dfs))
        return 0
