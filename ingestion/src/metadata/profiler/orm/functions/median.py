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
Define Median function
"""
# Keep SQA docs style defining custom constructs
# pylint: disable=consider-using-f-string,duplicate-code
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement
from sqlalchemy.sql.sqltypes import DECIMAL

from metadata.profiler.metrics.core import CACHE
from metadata.profiler.orm.registry import Dialects
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class MedianFn(FunctionElement):
    inherit_cache = CACHE

    @staticmethod
    def default_fn(elements, compiler, **kwargs):  # pylint: disable=unused-argument
        col = compiler.process(elements.clauses.clauses[0])
        percentile = elements.clauses.clauses[2].value
        return "percentile_cont(%.2f) WITHIN GROUP (ORDER BY %s ASC)" % (
            percentile,
            col,
        )


@compiles(MedianFn)
def _(elements, compiler, **kwargs):
    return MedianFn.default_fn(elements, compiler, **kwargs)


@compiles(MedianFn, Dialects.BigQuery)
def _(elements, compiler, **kwargs):
    col, _, percentile = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return "percentile_cont(%s , %s) OVER()" % (col, percentile)


@compiles(MedianFn, Dialects.Databricks)
def _(elements, compiler, **kwargs):
    col, _, percentile = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return "percentile_approx(%s , %s)" % (col, percentile)


# pylint: disable=unused-argument
@compiles(MedianFn, Dialects.Cockroach)
def _(elements, compiler, **kwargs):
    col = compiler.process(elements.clauses.clauses[0])
    percentile = elements.clauses.clauses[2].value
    return "percentile_cont(%.2f) WITHIN GROUP (ORDER BY %s ASC)" % (
        percentile,
        f"(({col})::float8)",
    )


@compiles(MedianFn, Dialects.ClickHouse)
def _(elements, compiler, **kwargs):
    col, _, percentile = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    quantile_str = f"quantile({percentile})({col})"
    null_check = (
        "isNull" if isinstance(elements.clauses.clauses[0].type, DECIMAL) else "isNaN"
    )
    return f"if({null_check}({quantile_str}), null, {quantile_str})"


@compiles(MedianFn, Dialects.Druid)
def _(elements, compiler, **kwargs):
    col, _, percentile = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return f"APPROX_QUANTILE({col}, {percentile})"


# pylint: disable=unused-argument
@compiles(MedianFn, Dialects.Athena)
@compiles(MedianFn, Dialects.Presto)
def _(elements, compiler, **kwargs):
    col = compiler.process(elements.clauses.clauses[0])
    percentile = elements.clauses.clauses[2].value
    return "approx_percentile(%s, %.2f)" % (col, percentile)


@compiles(MedianFn, Dialects.Trino)
def _(elements, compiler, **kwargs):
    col = compiler.process(elements.clauses.clauses[0])
    percentile = elements.clauses.clauses[2].value
    return "IF(count(%s) = 0, NULL, approx_percentile(%s, %.2f))" % (
        col,
        col,
        percentile,
    )


@compiles(MedianFn, Dialects.Vertica)
@compiles(MedianFn, Dialects.MSSQL)
def _(elements, compiler, **kwargs):
    """Median computation for MSSQL & Vertica"""
    col = compiler.process(elements.clauses.clauses[0])
    percentile = elements.clauses.clauses[2].value
    return "percentile_cont(%.2f) WITHIN GROUP (ORDER BY %s ASC) OVER()" % (
        percentile,
        col,
    )


@compiles(MedianFn, Dialects.Hive)
def _(elements, compiler, **kwargs):
    """Median computation for Hive"""
    col, _, percentile = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return "percentile(cast(%s as BIGINT), %s)" % (col, percentile)


@compiles(MedianFn, Dialects.Impala)
def _(elements, compiler, **kwargs):
    """Median computation for Impala
    Median compution for Impala uses the appx_median function.
    OM uses this median function to also compute first and third quartiles.
    These calculations are not supported with a simple function inside Impala.
    The if statement returns null when we are not looking for the .5 precentile
    In Impala to get the first quartile a full SQL statement like this is necessary:
        with ntiles as
        (
        select filesize, ntile(4) over (order by filesize) as quarter
        from hdfs_files
        )
        , quarters as
        (
        select 1 as grp, max(filesize) as quartile_value, quarter
            from ntiles
        group by quarter
        )
        select max(case when quarter = 1 then quartile_value end) as first_q
        , max(case when quarter = 2 then quartile_value end) as second_q
        , max(case when quarter = 3 then quartile_value end) as third_q
        , max(case when quarter = 4 then quartile_value end) as fourth_q
        from quarters
        group by grp
        ;
    """
    col, _, percentile = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return f"if({percentile} = .5, appx_median({col}), null)"


@compiles(MedianFn, Dialects.MySQL)
def _(elements, compiler, **kwargs):  # pylint: disable=unused-argument
    """Median computation for MySQL"""
    col = compiler.process(elements.clauses.clauses[0])
    table = elements.clauses.clauses[1].value
    percentile = elements.clauses.clauses[2].value

    return """
    (SELECT
        {col}
    FROM (
        SELECT
            {col}, 
            ROW_NUMBER() OVER () AS row_num
        FROM 
            {table},
            (SELECT @counter := COUNT(*) FROM {table}) t_count 
        ORDER BY {col}
        ) temp
    WHERE temp.row_num = ROUND({percentile} * @counter)
    )
    """.format(
        col=col, table=table, percentile=percentile
    )


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


@compiles(MedianFn, Dialects.Doris)
def _(elements, compiler, **kwargs):
    col = compiler.process(elements.clauses.clauses[0])
    percentile = elements.clauses.clauses[2].value
    return "percentile_approx(%s, %.2f)" % (col, percentile)
