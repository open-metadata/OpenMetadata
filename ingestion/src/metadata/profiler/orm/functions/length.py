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
Define Length function
"""
# Keep SQA docs style defining custom constructs
# pylint: disable=consider-using-f-string,duplicate-code
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql import sqltypes
from sqlalchemy.sql.functions import FunctionElement

from metadata.profiler.metrics.core import CACHE
from metadata.profiler.orm.registry import Dialects
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class LenFn(FunctionElement):
    inherit_cache = CACHE


@compiles(LenFn)
def _(element, compiler, **kw):
    return "LEN(%s)" % compiler.process(element.clauses, **kw)


@compiles(LenFn, Dialects.SQLite)
@compiles(LenFn, Dialects.Vertica)
@compiles(LenFn, Dialects.Hive)
@compiles(LenFn, Dialects.Impala)
@compiles(LenFn, Dialects.Databricks)
@compiles(LenFn, Dialects.MySQL)
@compiles(LenFn, Dialects.MariaDB)
@compiles(LenFn, Dialects.Athena)
@compiles(LenFn, Dialects.Trino)
@compiles(LenFn, Dialects.PinotDB)
@compiles(LenFn, Dialects.Presto)
@compiles(LenFn, Dialects.BigQuery)
@compiles(LenFn, Dialects.Oracle)
@compiles(LenFn, Dialects.IbmDbSa)
@compiles(LenFn, Dialects.Db2)
@compiles(LenFn, Dialects.Hana)
@compiles(LenFn, Dialects.Druid)
@compiles(LenFn, Dialects.Doris)
def _(element, compiler, **kw):
    return "LENGTH(%s)" % compiler.process(element.clauses, **kw)


@compiles(LenFn, Dialects.Cockroach)
@compiles(LenFn, Dialects.Postgres)
def _(element, compiler, **kw):
    return "LENGTH(CAST(%s AS text))" % compiler.process(element.clauses, **kw)


@compiles(LenFn, Dialects.ClickHouse)
def _(element, compiler, **kw):
    """Handles lenght function for ClickHouse"""
    if isinstance(element.clauses.clauses[0].type, sqltypes.Enum):
        return "length(cast(%s, 'String'))" % compiler.process(element.clauses, **kw)
    return "length(%s)" % compiler.process(element.clauses, **kw)


@compiles(LenFn, Dialects.MSSQL)
def _(element, compiler, **kw):
    if isinstance(element.clauses.clauses[0].type, (sqltypes.TEXT, sqltypes.NVARCHAR)):
        return "LEN(CAST(%s as [nvarchar]))" % compiler.process(element.clauses, **kw)
    return "LEN(%s)" % compiler.process(element.clauses, **kw)
