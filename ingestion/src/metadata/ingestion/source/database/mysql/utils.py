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
MySQL SQLAlchemy Helper Methods
"""

# pylint: disable=protected-access,too-many-branches,too-many-statements,too-many-locals
from collections.abc import Sequence
from typing import Any

from sqlalchemy import Table, text, util
from sqlalchemy.dialects.mysql.base import MySQLDialect, _DecodingRow
from sqlalchemy.dialects.mysql.enumerated import ENUM, SET
from sqlalchemy.dialects.mysql.reflection import _strip_values
from sqlalchemy.dialects.mysql.types import DATETIME, TIME, TIMESTAMP
from sqlalchemy.engine import Connection, Row
from sqlalchemy.exc import DBAPIError
from sqlalchemy.sql import sqltypes

from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.mysql.queries import MYSQL_GET_VIEW_COLUMNS
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import get_display_datatype

logger = ingestion_logger()

ER_TABLEACCESS_DENIED_ERROR = 1142

_sqlalchemy_describe_table = MySQLDialect._describe_table

col_type_map = {
    "bool": create_sqlalchemy_type("BOOL"),
    "geometry": create_sqlalchemy_type("GEOMETRY"),
    "point": create_sqlalchemy_type("GEOMETRY"),
    "polygon": create_sqlalchemy_type("GEOMETRY"),
    "linestring": create_sqlalchemy_type("GEOMETRY"),
    "geomcollection": create_sqlalchemy_type("GEOMETRY"),
    "multilinestring": create_sqlalchemy_type("GEOMETRY"),
    "multipoint": create_sqlalchemy_type("GEOMETRY"),
    "multipolygon": create_sqlalchemy_type("GEOMETRY"),
}


def parse_column(self, line, state):  # noqa: C901
    """
    Overriding the dialect method to include raw_data_type in response

    Extract column details.

    Falls back to a 'minimal support' variant if full parse fails.

    :param line: Any column-bearing line from SHOW CREATE TABLE
    """

    spec = None
    re_match = self._re_column.match(line)
    if re_match:
        spec = re_match.groupdict()
        spec["full"] = True
    else:
        re_match = self._re_column_loose.match(line)
        if re_match:
            spec = re_match.groupdict()
            spec["full"] = False
    if not spec:
        util.warn(f"Unknown column definition {line}")
        return
    if not spec["full"]:
        util.warn(f"Incomplete reflection of column definition {line}")

    name, type_, args = spec["name"], spec["coltype"], spec["arg"]

    try:
        col_type = self.dialect.ischema_names[type_.lower()]
    except KeyError:
        util.warn(f"Did not recognize type '{type_}' of column '{name}'")
        col_type = sqltypes.NullType

    # Column type positional arguments eg. varchar(32)
    if args is None or args == "":
        type_args = []
    elif args[0] == "'" and args[-1] == "'":
        type_args = self._re_csv_str.findall(args)
    else:
        type_args = [int(v) for v in self._re_csv_int.findall(args)]

    # Column type keyword options
    type_kw = {}

    if issubclass(col_type, (DATETIME, TIME, TIMESTAMP)):  # noqa: SIM102
        if type_args:
            type_kw["fsp"] = type_args.pop(0)

    for ikw in ("unsigned", "zerofill"):
        if spec.get(ikw, False):
            type_kw[ikw] = True
    if spec.get("charset", False):
        type_kw["charset"] = spec["charset"]

    if issubclass(col_type, (ENUM, SET)):
        type_args = _strip_values(type_args)

        if issubclass(col_type, SET) and "" in type_args:
            type_kw["retrieve_as_bitwise"] = True

    type_instance = col_type(*type_args, **type_kw)

    col_kw = {}

    # NOT NULL
    col_kw["nullable"] = True
    # this can be "NULL" in the case of TIMESTAMP
    if spec.get("notnull", False) == "NOT NULL":
        col_kw["nullable"] = False

    # AUTO_INCREMENT
    if spec.get("autoincr", False):
        col_kw["autoincrement"] = True
    elif issubclass(col_type, sqltypes.Integer):
        col_kw["autoincrement"] = False

    # DEFAULT
    default = spec.get("default", None)

    if default == "NULL":
        # eliminates the need to deal with this later.
        default = None

    comment = spec.get("comment", None)

    if comment is not None:
        comment = comment.replace("\\\\", "\\").replace("''", "'")

    sqltext = spec.get("generated")
    if sqltext is not None:
        computed = {"sqltext": sqltext}
        persisted = spec.get("persistence")
        if persisted is not None:
            computed["persisted"] = persisted == "STORED"
        col_kw["computed"] = computed

    raw_type = get_display_datatype(
        col_type=type_,
        char_len=type_instance.length if hasattr(type_instance, "length") else None,
        precision=(type_instance.precision if hasattr(type_instance, "precision") else None),
        scale=type_instance.scale if hasattr(type_instance, "scale") else None,
    )

    col_d = {
        "name": name,
        "type": type_instance,
        "default": default,
        "comment": comment,
        "system_data_type": raw_type,
    }
    col_d.update(col_kw)
    state.columns.append(col_d)


def describe_or_read_view_columns(
    self: MySQLDialect,
    connection: Connection,
    table: Table | None,
    charset: str | None = None,
    full_name: str | None = None,
) -> Sequence[Row[Any]] | Sequence[_DecodingRow]:
    """
    MySQL denies DESCRIBE on a view when the user's privileges on it come from a database-level
    grant without SELECT. information_schema.COLUMNS still lists the columns the user holds any
    column privilege on, such as REFERENCES.
    See ADR:2026-10-15-mysql-view-columns-fall-back-to-information-schema.
    """
    if full_name is None:
        assert table is not None
        full_name = self.identifier_preparer.format_table(table)
    try:
        return _sqlalchemy_describe_table(self, connection, table, charset, full_name)
    except DBAPIError as err:
        if (
            not isinstance(err.orig, self.loaded_dbapi.Error)
            or self._extract_error_code(err.orig) != ER_TABLEACCESS_DENIED_ERROR
        ):
            raise
    *schema, view_name = self.identifier_preparer.unformat_identifiers(full_name)
    columns = self._compat_fetchall(
        connection.execute(
            text(MYSQL_GET_VIEW_COLUMNS),
            {"schema_name": schema[0] if schema else None, "view_name": view_name},
        ),
        charset=charset,
    )
    if not columns:
        logger.warning(
            "View %s has no columns visible to this user. Grant SELECT or REFERENCES on it to ingest its columns.",
            full_name,
        )
    return columns
