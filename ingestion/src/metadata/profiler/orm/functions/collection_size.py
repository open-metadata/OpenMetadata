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
Defines the SQL function to compute the number of elements in a collection (array/list).
"""

# Keep SQA docs style defining custom constructs
# pylint: disable=consider-using-f-string
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement

from metadata.profiler.metrics.core import CACHE
from metadata.profiler.orm.registry import Dialects


class CollectionSizeFn(FunctionElement):
    """Returns the number of elements in a collection (array/list) column."""

    inherit_cache = CACHE


@compiles(CollectionSizeFn)
def _(element, compiler, **kw):
    return "CARDINALITY(%s)" % compiler.process(element.clauses, **kw)


@compiles(CollectionSizeFn, Dialects.BigQuery)
def _(element, compiler, **kw):
    return "ARRAY_LENGTH(%s)" % compiler.process(element.clauses, **kw)


@compiles(CollectionSizeFn, Dialects.Snowflake)
def _(element, compiler, **kw):
    return "ARRAY_SIZE(%s)" % compiler.process(element.clauses, **kw)


@compiles(CollectionSizeFn, Dialects.Postgres)
@compiles(CollectionSizeFn, Dialects.Cockroach)
def _(element, compiler, **kw):
    return "cardinality(%s)" % compiler.process(element.clauses, **kw)


@compiles(CollectionSizeFn, Dialects.MySQL)
@compiles(CollectionSizeFn, Dialects.MariaDB)
def _(element, compiler, **kw):
    return "JSON_LENGTH(%s)" % compiler.process(element.clauses, **kw)
