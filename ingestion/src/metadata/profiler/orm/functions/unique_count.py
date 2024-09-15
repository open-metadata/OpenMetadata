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
Unique Count Metric functions
"""

from collections import defaultdict

from sqlalchemy import NVARCHAR, TEXT, func, literal_column

from metadata.profiler.orm.converter.mssql.converter import cast_dict
from metadata.profiler.orm.functions.count import CountFn
from metadata.profiler.orm.registry import Dialects
from metadata.profiler.orm.types.custom_image import CustomImage


def _unique_count_query(col, session, sample):
    return (
        session.query(func.count(col))
        .select_from(sample)
        .group_by(col)
        .having(func.count(col) == 1)
    )


def _unique_count_query_mssql(col, session, sample):
    # The ntext, text, and image data types will be removed in a future version of SQL Server.
    # Avoid using these data types in new development work, and plan to modify applications that currently use them.
    # Use nvarchar(max), varchar(max), and varbinary(max) instead.
    # ref:https://learn.microsoft.com/en-us/sql/t-sql/data-types/ntext-text-and-image-transact-sql?view=sql-server-ver16
    is_mssql_deprecated_datatype = isinstance(col.type, (CustomImage, TEXT, NVARCHAR))

    if is_mssql_deprecated_datatype:
        count_fn = CountFn(col)
        group_by_col = func.convert(literal_column(cast_dict.get(type(col.type))), col)
    else:
        count_fn = col
        group_by_col = col
    return (
        session.query(func.count(count_fn))
        .select_from(sample)
        .group_by(group_by_col)
        .having(func.count(count_fn) == 1)
    )


def _unique_count_query_oracle(col, session, sample):
    count_fn = CountFn(col)
    return _unique_count_query(count_fn, session, sample)


_unique_count_query_mapper = defaultdict(lambda: _unique_count_query)
_unique_count_query_mapper[Dialects.MSSQL] = _unique_count_query_mssql
_unique_count_query_mapper[Dialects.Oracle] = _unique_count_query_oracle
