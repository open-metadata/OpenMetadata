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
Hive source methods.
"""

import re

from pyhive.sqlalchemy_hive import _type_map
from sqlalchemy import text, types, util
from sqlalchemy.engine import reflection

from metadata.ingestion.source.database.hive.queries import HIVE_GET_COMMENTS

complex_data_types = ["struct", "map", "array", "union"]

_type_map.update(
    {
        "binary": types.BINARY,
        "char": types.CHAR,
        "varchar": types.VARCHAR,
        "decimal": types.DECIMAL,
    }
)


def _parse_hive_column(col_name, col_type, comment, *, is_partition: bool = False):
    """Build a SQLAlchemy-style column dict from a Hive DESCRIBE row."""
    col_raw_type = col_type
    attype = re.sub(r"\(.*\)", "", col_type)
    col_type = re.search(r"^\w+", col_type).group(0)
    try:
        coltype = _type_map[col_type]
    except KeyError:
        util.warn(f"Did not recognize type '{col_type}' of column '{col_name}'")
        coltype = types.NullType
    charlen = re.search(r"\(([\d,]+)\)", col_raw_type.lower())
    if charlen:
        charlen = charlen.group(1)
        if any(col_type.startswith(prefix) for prefix in complex_data_types):
            # For complex types the regex above matches the parameters of a nested
            # type instead, e.g. array<struct<a:decimal(16,4)>> yields "16,4".
            # The nested fields are resolved later from `system_data_type`.
            args = []
        elif attype == "decimal":
            prec, scale = charlen.split(",")
            args = (int(prec), int(scale))
        else:
            args = (int(charlen),)
        coltype = coltype(*args)

    return {
        "name": col_name,
        "type": coltype,
        "comment": comment,
        "nullable": True,
        "default": None,
        "system_data_type": col_raw_type,
        "is_complex": col_type in complex_data_types,
        "is_partition": is_partition,
    }


def get_columns(self, connection, table_name, schema=None, **kw):  # pylint: disable=unused-argument,too-many-locals
    """
    Method to handle table columns.

    Hive DESCRIBE lists regular columns first, then a ``# Partition Information``
    section. Partition keys must be kept and flagged so callers can populate
    ``tablePartition`` (see HiveSource.get_table_partition_details).
    """
    only_partition_columns = kw.get("only_partition_columns", False)
    rows = self._get_table_columns(  # pylint: disable=protected-access
        connection, table_name, schema
    )
    rows = [[col.strip() if col else None for col in row] for row in rows]
    rows = [row for row in rows if row[0] and row[0] != "# col_name"]
    result = []
    seen_columns: dict[str, dict] = {}
    in_partition_section = False
    for col_name, col_type, comment in rows:
        if col_name == "# Partition Information":
            in_partition_section = True
            continue

        if col_name.startswith("#"):
            # DESCRIBE FORMATTED continues with other `# ...` sections after
            # partitions; stop so Owner/Location rows are not treated as columns.
            if in_partition_section:
                break
            continue

        if col_name in seen_columns:
            # Partition keys often appear twice: once with data columns and again
            # under Partition Information. Mark the existing entry as a partition.
            if in_partition_section:
                seen_columns[col_name]["is_partition"] = True
            continue

        if not col_type:
            continue

        column = _parse_hive_column(
            col_name, col_type, comment, is_partition=in_partition_section
        )
        seen_columns[col_name] = column
        result.append(column)

    if only_partition_columns:
        return [col for col in result if col.get("is_partition")]
    return result


def get_table_names_older_versions(self, connection, schema=None, **kw):  # pylint: disable=unused-argument
    query = "SHOW TABLES"
    if schema:
        query += " IN " + self.identifier_preparer.quote_identifier(schema)
    tables_in_schema = connection.execute(text(query))
    tables = []
    for row in tables_in_schema:
        # check number of columns in result
        # if it is > 1, we use spark thrift server with 3 columns in the result (schema, table, is_temporary)
        # else it is hive with 1 column in the result
        if len(row) > 1:
            tables.append(row[1])
        else:
            tables.append(row[0])
    return tables


def get_table_names(self, connection, schema=None, **kw):  # pylint: disable=unused-argument
    query = "SHOW TABLES"
    if schema:
        query += " IN " + self.identifier_preparer.quote_identifier(schema)
    tables_in_schema = connection.execute(text(query))
    tables = []
    for row in tables_in_schema:
        # check number of columns in result
        # if it is > 1, we use spark thrift server with 3 columns in the result (schema, table, is_temporary)
        # else it is hive with 1 column in the result
        if len(row) > 1:
            tables.append(row[1])
        else:
            tables.append(row[0])
    # "SHOW TABLES" command in hive also fetches view names
    # Below code filters out view names from table names
    views = self.get_view_names(connection, schema)
    return [table for table in tables if table not in views]


def get_view_names(self, connection, schema=None, **kw):  # pylint: disable=unused-argument
    query = "SHOW VIEWS"
    if schema:
        query += " IN " + self.identifier_preparer.quote_identifier(schema)
    view_in_schema = connection.execute(text(query))
    views = []
    for row in view_in_schema:
        # check number of columns in result
        # if it is > 1, we use spark thrift server with 3 columns in the result (schema, table, is_temporary)
        # else it is hive with 1 column in the result
        if len(row) > 1:
            views.append(row[1])
        else:
            views.append(row[0])
    return views


def get_view_names_older_versions(self, connection, schema=None, **kw):  # pylint: disable=unused-argument
    # Hive does not provide functionality to query tableType for older version
    # This allows reflection to not crash at the cost of being inaccurate
    return []


@reflection.cache
def get_table_comment(  # pylint: disable=unused-argument
    self, connection, table_name, schema_name, **kw
):
    """
    Returns comment of table.
    """
    cursor = connection.execute(text(HIVE_GET_COMMENTS.format(schema_name=schema_name, table_name=table_name)))
    try:
        for result in list(cursor):
            data = tuple(result)
            if data[1] and data[1].strip() == "comment":
                return {"text": data[2].strip() if data[2] else None}
    except Exception:
        return {"text": None}
    return {"text": None}


# pylint: disable=unused-argument
@reflection.cache
def get_view_definition(self, connection, view_name, schema=None, **kw):
    """
    Gets the view definition
    """
    full_view_name = f"`{view_name}`" if not schema else f"`{schema}`.`{view_name}`"
    res = connection.execute(text(f"SHOW CREATE TABLE {full_view_name}")).fetchall()
    if res:
        return "\n".join(i[0] for i in res)
    return None
