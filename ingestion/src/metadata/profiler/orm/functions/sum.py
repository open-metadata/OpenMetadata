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


@compiles(SumFn, Dialects.Redshift)
def _(element, compiler, **kw):
    """Cast to Decimal to address overflow error from summing 32-bit int in most database dialects"""
    proc = compiler.process(element.clauses, **kw)
    return f"SUM(CAST({proc} AS Decimal(38,0)))"


@compiles(SumFn, Dialects.Athena)
@compiles(SumFn, Dialects.Trino)
@compiles(SumFn, Dialects.Presto)
def _(element, compiler, **kw):
    """Cast to DECIMAL to address cannot cast nan to bigint"""
    proc = compiler.process(element.clauses, **kw)
    return f"COALESCE(SUM(CAST({proc} AS DECIMAL)),0)"


@compiles(SumFn, Dialects.BigQuery)
@compiles(SumFn, Dialects.Postgres)
@compiles(SumFn, Dialects.Cockroach)
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


@compiles(SumFn, Dialects.Informix)
def _(element, compiler, **kw):
    """Informix: BIGINT unsupported, max DECIMAL precision is 32 (not 38).
    Unlike other databases that infer CASE result type from THEN/ELSE branches (1/0 → integer),
    Informix infers it from the WHEN condition's column type. For DATETIME/INTERVAL columns,
    this makes CAST(CASE ... AS DECIMAL) fail. Rewrite to COUNT(*) - COUNT(col) instead."""
    # pylint: disable=import-outside-toplevel
    from sqlalchemy.sql.elements import Case as _Case

    from metadata.profiler.orm.registry import is_date_time

    clause = element.clauses.clauses[0] if element.clauses.clauses else None
    if isinstance(clause, _Case) and clause.whens:
        cond = clause.whens[0][0]
        col_clause = getattr(cond, "left", None)
        col_type = getattr(col_clause, "type", None)
        if col_type is not None and is_date_time(col_type):
            col_name = compiler.process(col_clause, **kw)
            return f"(COUNT(*) - COUNT({col_name}))"

    proc = compiler.process(element.clauses, **kw)
    return f"SUM(CAST({proc} AS DECIMAL(32,4)))"


@compiles(SumFn, Dialects.ClickHouse)
def _(element, compiler, **kw):
    """Handle case where column type is INTEGER but SUM returns a NUMBER"""
    proc = compiler.process(element.clauses, **kw)
    return f"SUM(accurateCastOrNull({proc},'BIGINT'))"
