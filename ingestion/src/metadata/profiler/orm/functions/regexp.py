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

"""Define a regexp match function."""

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import GenericFunction

from metadata.profiler.metrics.core import CACHE
from metadata.profiler.orm.registry import Dialects


class RegexpMatchFn(GenericFunction):
    name = "regexp_match"
    inherit_cache = CACHE


@compiles(RegexpMatchFn)
def _(element, compiler, **kw):
    """Base function for regexp_match"""
    column, pattern = element.clauses
    fn = column.regexp_match(pattern)
    return compiler.process(fn, **kw)


@compiles(RegexpMatchFn, Dialects.Databricks)
def _(element, compiler, **kw):
    """Databricks function for regexp_match"""
    column, pattern = element.clauses
    compiled_column = compiler.process(column, **kw)
    compiled_pattern = compiler.process(pattern, **kw)
    return f"REGEXP_LIKE({compiled_column}, {compiled_pattern})"
