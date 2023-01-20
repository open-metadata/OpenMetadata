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
Define Modulo function
"""
# Keep SQA docs style defining custom constructs
# pylint: disable=duplicate-code

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.orm_profiler.metrics.core import CACHE
from metadata.orm_profiler.orm.registry import Dialects
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class ModuloFn(FunctionElement):
    inherit_cache = CACHE


def validate_and_compile(element, compiler, **kw):
    """
    Use like:
    value, base = validate_and_compile(...)
    """
    if len(element.clauses) != 2:
        raise ValueError("We need two elements to compute the modulo")

    return [compiler.process(elem, **kw) for elem in element.clauses]


@compiles(ModuloFn)
def _(element, compiler, **kw):
    """Generic modulo function"""
    value, base = validate_and_compile(element, compiler, **kw)
    return f"{value} %% {base}"


@compiles(ModuloFn, Dialects.BigQuery)
@compiles(ModuloFn, Dialects.Redshift)
@compiles(ModuloFn, Dialects.Snowflake)
@compiles(ModuloFn, Dialects.Postgres)
@compiles(ModuloFn, Dialects.Athena)
@compiles(ModuloFn, Dialects.MySQL)
@compiles(ModuloFn, Dialects.Oracle)
@compiles(ModuloFn, Dialects.Presto)
@compiles(ModuloFn, Dialects.Trino)
@compiles(ModuloFn, Dialects.Vertica)
def _(element, compiler, **kw):
    """Modulo function for specific dialect"""
    value, base = validate_and_compile(element, compiler, **kw)
    return f"MOD({value}, {base})"


@compiles(ModuloFn, Dialects.ClickHouse)
def _(element, compiler, **kw):
    """Handles modulo function for ClickHouse"""
    value, base = validate_and_compile(element, compiler, **kw)
    return f"modulo({value}, {base})"


@compiles(ModuloFn, Dialects.SQLite)
def _(element, compiler, **kw):
    """SQLite modulo function"""
    value, base = validate_and_compile(element, compiler, **kw)
    return f"{value} % {base}"


@compiles(ModuloFn, Dialects.MSSQL)
def _(element, compiler, **kw):
    """Azure SQL modulo function"""
    value, base = validate_and_compile(element, compiler, **kw)
    if compiler.dialect.driver == "pyodbc":
        # pyodbc compiles to c++ code.
        return f"{value} % {base}"
    return f"{value} %% {base}"
