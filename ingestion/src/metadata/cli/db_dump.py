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
Database Dumping utility for the metadata CLI
"""

import json
from functools import singledispatch
from pathlib import Path
from typing import List, Optional, Union

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from metadata.utils.constants import UTF_8

TABLES_DUMP_ALL = {
    "task_sequence",
    "entity_usage",
    "entity_relationship",
    "entity_extension",
    "field_relationship",
    "tag_usage",
    "openmetadata_settings",
}

CUSTOM_TABLES = {"entity_extension_time_series": {"exclude_columns": ["timestamp"]}}
NOT_MIGRATE = {"DATABASE_CHANGE_LOG"}

STATEMENT_JSON = "SELECT json FROM {table}"
STATEMENT_ALL = "SELECT * FROM {table}"
STATEMENT_TRUNCATE = "TRUNCATE TABLE {table};\n"
STATEMENT_ALL_NEW = "SELECT {cols} FROM {table}"

MYSQL_ENGINE_NAME = "mysql"


def single_quote_wrap(raw: str) -> str:
    """
    Add single quote wrap to string. From `str` to `'str'`
    """
    return f"'{raw}'"


def clean_str(raw: str, engine: Engine) -> str:
    """
    String cleaning for SQL parsing.

    Logic is different between MySQL and Postgres

    - descriptions/comments with single quotes, e.g., `Mysql's data`.
      get converted to `Mysql''s data`
    - To insert a literal backlash in MySQL you need to escape with another one. This applies for `\n` and `\"` in
      inner JSONs for a field. This is not required for postgres
    """
    quoted_str = raw.replace("'", "''")

    if engine.name == MYSQL_ENGINE_NAME:
        quoted_str = quoted_str.replace("\\", "\\\\")

    return quoted_str


@singledispatch
def clean_col(column_raw: Optional[Union[dict, str]], engine: Engine) -> str:
    return (
        single_quote_wrap(clean_str(str(column_raw), engine))
        if column_raw is not None
        else "null"
    )


@clean_col.register(dict)
@clean_col.register(list)
def _(column_raw: Optional[Union[dict, list]], engine: Engine) -> str:
    """
    Prepare the JSON column to be inserted to MySQL

    Handle:
    - quotes
    - True/False values
    """
    return (
        single_quote_wrap(
            clean_str(
                json.dumps(
                    column_raw,
                    default=str,  # If we don't know how to serialize, convert to str
                ),
                engine,
            )
        )
        if column_raw is not None
        else "null"
    )


def dump_json(tables: List[str], engine: Engine, output: Path) -> None:
    """
    Dumps JSON data.

    Postgres: engine.name == "postgresql"
    MySQL: engine.name == "mysql"
    """
    with open(output, "a", encoding=UTF_8) as file:
        for table in tables:

            truncate = STATEMENT_TRUNCATE.format(table=table)
            file.write(truncate)

            res = engine.execute(text(STATEMENT_JSON.format(table=table))).all()
            for row in res:
                insert = f"INSERT INTO {table} (json) VALUES ({clean_col(row.json, engine)});\n"
                file.write(insert)


def dump_all(tables: List[str], engine: Engine, output: Path) -> None:
    """
    Dump tables that need to store all data
    """
    with open(output, "a", encoding=UTF_8) as file:
        for table in tables:

            truncate = STATEMENT_TRUNCATE.format(table=table)
            file.write(truncate)

            res = engine.execute(text(STATEMENT_ALL.format(table=table))).all()
            for row in res:
                data = ",".join(clean_col(col, engine) for col in row)

                insert = f"INSERT INTO {table} VALUES ({data});\n"
                file.write(insert)


def dump_entity_custom(engine: Engine, output: Path, inspector) -> None:
    """
    This function is used to dump entities with custom handling
    """
    with open(output, "a", encoding=UTF_8) as file:
        for table, data in CUSTOM_TABLES.items():

            truncate = STATEMENT_TRUNCATE.format(table=table)
            file.write(truncate)

            columns = inspector.get_columns(table_name=table)

            statement = STATEMENT_ALL_NEW.format(
                cols=",".join(
                    col["name"]
                    for col in columns
                    if col["name"] not in data["exclude_columns"]
                ),
                table=table,
            )
            res = engine.execute(text(statement)).all()
            for row in res:
                # Let's use .format here to not add more variables
                # pylint: disable=consider-using-f-string
                insert = "INSERT INTO {table} ({cols}) VALUES ({data});\n".format(
                    table=table,
                    data=",".join(clean_col(col, engine) for col in row),
                    cols=",".join(
                        col["name"]
                        for col in columns
                        if col["name"] not in data["exclude_columns"]
                    ),
                )
                file.write(insert)


def dump(engine: Engine, output: Path, schema: str = None) -> None:
    """
    Get all tables from the database and dump
    only the JSON column for the required tables
    """
    inspector = inspect(engine)
    tables = (
        inspector.get_table_names(schema) if schema else inspector.get_table_names()
    )

    dump_json_tables = [
        table
        for table in tables
        if table not in TABLES_DUMP_ALL
        and table not in NOT_MIGRATE
        and table not in CUSTOM_TABLES
    ]

    dump_all(tables=list(TABLES_DUMP_ALL), engine=engine, output=output)
    dump_json(tables=dump_json_tables, engine=engine, output=output)
    dump_entity_custom(engine=engine, output=output, inspector=inspector)
