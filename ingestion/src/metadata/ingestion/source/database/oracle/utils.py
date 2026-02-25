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
Utils module to define overrided sqlalchamy methods
"""
# pylint: disable=protected-access,unused-argument
import re

from sqlalchemy import sql, util
from sqlalchemy.dialects.oracle.base import FLOAT, INTEGER, INTERVAL, NUMBER, TIMESTAMP
from sqlalchemy.engine import reflection
from sqlalchemy.sql import sqltypes

from metadata.ingestion.source.database.oracle.queries import (
    GET_MATERIALIZED_VIEW_NAMES,
    GET_VIEW_NAMES,
    ORACLE_ALL_CONSTRAINTS,
    ORACLE_ALL_TABLE_COMMENTS,
    ORACLE_ALL_TABLE_COMMENTS_PRESERVE_CASE,
    ORACLE_ALL_VIEW_DEFINITIONS,
    ORACLE_ALL_VIEW_DEFINITIONS_PRESERVE_CASE,
    ORACLE_GET_COLUMNS,
    ORACLE_GET_TABLE_NAMES,
    ORACLE_IDENTITY_TYPE,
)
from metadata.utils.sqlalchemy_utils import (
    get_table_comment_wrapper,
    get_view_definition_wrapper,
)


@reflection.cache
def get_table_comment(
    self,
    connection,
    table_name: str,
    schema: str = None,
    resolve_synonyms=False,
    dblink="",
    **kw,
):
    return get_table_comment_wrapper(
        self,
        connection,
        table_name=table_name.lower(),
        schema=schema.lower() if schema else None,
        query=ORACLE_ALL_TABLE_COMMENTS,
    )


@reflection.cache
def get_view_definition(
    self,
    connection,
    view_name: str,
    schema: str = None,
    resolve_synonyms=False,
    dblink="",
    **kw,
):
    return get_view_definition_wrapper(
        self,
        connection,
        table_name=view_name.lower(),
        schema=schema.lower() if schema else None,
        query=ORACLE_ALL_VIEW_DEFINITIONS,
    )


@reflection.cache
def get_all_view_definitions(self, connection, query):
    """
    Method to fetch view definition of all available views
    """
    self.all_view_definitions = {}
    self.current_db: str = connection.engine.url.database  # type: ignore
    result = connection.execute(query)
    for view in result:
        if hasattr(view, "view_def") and hasattr(view, "schema"):
            view_definition = view.view_def
            if not view_definition and hasattr(view, "view_ddl"):
                view_definition = view.view_ddl
            else:
                view_definition = (
                    f"CREATE OR REPLACE VIEW {view.view_name} AS {view_definition}"
                )
            self.all_view_definitions[(view.view_name, view.schema)] = view_definition

        elif hasattr(view, "VIEW_DEF") and hasattr(view, "SCHEMA"):
            view_definition = view.VIEW_DEF
            if not view_definition and hasattr(view, "VIEW_DDL"):
                view_definition = view.VIEW_DDL
            else:
                view_definition = (
                    f"CREATE OR REPLACE VIEW {view.VIEW_NAME} AS {view_definition}"
                )
            self.all_view_definitions[(view.VIEW_NAME, view.SCHEMA)] = view_definition


def _get_col_type(
    self, coltype, precision, scale, length, colname
):  # pylint: disable=too-many-branches
    raw_type = coltype
    if coltype == "NUMBER":
        if precision is None and scale == 0:
            coltype = INTEGER()
        else:
            coltype = NUMBER(precision, scale)
            if precision is not None:
                if scale is not None:
                    raw_type += f"({precision},{scale})"
                else:
                    raw_type += f"({precision})"

    elif coltype == "FLOAT":
        # TODO: support "precision" here as "binary_precision"
        coltype = FLOAT()
    elif coltype in ("VARCHAR2", "NVARCHAR2", "CHAR", "NCHAR"):
        coltype = self.ischema_names.get(coltype)(length)
        if length:
            raw_type += f"({length})"
    elif "WITH TIME ZONE" in coltype or "TIMESTAMP" in coltype:
        coltype = TIMESTAMP(timezone=True)
    elif "INTERVAL" in coltype:
        coltype = INTERVAL()
    else:
        coltype = re.sub(r"\(\d+\)", "", coltype)
        try:
            coltype = self.ischema_names[coltype]
        except KeyError:
            util.warn(f"Did not recognize type '{coltype}' of column '{colname}'")
            coltype = sqltypes.NULLTYPE
    return coltype, raw_type


# pylint: disable=too-many-locals
@reflection.cache
def get_columns(self, connection, table_name, schema=None, **kw):
    """

    Dialect method overridden to add raw data type

    kw arguments can be:

        oracle_resolve_synonyms

        dblink

    """
    resolve_synonyms = kw.get("oracle_resolve_synonyms", False)
    dblink = kw.get("dblink", "")
    info_cache = kw.get("info_cache")

    (table_name, schema, dblink, _) = self._prepare_reflection_args(
        connection,
        table_name,
        schema,
        resolve_synonyms,
        dblink,
        info_cache=info_cache,
    )
    columns = []

    char_length_col = "data_length"
    if self._supports_char_length:
        char_length_col = "char_length"

    identity_cols = "NULL as default_on_null, NULL as identity_options"
    if self.server_version_info >= (12,):
        identity_cols = ORACLE_IDENTITY_TYPE.format(dblink=dblink)

    params = {"table_name": table_name}

    text = ORACLE_GET_COLUMNS.format(
        dblink=dblink, char_length_col=char_length_col, identity_cols=identity_cols
    )
    if schema is not None:
        params["owner"] = schema
        text += " AND col.owner = :owner "
    text += " ORDER BY col.column_id"

    cols = connection.execute(sql.text(text), params)

    for row in cols:
        colname = self.normalize_name(row[0])
        orig_colname = row[0]
        coltype = row[1]
        length = row[2]
        precision = row[3]
        scale = row[4]
        nullable = row[5] == "Y"
        default = row[6]
        comment = row[7]
        generated = row[8]
        default_on_nul = row[9]
        identity_options = row[10]

        coltype, raw_coltype = self._get_col_type(
            coltype, precision, scale, length, colname
        )

        computed = None
        if generated == "YES":
            computed = {"sqltext": default}
            default = None

        identity = None
        if identity_options is not None:
            identity = self._parse_identity_options(identity_options, default_on_nul)
            default = None

        cdict = {
            "name": colname,
            "type": coltype,
            "nullable": nullable,
            "default": default,
            "autoincrement": "auto",
            "comment": comment,
            "system_data_type": raw_coltype,
        }
        if orig_colname.lower() == orig_colname:
            cdict["quote"] = True
        if computed is not None:
            cdict["computed"] = computed
        if identity is not None:
            cdict["identity"] = identity

        columns.append(cdict)
    return columns


@reflection.cache
def get_table_names(self, connection, schema=None, **kw):
    """
    Exclude the materialized views from regular table names
    """
    schema = self.denormalize_name(schema or self.default_schema_name)

    # note that table_names() isn't loading DBLINKed or synonym'ed tables
    if schema is None:
        schema = self.default_schema_name

    tablespace = ""

    if self.exclude_tablespaces:
        exclude_tablespace = ", ".join([f"'{ts}'" for ts in self.exclude_tablespaces])
        tablespace = (
            "nvl(tablespace_name, 'no tablespace') "
            f"NOT IN ({exclude_tablespace}) AND "
        )
    sql_str = ORACLE_GET_TABLE_NAMES.format(tablespace=tablespace)
    cursor = connection.execute(sql.text(sql_str), {"owner": schema})
    return [row[0] for row in cursor]


def get_view_names(self, schema=None):
    """Return all materialized view names in `schema`.

    :param schema: Optional, retrieve names from a non-default schema.
        For special quoting, use :class:`.quoted_name`.

    """

    with self._operation_context() as conn:
        return self.dialect.get_view_names(conn, schema, info_cache=self.info_cache)


@reflection.cache
def get_view_names_dialect(self, connection, schema=None, **kw):
    schema = self.denormalize_name(schema or self.default_schema_name)
    sql_query = sql.text(GET_VIEW_NAMES)
    cursor = connection.execute(sql_query, {"owner": self.denormalize_name(schema)})
    return [self.normalize_name(row[0]) for row in cursor]


def get_mview_names(self, schema=None):
    """Return all materialized view names in `schema`.

    :param schema: Optional, retrieve names from a non-default schema.
        For special quoting, use :class:`.quoted_name`.

    """

    with self._operation_context() as conn:
        return self.dialect.get_mview_names(conn, schema, info_cache=self.info_cache)


@reflection.cache
def get_mview_names_dialect(self, connection, schema=None, **kw):
    schema = self.denormalize_name(schema or self.default_schema_name)
    sql_query = sql.text(GET_MATERIALIZED_VIEW_NAMES)
    cursor = connection.execute(sql_query, {"owner": self.denormalize_name(schema)})
    return [self.normalize_name(row[0]) for row in cursor]


@reflection.cache
def _get_constraint_data(self, connection, table_name, schema=None, dblink="", **kw):

    params = {"table_name": table_name, "owner": schema}
    text = ORACLE_ALL_CONSTRAINTS.format(dblink=dblink)

    rp = connection.execute(sql.text(text), params)
    constraint_data = rp.fetchall()
    return constraint_data


# ---------------------------------------------------------------------------
# Preserve-case variants — bound at instance level only when
# preserveIdentifierCase=True.  The original functions above are unchanged.
# ---------------------------------------------------------------------------


def normalize_name(self, name):
    """Return the Oracle identifier name exactly as stored in the data dictionary.

    Bound on the dialect instance only when preserveIdentifierCase=True.
    When not bound, SQLAlchemy's default normalize_name lowercases UPPERCASE
    unquoted Oracle identifiers (e.g. EMPLOYEES → employees).
    """
    return name


def denormalize_name(self, name):
    """Return the Oracle identifier name exactly as stored in the data dictionary.

    Bound on the dialect instance only when preserveIdentifierCase=True.
    When not bound, SQLAlchemy's default denormalize_name uppercases LOWERCASE
    unquoted Oracle identifiers (e.g. employees → EMPLOYEES).
    """
    return name


@reflection.cache
def get_table_comment_preserve_case(
    self,
    connection,
    table_name: str,
    schema: str = None,
    resolve_synonyms=False,
    dblink="",
    **kw,
):
    """Like get_table_comment but passes names as-is and uses a SQL query
    without LOWER(), so the dict key built by get_all_table_comments matches
    Oracle's native case stored in DBA_TAB_COMMENTS.
    """
    return get_table_comment_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=ORACLE_ALL_TABLE_COMMENTS_PRESERVE_CASE,
    )


@reflection.cache
def get_view_definition_preserve_case(
    self,
    connection,
    view_name: str,
    schema: str = None,
    resolve_synonyms=False,
    dblink="",
    **kw,
):
    """Like get_view_definition but passes names as-is and uses a SQL query
    without LOWER(), so the dict key built by get_all_view_definitions matches
    Oracle's native case stored in DBA_VIEWS / DBA_MVIEWS.
    """
    return get_view_definition_wrapper(
        self,
        connection,
        table_name=view_name,
        schema=schema,
        query=ORACLE_ALL_VIEW_DEFINITIONS_PRESERVE_CASE,
    )


@reflection.cache
def get_indexes_preserve_case(
    self,
    connection,
    table_name,
    schema=None,
    resolve_synonyms=False,
    dblink="",
    **kw,
):
    """Override get_indexes to fix two issues when preserveIdentifierCase=True:
    1. Use original table_name (before _prepare_reflection_args uppercases it)
       so quoted lowercase identifiers are found in ALL_IND_COLUMNS.
    2. Access result row columns case-insensitively — Oracle thick mode returns
       INDEX_NAME (uppercase) while thin mode returns index_name (lowercase).
       A lowercased dict handles both without branching.
    """
    original_table_name = table_name
    info_cache = kw.get("info_cache")
    (table_name, schema, dblink, _) = self._prepare_reflection_args(
        connection,
        table_name,
        schema,
        resolve_synonyms,
        dblink,
        info_cache=info_cache,
    )

    params = {"table_name": original_table_name}
    text = (
        "SELECT a.index_name, a.column_name, "
        "\nb.index_type, b.uniqueness, b.compression, b.prefix_length "
        "\nFROM ALL_IND_COLUMNS%(dblink)s a, "
        "\nALL_INDEXES%(dblink)s b "
        "\nWHERE "
        "\na.index_name = b.index_name "
        "\nAND a.table_owner = b.table_owner "
        "\nAND a.table_name = b.table_name "
        "\nAND a.table_name = CAST(:table_name AS VARCHAR(128))"
    )

    if schema is not None:
        params["schema"] = schema
        text += " AND a.table_owner = :schema "

    text += " ORDER BY a.index_name, a.column_position"
    text = text % {"dblink": dblink}

    rp = connection.execute(sql.text(text), params)
    indexes = []
    last_index_name = None
    pk_constraint = self.get_pk_constraint(
        connection,
        table_name,
        schema,
        resolve_synonyms=resolve_synonyms,
        dblink=dblink,
        info_cache=kw.get("info_cache"),
    )

    uniqueness = dict(NONUNIQUE=False, UNIQUE=True)
    enabled = dict(DISABLED=False, ENABLED=True)
    oracle_sys_col = re.compile(r"SYS_NC\d+\$", re.IGNORECASE)

    index = None
    for rset in rp:
        row = {k.lower(): v for k, v in rset._mapping.items()}
        raw_index_name = row["index_name"]
        index_name_normalized = self.normalize_name(raw_index_name)

        if pk_constraint and index_name_normalized == pk_constraint["name"]:
            continue

        if raw_index_name != last_index_name:
            index = dict(
                name=index_name_normalized,
                column_names=[],
                dialect_options={},
            )
            indexes.append(index)

        index["unique"] = uniqueness.get(row["uniqueness"], False)

        if row["index_type"] in ("BITMAP", "FUNCTION-BASED BITMAP"):
            index["dialect_options"]["oracle_bitmap"] = True
        if enabled.get(row["compression"], False):
            index["dialect_options"]["oracle_compress"] = row["prefix_length"]

        if not oracle_sys_col.match(row["column_name"]):
            index["column_names"].append(self.normalize_name(row["column_name"]))

        last_index_name = raw_index_name

    return indexes
