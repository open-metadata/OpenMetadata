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
Define Length function
"""
# Keep SQA docs style defining custom constructs
# pylint: disable=consider-using-f-string,duplicate-code
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.orm_profiler.metrics.core import CACHE
from metadata.orm_profiler.orm.registry import Dialects
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
@compiles(LenFn, Dialects.Databricks)
@compiles(LenFn, Dialects.MySQL)
@compiles(LenFn, Dialects.MariaDB)
@compiles(LenFn, Dialects.Athena)
@compiles(LenFn, Dialects.Trino)
@compiles(LenFn, Dialects.Presto)
@compiles(LenFn, Dialects.BigQuery)
@compiles(LenFn, Dialects.Oracle)
@compiles(LenFn, Dialects.IbmDbSa)
@compiles(LenFn, Dialects.Db2)
def _(element, compiler, **kw):
    return "LENGTH(%s)" % compiler.process(element.clauses, **kw)


@compiles(LenFn, Dialects.Postgres)
def _(element, compiler, **kw):
    return "LENGTH(CAST(%s AS text))" % compiler.process(element.clauses, **kw)


@compiles(LenFn, Dialects.ClickHouse)
def _(element, compiler, **kw):
    """Handles lenght function for ClickHouse"""
    return "length(%s)" % compiler.process(element.clauses, **kw)
