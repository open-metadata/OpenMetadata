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

from metadata.profiler.metrics.core import CACHE
from metadata.profiler.orm.registry import Dialects
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class MedianFn(FunctionElement):
    inherit_cache = CACHE


@compiles(MedianFn)
def _(elements, compiler, **kwargs):  # pylint: disable=unused-argument
    col = compiler.process(elements.clauses.clauses[0])
    percentile = elements.clauses.clauses[2].value
    return "percentile_cont(%.1f) WITHIN GROUP (ORDER BY %s ASC)" % (percentile, col)


@compiles(MedianFn, Dialects.BigQuery)
def _(elements, compiler, **kwargs):
    col, _, percentile = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return "percentile_cont(%s , %s) OVER()" % (col, percentile)


@compiles(MedianFn, Dialects.ClickHouse)
def _(elements, compiler, **kwargs):
    col, _, percentile = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return "quantile(%s)(%s)" % (percentile, col)


# pylint: disable=unused-argument
@compiles(MedianFn, Dialects.Athena)
@compiles(MedianFn, Dialects.Trino)
@compiles(MedianFn, Dialects.Presto)
def _(elements, compiler, **kwargs):
    col = elements.clauses.clauses[0].name
    percentile = elements.clauses.clauses[2].value
    return 'approx_percentile("%s", %.1f)' % (col, percentile)


@compiles(MedianFn, Dialects.MSSQL)
def _(elements, compiler, **kwargs):
    """Median computation for MSSQL"""
    col = elements.clauses.clauses[0].name
    percentile = elements.clauses.clauses[2].value
    return "percentile_cont(%.1f) WITHIN GROUP (ORDER BY %s ASC) OVER()" % (
        percentile,
        col,
    )


@compiles(MedianFn, Dialects.Hive)
@compiles(MedianFn, Dialects.Impala)
def _(elements, compiler, **kwargs):
    """Median computation for Hive"""
    col, _, percentile = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return "percentile(cast(%s as BIGINT), %s)" % (col, percentile)


@compiles(MedianFn, Dialects.MySQL)
def _(elements, compiler, **kwargs):  # pylint: disable=unused-argument
    """Median computation for MySQL currently not supported
    Needs to be tackled in https://github.com/open-metadata/OpenMetadata/issues/6340
    """
    return "NULL"


@compiles(MedianFn, Dialects.SQLite)
def _(elements, compiler, **kwargs):  # pylint: disable=unused-argument
    col = compiler.process(elements.clauses.clauses[0])
    table = elements.clauses.clauses[1].value
    percentile = elements.clauses.clauses[2].value

    return """
    (SELECT 
        {col}
    FROM {table}
    WHERE {col} IS NOT NULL
    ORDER BY {col}
    LIMIT 1
    OFFSET (
            SELECT ROUND(COUNT(*) * {percentile} -1)
            FROM {table}
            WHERE {col} IS NOT NULL
        )
    )
    """.format(
        col=col, table=table, percentile=percentile
    )
