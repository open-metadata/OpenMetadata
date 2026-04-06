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
Defines the SQL function to compute the number of keys/elements in a struct or JSON column.
"""

# Keep SQA docs style defining custom constructs
# pylint: disable=consider-using-f-string
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.profiler.metrics.core import CACHE
from metadata.profiler.orm.registry import Dialects


class StructSizeFn(FunctionElement):
    """Returns the number of keys or elements in a struct/JSON column."""

    inherit_cache = CACHE


@compiles(StructSizeFn)
def _(element, compiler, **kw):
    return "NULL"


@compiles(StructSizeFn, Dialects.MySQL)
@compiles(StructSizeFn, Dialects.MariaDB)
def _(element, compiler, **kw):
    return "JSON_LENGTH(%s)" % compiler.process(element.clauses, **kw)


@compiles(StructSizeFn, Dialects.BigQuery)
def _(element, compiler, **kw):
    proc = compiler.process(element.clauses, **kw)
    return "ARRAY_LENGTH(JSON_QUERY_ARRAY(%s))" % proc


@compiles(StructSizeFn, Dialects.Snowflake)
def _(element, compiler, **kw):
    proc = compiler.process(element.clauses, **kw)
    return (
        "CASE WHEN IS_ARRAY(%s) THEN ARRAY_SIZE(%s) "
        "WHEN IS_OBJECT(%s) THEN ARRAY_SIZE(OBJECT_KEYS(%s)) "
        "ELSE 0 END"
    ) % (proc, proc, proc, proc)


@compiles(StructSizeFn, Dialects.Postgres)
@compiles(StructSizeFn, Dialects.Cockroach)
def _(element, compiler, **kw):
    proc = compiler.process(element.clauses, **kw)
    return (
        "CASE WHEN jsonb_typeof(CAST(%s AS jsonb)) = 'array' "
        "THEN jsonb_array_length(CAST(%s AS jsonb)) "
        "WHEN jsonb_typeof(CAST(%s AS jsonb)) = 'object' "
        "THEN (SELECT count(*) FROM jsonb_object_keys(CAST(%s AS jsonb))) "
        "ELSE 0 END"
    ) % (proc, proc, proc, proc)


@compiles(StructSizeFn, Dialects.Athena)
@compiles(StructSizeFn, Dialects.Trino)
@compiles(StructSizeFn, Dialects.Presto)
def _(element, compiler, **kw):
    proc = compiler.process(element.clauses, **kw)
    return "CARDINALITY(CAST(%s AS MAP(VARCHAR, JSON)))" % proc
