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
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.orm_profiler.metrics.core import CACHE
from metadata.orm_profiler.orm.registry import Dialects
from metadata.orm_profiler.utils import logger

logger = logger()


class LenFn(FunctionElement):
    inherit_cache = CACHE


@compiles(LenFn)
def _(element, compiler, **kw):
    return "LEN(%s)" % compiler.process(element.clauses, **kw)


@compiles(LenFn, Dialects.SQLite)
@compiles(LenFn, Dialects.Vertica)
@compiles(LenFn, Dialects.Hive)  # For some reason hive's dialect is in bytes...
@compiles(LenFn, Dialects.Postgres)
def _(element, compiler, **kw):
    return "LENGTH(%s)" % compiler.process(element.clauses, **kw)
