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
Module for sqlalchemy dialect utils
"""
import traceback
from typing import Dict, Optional, Tuple

from sqlalchemy.engine import Engine, reflection
from sqlalchemy.schema import CreateTable, MetaData

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


@reflection.cache
def get_all_table_comments(self, connection, query):
    """
    Method to fetch comment of all available tables
    """
    self.all_table_comments: Dict[Tuple[str, str], str] = {}
    self.current_db: str = connection.engine.url.database
    result = connection.execute(query)
    for table in result:
        self.all_table_comments[(table.table_name, table.schema)] = table.table_comment


def get_table_comment_wrapper(self, connection, query, table_name, schema=None):
    if (
        not hasattr(self, "all_table_comments")
        or self.current_db != connection.engine.url.database
    ):
        self.get_all_table_comments(connection, query)
    return {"text": self.all_table_comments.get((table_name, schema))}


@reflection.cache
def get_all_table_owners(
    self, connection, query, schema_name, **kw
):  # pylint: disable=unused-argument
    """
    Method to fetch owners of all available tables
    """
    self.all_table_owners: Dict[Tuple[str, str], str] = {}
    result = connection.execute(query)
    for table in result:
        self.all_table_owners[(table[0], table[1])] = table[2]


def get_table_owner_wrapper(
    self, connection, query, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    if not hasattr(self, "all_table_owners"):
        self.get_all_table_owners(connection, query, schema)
    return self.all_table_owners.get((schema, table_name), "")


@reflection.cache
def get_all_view_definitions(self, connection, query):
    """
    Method to fetch view definition of all available views
    """
    self.all_view_definitions: Dict[Tuple[str, str], str] = {}
    self.current_db: str = connection.engine.url.database  # type: ignore
    result = connection.execute(query)
    for view in result:
        if hasattr(view, "view_def") and hasattr(view, "schema"):
            self.all_view_definitions[(view.view_name, view.schema)] = view.view_def
        elif hasattr(view, "VIEW_DEF") and hasattr(view, "SCHEMA"):
            self.all_view_definitions[(view.VIEW_NAME, view.SCHEMA)] = view.VIEW_DEF


def get_view_definition_wrapper(self, connection, query, table_name, schema=None):
    if (
        not hasattr(self, "all_view_definitions")
        or self.current_db != connection.engine.url.database
    ):
        self.get_all_view_definitions(connection, query)
    return self.all_view_definitions.get((table_name, schema), "")


def get_schema_descriptions(engine: Engine, query: str):
    results = engine.execute(query).all()
    schema_desc_map = {}
    for row in results:
        schema_desc_map[row.schema_name] = row.comment
    return schema_desc_map


def is_complex_type(col_type: str):
    return (
        col_type.lower().startswith("array")
        or col_type.lower().startswith("map")
        or col_type.lower().startswith("struct")
        or col_type.lower().startswith("row")
    )


def get_display_datatype(
    col_type: str,
    char_len: Optional[int],
    precision: Optional[int],
    scale: Optional[int],
):
    if char_len or (precision is not None and scale is None):
        length = char_len or scale
        return f"{col_type}({str(length)})"
    if scale is not None and precision is not None:
        return f"{col_type}({str(precision)},{str(scale)})"
    return col_type


def convert_numpy_to_list(data):
    """
    Recursively converts numpy arrays to lists in a nested data structure.
    """
    import numpy as np  # pylint: disable=import-outside-toplevel

    if isinstance(data, np.ndarray):
        return data.tolist()
    if isinstance(data, list):
        return [convert_numpy_to_list(item) for item in data]
    if isinstance(data, dict):
        return {key: convert_numpy_to_list(value) for key, value in data.items()}
    return data


@reflection.cache
def get_all_table_ddls(
    self, connection, query, schema_name, **kw
):  # pylint: disable=unused-argument
    """
    Method to fetch ddl of all available tables
    """
    try:
        self.all_table_ddls: Dict[Tuple[str, str], str] = {}
        self.current_db: str = schema_name
        meta = MetaData()
        meta.reflect(bind=connection.engine, schema=schema_name)
        for table in meta.sorted_tables or []:
            self.all_table_ddls[(table.schema, table.name)] = str(CreateTable(table))
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.debug(f"Failed to get table ddls for {schema_name}: {exc}")


def get_table_ddl_wrapper(
    self, connection, query, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    if not hasattr(self, "all_table_ddls") or self.current_db != schema:
        self.get_all_table_ddls(connection, query, schema)
    return self.all_table_ddls.get((schema, table_name))


def get_table_ddl(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    return get_table_ddl_wrapper(
        self,
        connection=connection,
        query=None,
        table_name=table_name,
        schema=schema,
    )


@reflection.cache
def get_schema_comment_results(self, connection, query, database, schema=None):
    """
    Method to fetch comment of all available schemas
    """
    self.schema_comment_result: Dict[str, str] = {}
    self.current_db: str = database
    result = connection.execute(query).fetchall()
    self.schema_comment_result[schema] = result


@reflection.cache
def get_table_comment_results(
    self, connection, query, database, table_name, schema=None
):
    """
    Method to fetch comment of all available tables
    """
    self.table_comment_result: Dict[Tuple[str, str], str] = {}
    self.current_db: str = database
    result = connection.execute(query).fetchall()
    self.table_comment_result[(table_name, schema)] = result


def get_table_comment_result_wrapper(
    self, connection, query, database, table_name, schema=None
):
    if (
        not hasattr(self, "table_comment_result")
        or self.table_comment_result.get((table_name, schema)) is None
        or self.current_db != database
    ):
        self.get_table_comment_results(connection, query, database, table_name, schema)
    return self.table_comment_result.get((table_name, schema))


def get_schema_comment_result_wrapper(self, connection, query, database, schema=None):
    if (
        not hasattr(self, "schema_comment_result")
        or self.schema_comment_result.get((schema)) is None
        or self.current_db != database
    ):
        self.get_schema_comment_results(connection, query, database, schema)
    return self.schema_comment_result.get((schema))
