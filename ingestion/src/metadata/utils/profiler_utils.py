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

"""Profiler utils class and functions"""

import re
from collections import namedtuple
from typing import Optional

import sqlparse
from sqlalchemy.engine.row import Row
from sqlparse.sql import Identifier

from metadata.utils.sqa_utils import is_array


class ColumnLike:
    """We don't have column information at this stage (only metric entities)
    we'll create a column like onject with the attributes needed in handle_array()

    Attrs:
        is_array (bool): is array or not
        array_col (Optional[str]): column name for the array column
    """

    def __init__(self, _is_array: bool, _array_col: Optional[str]) -> None:
        self._is_array = _is_array
        self._array_col = _array_col

    @classmethod
    def create(cls, kwargs: dict) -> "ColumnLike":
        """instantiate the class with the required logic

        Args:
            is_array (bool): is array or not
            array_col (Optional[str]): column name for the array column

        Returns:
            ColumnLike: ColumnLike isntante
        """
        try:
            return cls(is_array(kwargs), kwargs.pop("array_col"))
        except KeyError:
            return cls(False, None)


def clean_up_query(query: str) -> str:
    """remove comments and newlines from query"""
    return sqlparse.format(query, strip_comments=True).replace("\\n", "")


def get_snowflake_system_queries(
    row: Row, database: str, schema: str
) -> Optional["QueryResult"]:
    """get snowflake system queries for a specific database and schema. Parsing the query
    is the only reliable way to get the DDL operation as fields in the table are not.

    Args:
        row (dict): row from the snowflake system queries table
        database (str): database name
        schema (str): schema name
    Returns:
        QueryResult: namedtuple with the query result
    """

    QueryResult = namedtuple(
        "QueryResult",
        "query_id,database_name,schema_name,table_name,query_text,query_type,timestamp",
    )

    try:
        parsed_query = sqlparse.parse(clean_up_query(row.query_text))[0]
        identifier = next(
            (
                query_el
                for query_el in parsed_query.tokens
                if isinstance(query_el, Identifier)
            ),
            None,
        )
        if not identifier:
            return None
        values = identifier.value.split(".")
        database_name, schema_name, table_name = ([None] * (3 - len(values))) + values

        if not all([database_name, schema_name, table_name]):
            return None

        # clean up table name
        table_name = re.sub(r"\s.*", "", table_name).strip()

        if (
            database.lower() == database_name.lower()
            and schema.lower() == schema_name.lower()
        ):
            return QueryResult(
                row.query_id,
                database_name.lower(),
                schema_name.lower(),
                table_name.lower(),
                parsed_query,
                row.query_type,
                row.start_time,
            )
    except Exception:
        return None

    return None
