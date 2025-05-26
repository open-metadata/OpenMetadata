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
# pylint: disable=duplicate-code
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql import func
from sqlalchemy.sql.functions import FunctionElement

from metadata.profiler.metrics.core import CACHE
from metadata.profiler.orm.registry import Dialects
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


# --------------
# Date Functions
# --------------
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


@compiles(DateAddFn, Dialects.SQLite)
def _(elements, compiler, **kwargs):  # pylint: disable=unused-argument
    interval = elements.clauses.clauses[0].value
    interval_unit = elements.clauses.clauses[1].text
    return f"DATE({func.current_date()}, '-{interval} {interval_unit}')"


# ------------------
# Datetime Functions
# ------------------
class DatetimeAddFn(FunctionElement):
    inherit_cache = CACHE


@compiles(DatetimeAddFn)
def _(elements, compiler, **kwargs):
    """generic date and datetime function"""
    return generic_function(elements, compiler, **kwargs)


@compiles(DatetimeAddFn, Dialects.MySQL)
def _(elements, compiler, **kwargs):
    """MySQL date and datetime function"""
    return mysql_function(elements, compiler, **kwargs)


@compiles(DatetimeAddFn, Dialects.BigQuery)
def _(elements, compiler, **kwargs):  # pylint: disable=unused-argument
    """BigQuery date and datetime function"""
    interval = elements.clauses.clauses[0].value
    interval_unit = elements.clauses.clauses[1].text

    return (
        f"DATETIME_SUB({func.current_datetime()}, INTERVAL {interval} {interval_unit})"
    )


@compiles(DatetimeAddFn, Dialects.Db2)
@compiles(DatetimeAddFn, Dialects.IbmDbSa)
def _(elements, compiler, **kwargs):
    """DB2 datetime function"""
    return db2_function(elements, compiler, **kwargs)


@compiles(DatetimeAddFn, Dialects.ClickHouse)
def _(elements, compiler, **kwargs):
    """Clickhouse datetime function"""
    return clickhouse_function(elements, compiler, **kwargs)


@compiles(DatetimeAddFn, Dialects.AzureSQL)
@compiles(DatetimeAddFn, Dialects.MSSQL)
@compiles(DatetimeAddFn, Dialects.Snowflake)
def _(elements, compiler, **kwargs):
    """AzreSQL, MSSQL, Snowflake datetime function"""
    return azure_mssql_snflk_function(elements, compiler, **kwargs)


@compiles(DatetimeAddFn, Dialects.Redshift)
def _(elements, compiler, **kwargs):
    """Redshift datetime function"""
    return redshift_function(elements, compiler, **kwargs)


@compiles(DatetimeAddFn, Dialects.SQLite)
def _(elements, compiler, **kwargs):
    """SQLite datetime function"""
    return sqlite_function(elements, compiler, **kwargs)


# -------------------
# Timestamp Functions
# -------------------
class TimestampAddFn(FunctionElement):
    inherit_cache = CACHE


@compiles(TimestampAddFn)
def _(elements, compiler, **kwargs):
    """Generic timestamp function"""
    return generic_function(elements, compiler, **kwargs)


@compiles(TimestampAddFn, Dialects.BigQuery)
def _(elements, compiler, **kwargs):  # pylint: disable=unused-argument
    """Bigquery timestamp function"""
    interval = elements.clauses.clauses[0].value
    interval_unit = elements.clauses.clauses[1].text

    # bigquery does not support month or year interval for timestamp.
    if interval_unit.lower() in {"year", "month"}:
        raise ValueError(
            "Bigquery does not support `month` or `year` interval for table partitioned on timestamp",
            "field types. You can set the `interval_unit to day or hour directly from OpenMetadata UI`."
            # pylint: disable=line-too-long
            "Visit https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow#4-updating-profiler-setting-at-the-table-level for more details.",
        )

    return (
        f"DATETIME_SUB({func.current_timestamp()}, INTERVAL {interval} {interval_unit})"
    )


@compiles(TimestampAddFn, Dialects.MySQL)
def _(elements, compiler, **kwargs):
    """MySQL timestamp function"""
    return mysql_function(elements, compiler, **kwargs)


@compiles(TimestampAddFn, Dialects.Db2)
@compiles(TimestampAddFn, Dialects.IbmDbSa)
def _(elements, compiler, **kwargs):
    """DB2 timestamp function"""
    return db2_function(elements, compiler, **kwargs)


@compiles(TimestampAddFn, Dialects.ClickHouse)
def _(elements, compiler, **kwargs):
    """Clickhouse datetime function"""
    return clickhouse_function(elements, compiler, **kwargs)


@compiles(TimestampAddFn, Dialects.AzureSQL)
@compiles(TimestampAddFn, Dialects.MSSQL)
@compiles(TimestampAddFn, Dialects.Snowflake)
def _(elements, compiler, **kwargs):
    """Azure SQL, MSSQL and Snowflake timestamp function"""
    return azure_mssql_snflk_function(elements, compiler, **kwargs)


@compiles(TimestampAddFn, Dialects.Redshift)
def _(elements, compiler, **kwargs):
    """Redshift timestamp function"""
    return redshift_function(elements, compiler, **kwargs)


@compiles(TimestampAddFn, Dialects.SQLite)
def _(elements, compiler, **kwargs):
    """SQLite timestamp function"""
    return sqlite_function(elements, compiler, **kwargs)


# -----------------------------------
# Shared timestamp/datetime Functions
# -----------------------------------
def generic_function(elements, compiler, **kwargs):
    """generic date and datetime function"""
    interval = elements.clauses.clauses[0].value
    interval_unit = compiler.process(elements.clauses.clauses[1], **kwargs)
    return (
        f"CAST(CURRENT_TIMESTAMP - interval '{interval}' {interval_unit} AS TIMESTAMP)"
    )


def mysql_function(elements, compiler, **kwargs):
    """MySQL timestamp and datetime function"""
    interval = elements.clauses.clauses[0].value
    interval_unit = compiler.process(elements.clauses.clauses[1], **kwargs)
    return (
        f"CAST(CURRENT_TIMESTAMP - interval '{interval}' {interval_unit} AS DATETIME)"
    )


def sqlite_function(elements, compiler, **kwargs):  # pylint: disable=unused-argument
    """SQLite timestamp and datetime function"""
    interval = elements.clauses.clauses[0].value
    interval_unit = elements.clauses.clauses[1].text
    return f"DATE({func.current_timestamp()}, '-{interval} {interval_unit}')"


def redshift_function(elements, compiler, **kwargs):
    """Redshift timestamp and datetime function"""
    interval, interval_unit = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return (
        f"DATEADD({interval_unit}, -{interval}, {func.current_timestamp()}::timestamp)"
    )


def azure_mssql_snflk_function(elements, compiler, **kwargs):
    """Azure, MSSQL and Snowflake timestamp and datetime function"""
    interval, interval_unit = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return f"DATEADD({interval_unit}, -{interval}, {func.current_timestamp()})"


def clickhouse_function(elements, compiler, **kwargs):
    """ClickHouse timestamp and datetime function"""
    interval, interval_unit = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return f"(NOW() - interval {interval} {interval_unit})"


def db2_function(elements, compiler, **kwargs):
    """DB2 timestamp and datetime function"""
    interval, interval_unit = [
        compiler.process(element, **kwargs) for element in elements.clauses
    ]
    return f"CAST({func.current_timestamp()} - {interval} {interval_unit} AS TIMESTAMP)"
