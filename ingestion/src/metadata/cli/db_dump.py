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

from pathlib import Path
from typing import List

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


def clean_col(column_raw: str) -> str:
    """
    Prepare the column to be inserted to MySQL
    """
    return (
        repr(str(column_raw)).replace('"', '\\"') if column_raw is not None else "null"
    )


def dump_json(tables: List[str], engine: Engine, output: Path) -> None:
    """
    Dumps JSON data
    """
    with open(output, "a", encoding=UTF_8) as file:
        for table in tables:

            truncate = STATEMENT_TRUNCATE.format(table=table)
            file.write(truncate)

            res = engine.execute(text(STATEMENT_JSON.format(table=table))).all()
            for row in res:
                insert = f"INSERT INTO {table} (json) VALUES ({clean_col(row.json)});\n"
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
                data = ",".join(clean_col(col) for col in row)

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
                    data=",".join(clean_col(col) for col in row),
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
