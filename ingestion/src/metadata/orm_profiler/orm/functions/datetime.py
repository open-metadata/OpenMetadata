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
# pylint: disable=duplicate-code
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql import func
from sqlalchemy.sql.functions import FunctionElement

from metadata.orm_profiler.metrics.core import CACHE
from metadata.orm_profiler.orm.registry import Dialects
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class DateAddFn(FunctionElement):
    inherit_cache = CACHE


@compiles(DateAddFn)
def _(elements, compiler, **kwargs):
    """generic date and datetime function"""
    interval = elements.clauses.clauses[0].value
    interval_unit = compiler.process(elements.clauses.clauses[1], **kwargs)
    return f"CAST(CURRENT_DATE - interval '{interval}' {interval_unit}  AS DATE)"


@compiles(DateAddFn, Dialects.Oracle)
def _(elements, compiler, **kwargs):
    """generic date and datetime function"""
    interval = elements.clauses.clauses[0].value
    interval_unit = compiler.process(elements.clauses.clauses[1], **kwargs)
    return f"TO_DATE(CURRENT_DATE - INTERVAL '{interval}' {interval_unit})"


@compiles(DateAddFn, Dialects.BigQuery)
def _(elements, compiler, **kwargs):
    """generic date and datetime function"""
    interval, interval_unit = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return f"CAST(CURRENT_DATE - interval {interval} {interval_unit} AS DATE)"


@compiles(DateAddFn, Dialects.MSSQL)
@compiles(DateAddFn, Dialects.AzureSQL)
@compiles(DateAddFn, Dialects.Snowflake)
def _(elements, compiler, **kwargs):
    """data function for mssql and azuresql"""
    interval, interval_unit = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return f"CAST(DATEADD({interval_unit},-{interval},GETDATE()) AS DATE)"


@compiles(DateAddFn, Dialects.Db2)
@compiles(DateAddFn, Dialects.IbmDbSa)
def _(elements, compiler, **kwargs):
    """data function for DB2"""
    interval, interval_unit = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return f"CAST({func.current_date()} - {interval} {interval_unit} AS DATE)"


@compiles(DateAddFn, Dialects.ClickHouse)
def _(elements, compiler, **kwargs):
    interval = elements.clauses.clauses[0].value
    interval_unit = compiler.process(elements.clauses.clauses[1], **kwargs)
    return f"toDate(NOW() - interval '{interval}' {interval_unit})"


@compiles(DateAddFn, Dialects.Redshift)
def _(elements, compiler, **kwargs):
    interval, interval_unit = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return f"DATEADD({interval_unit}, -{interval}, {func.current_date()})"


class DatetimeAddFn(FunctionElement):
    inherit_cache = CACHE


@compiles(DatetimeAddFn)
def _(elements, compiler, **kwargs):
    """generic date and datetime function"""
    interval = elements.clauses.clauses[0].value
    interval_unit = compiler.process(elements.clauses.clauses[1], **kwargs)
    return (
        f"CAST(CURRENT_TIMESTAMP - interval '{interval}' {interval_unit} AS TIMESTAMP)"
    )


@compiles(DatetimeAddFn, Dialects.BigQuery)
def _(elements, compiler, **kwargs):  # pylint: disable=unused-argument
    """generic date and datetime function"""
    interval = elements.clauses.clauses[0].value
    interval_unit = elements.clauses.clauses[1].text

    # bigquery does not support month or year interval for timestamp
    # we'll do an approximation to get the interval in days.
    if interval_unit.lower() in {"month", "year"}:
        raise ValueError(
            "Bigquery does not support `month` or `year` interval for table partitioned on timestamp",
            "field types. You can set the `interval_unit to day directly from OpenMetadata UI`."
            # pylint: disable=line-too-long
            "Visit https://docs.open-metadata.org/connectors/ingestion/workflows/profiler#4-updating-profiler-setting-at-the-table-level for more details.",
        )

    return f"CAST(CURRENT_TIMESTAMP - interval {interval} {interval_unit} AS TIMESTAMP)"


@compiles(DatetimeAddFn, Dialects.Db2)
@compiles(DatetimeAddFn, Dialects.IbmDbSa)
def _(elements, compiler, **kwargs):
    """generic date and datetime function"""
    interval, interval_unit = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return f"CAST({func.current_timestamp()} - {interval} {interval_unit} AS TIMESTAMP)"


@compiles(DatetimeAddFn, Dialects.ClickHouse)
def _(elements, compiler, **kwargs):
    """generic date and datetime function"""
    interval, interval_unit = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return f"(NOW() - interval {interval} {interval_unit})"


@compiles(DatetimeAddFn, Dialects.AzureSQL)
@compiles(DatetimeAddFn, Dialects.MSSQL)
@compiles(DatetimeAddFn, Dialects.Snowflake)
def _(elements, compiler, **kwargs):
    interval, interval_unit = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return f"DATEADD({interval_unit}, -{interval}, {func.current_timestamp()})"


@compiles(DatetimeAddFn, Dialects.Redshift)
def _(elements, compiler, **kwargs):
    interval, interval_unit = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return (
        f"DATEADD({interval_unit}, -{interval}, {func.current_timestamp()}::timestamp)"
    )


@compiles(DatetimeAddFn, Dialects.SQLite)
def _(elements, compiler, **kwargs):  # pylint: disable=unused-argument
    interval = elements.clauses.clauses[0].value
    interval_unit = elements.clauses.clauses[1].text
    return f"DATE({func.current_timestamp()}, '-{interval} {interval_unit}')"
