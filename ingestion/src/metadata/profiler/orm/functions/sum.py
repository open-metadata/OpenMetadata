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
Define Sum function
"""

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import GenericFunction

from metadata.profiler.metrics.core import CACHE
from metadata.profiler.orm.registry import Dialects


class SumFn(GenericFunction):
    name = "SumFn"
    inherit_cache = CACHE


@compiles(SumFn)
def _(element, compiler, **kw):
    """Cast to BIGINT to address overflow error from summing 32-bit int in most database dialects, #8430"""
    proc = compiler.process(element.clauses, **kw)
    return f"SUM(CAST({proc} AS BIGINT))"


@compiles(SumFn, Dialects.Trino)
def _(element, compiler, **kw):
    """Cast to BIGINT to address cannot cast nan to bigint"""
    proc = compiler.process(element.clauses, **kw)
    return f"SUM(TRY_CAST({proc} AS BIGINT))"


@compiles(SumFn, Dialects.BigQuery)
@compiles(SumFn, Dialects.Postgres)
def _(element, compiler, **kw):
    """Handle case where column type is INTEGER but SUM returns a NUMBER"""
    proc = compiler.process(element.clauses, **kw)
    return f"SUM(CAST({proc} AS NUMERIC))"


@compiles(SumFn, Dialects.MySQL)
def _(element, compiler, **kw):
    """MySQL uses (UN)SIGNED INTEGER to cast to BIGINT
    https://dev.mysql.com/doc/refman/8.0/en/cast-functions.html
    """
    proc = compiler.process(element.clauses, **kw)
    return f"SUM(CAST({proc} AS UNSIGNED INTEGER))"


@compiles(SumFn, Dialects.Snowflake)
@compiles(SumFn, Dialects.Vertica)
def _(element, compiler, **kw):
    """These database types have all int types as alias for int64 so don't need a cast"""
    proc = compiler.process(element.clauses, **kw)
    return f"SUM({proc})"


@compiles(SumFn, Dialects.MSSQL)
def _(element, compiler, **kw):
    """These database types have all int types as alias for int64 so don't need a cast"""
    proc = compiler.process(element.clauses, **kw)
    return f"SUM(CAST({proc} AS decimal))"


@compiles(SumFn, Dialects.Oracle)
def _(element, compiler, **kw):
    """Oracle casting"""
    proc = compiler.process(element.clauses, **kw)
    return f"SUM(CAST({proc} AS NUMBER))"


@compiles(SumFn, Dialects.Impala)
def _(element, compiler, **kw):
    """Impala casting.  Default BIGINT isn't big enough for some sums"""
    proc = compiler.process(element.clauses, **kw)
    return f"SUM(CAST({proc} AS DOUBLE))"


@compiles(SumFn, Dialects.IbmDbSa)
@compiles(SumFn, Dialects.Db2)
def _(element, compiler, **kw):
    """Handle the case for DB2 where it requires to type cast the variables"""
    proc = compiler.process(element.clauses, **kw).replace("?", "CAST(? AS INT)")
    return f"SUM(CAST({proc} AS BIGINT))"


@compiles(SumFn, Dialects.ClickHouse)
def _(element, compiler, **kw):
    """Handle case where column type is INTEGER but SUM returns a NUMBER"""
    proc = compiler.process(element.clauses, **kw)
    return f"SUM(accurateCastOrNull({proc},'BIGINT'))"
