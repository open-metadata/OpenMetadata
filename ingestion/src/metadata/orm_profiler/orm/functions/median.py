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
Define Median function
"""
# Keep SQA docs style defining custom constructs
# pylint: disable=consider-using-f-string,duplicate-code
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.orm_profiler.metrics.core import CACHE
from metadata.orm_profiler.orm.registry import Dialects
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class MedianFn(FunctionElement):
    inherit_cache = CACHE


@compiles(MedianFn)
def _(elements, compiler, **kwargs):
    col, _ = [compiler.process(element, **kwargs) for element in elements.clauses]
    return "percentile_cont(0.5)  WITHIN GROUP (ORDER BY %s ASC)" % col


@compiles(MedianFn, Dialects.BigQuery)
def _(elements, compiler, **kwargs):
    col, _ = [compiler.process(element, **kwargs) for element in elements.clauses]
    return "percentile_cont(%s , 0.5) OVER()" % col


@compiles(MedianFn, Dialects.Athena)
@compiles(MedianFn, Dialects.ClickHouse)
def _(elements, compiler, **kwargs):
    col, _ = [compiler.process(element, **kwargs) for element in elements.clauses]
    return "median(%s)" % col


@compiles(MedianFn, Dialects.Trino)
@compiles(MedianFn, Dialects.Presto)
def _(elements, compiler, **kwargs):
    col, _ = [compiler.process(element, **kwargs) for element in elements.clauses]
    return "approx_percentile(%s, 0.5)" % col


@compiles(MedianFn, Dialects.MSSQL)
def _(elements, compiler, **kwargs):
    """Median computation for MSSQL"""
    col, _ = [compiler.process(element, **kwargs) for element in elements.clauses]
    return "percentile_cont(0.5)  WITHIN GROUP (ORDER BY %s ASC) OVER()" % col


@compiles(MedianFn, Dialects.SQLite)
def _(elements, compiler, **kwargs):
    col, table = [element for element in elements.clauses]
    return """
    (SELECT 
        AVG({col})
    FROM (
        SELECT {col}
            FROM {table}
        ORDER BY {col}
            LIMIT 2 - (SELECT COUNT(*) FROM {table}) % 2
            OFFSET (SELECT (COUNT(*) - 1) / 2
                FROM {table})))
    """.format(
        col=col, table=table.value
    )
