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
Define MD5 hashing function
"""
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.profiler.metrics.core import CACHE
from metadata.profiler.orm.registry import PythonDialects
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class MD5(FunctionElement):
    inherit_cache = CACHE


@compiles(MD5)
def _(element, compiler, **kw):
    return f"MD5({compiler.process(element.clauses, **kw)})"


@compiles(MD5, PythonDialects.MSSQL.value)
def _(element, compiler, **kw):
    # TODO requires separate where clauses for each table
    return f"CONVERT(VARCHAR(8), HashBytes('MD5', {compiler.process(element.clauses, **kw)}), 2)"


@compiles(MD5, PythonDialects.BigQuery.value)
def _(element, compiler, **kw):
    return f"TO_HEX(MD5(CAST({compiler.process(element.clauses, **kw)} AS STRING)))"
