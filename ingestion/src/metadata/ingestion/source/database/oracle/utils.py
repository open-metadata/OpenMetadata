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
import traceback

from sqlalchemy import sql, text, util
from sqlalchemy.dialects.oracle.base import FLOAT, INTEGER, INTERVAL, NUMBER, TIMESTAMP
from sqlalchemy.engine import reflection
from sqlalchemy.exc import DatabaseError
from sqlalchemy.sql import sqltypes

from metadata.ingestion.source.database.oracle.queries import (
    GET_MATERIALIZED_VIEW_NAMES,
    GET_VIEW_NAMES,
    ORACLE_CONSTRAINTS,
    ORACLE_GET_ALL_VIEW_AND_MVIEW_NAMES,
    ORACLE_GET_COLUMNS,
    ORACLE_GET_MVIEW_QUERY_BY_NAME,
    ORACLE_GET_TABLE_NAMES,
    ORACLE_GET_VIEW_DEFINITION_BY_NAME,
    ORACLE_GET_VIEW_TEXT_BY_NAME,
    ORACLE_IDENTITY_TYPE,
    ORACLE_TABLE_COMMENTS,
    ORACLE_TABLE_COMMENTS_PRESERVE_CASE,
    ORACLE_VIEW_DEFINITIONS,
    ORACLE_VIEW_DEFINITIONS_PRESERVE_CASE,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_table_comment_wrapper,
    get_view_definition_wrapper,
)

logger = ingestion_logger()

# ALL_TAB_COLS.CHAR_USED is 'C' when a column was declared with character length
# semantics (VARCHAR2(10 CHAR)) and 'B' for byte semantics (VARCHAR2(10 BYTE), the
# default). Oracle only renders the qualifier for VARCHAR2 and CHAR: NVARCHAR2 and
# NCHAR are always character based and are never displayed with it.
CHAR_SEMANTICS_FLAG = "C"
CHAR_SEMANTICS_TYPES = ("VARCHAR2", "CHAR")


def get_table_prefix_from_connection(service_connection) -> str:
    return "DBA" if getattr(service_connection, "useDBATable", True) else "ALL"


def _get_table_prefix(self) -> str:
    return getattr(self, "table_prefix", "DBA")


@reflection.cache
def get_table_comment(
    self,
    connection,
    table_name: str,
    schema: str = None,  # noqa: RUF013
    resolve_synonyms=False,
    dblink="",
    **kw,
):
    return get_table_comment_wrapper(
        self,
        connection,
        table_name=table_name.lower(),
        schema=schema.lower() if schema else None,
        query=ORACLE_TABLE_COMMENTS.format(prefix=_get_table_prefix(self)),
    )


@reflection.cache
def get_view_definition(
    self,
    connection,
    view_name: str,
    schema: str = None,  # noqa: RUF013
    resolve_synonyms=False,
    dblink="",
    **kw,
):
    return get_view_definition_wrapper(
        self,
        connection,
        table_name=view_name.lower(),
        schema=schema.lower() if schema else None,
        query=ORACLE_VIEW_DEFINITIONS.format(prefix=_get_table_prefix(self)),
    )


@reflection.cache
def get_all_view_definitions(self, connection, query):
    """
    Method to fetch view definition of all available views.

    The bulk query reads the view text from the LONG columns DBA_VIEWS.TEXT /
    DBA_MVIEWS.QUERY. In Oracle thick mode a view whose definition is larger than
    OCI's LONG fetch buffer raises ORA-01406 while the row is being fetched,
    which aborts the whole array fetch and leaves every view without a
    definition. On that database error, fall back to reading each definition on
    its own so one oversized or failing view cannot blank out the rest.
    See https://github.com/open-metadata/OpenMetadata/issues/30319
    """
    self.all_view_definitions = {}
    self.current_db: str = connection.engine.url.database  # type: ignore
    try:
        for view in connection.execute(text(query)):
            _store_bulk_view_definition(self, view)
    except DatabaseError as exc:
        logger.warning(f"Bulk Oracle view-definition fetch failed ({exc}). Falling back to per-view retrieval.")
        logger.debug(traceback.format_exc())
        _get_view_definitions_individually(self, connection)


def _store_bulk_view_definition(self, view) -> None:
    """Store one row of the bulk ORACLE_VIEW_DEFINITIONS result. Thin mode
    returns lowercase attribute names and thick mode uppercase, so both cases
    are handled.
    """
    if hasattr(view, "view_def") and hasattr(view, "schema"):
        view_definition = view.view_def
        if not view_definition and hasattr(view, "view_ddl"):
            view_definition = view.view_ddl
        else:
            view_definition = f"CREATE OR REPLACE VIEW {view.view_name} AS {view_definition}"
        self.all_view_definitions[(view.view_name, view.schema)] = view_definition

    elif hasattr(view, "VIEW_DEF") and hasattr(view, "SCHEMA"):
        view_definition = view.VIEW_DEF
        if not view_definition and hasattr(view, "VIEW_DDL"):
            view_definition = view.VIEW_DDL
        else:
            view_definition = f"CREATE OR REPLACE VIEW {view.VIEW_NAME} AS {view_definition}"
        self.all_view_definitions[(view.VIEW_NAME, view.SCHEMA)] = view_definition


def _get_view_definitions_individually(self, connection) -> None:
    """Populate self.all_view_definitions one view at a time. Each fetch is
    isolated so a view that truncates or errors is skipped instead of aborting
    the whole run. Used only as the fallback after the bulk fetch fails.
    """
    # Match the cache-key casing that get_view_definition uses for lookups:
    # lowercased by default, kept verbatim when preserveIdentifierCase is set.
    normalize = (lambda value: value) if getattr(self, "preserve_identifier_case", False) else str.lower
    prefix = _get_table_prefix(self)
    view_names = connection.execute(text(ORACLE_GET_ALL_VIEW_AND_MVIEW_NAMES.format(prefix=prefix))).fetchall()
    for owner, name, object_type in view_names:
        try:
            definition = _fetch_view_definition_by_name(connection, prefix, owner, name, object_type)
        except DatabaseError as exc:
            logger.warning(f"Could not fetch view definition for {owner}.{name}: {exc}")
            logger.debug(traceback.format_exc())
            continue
        if definition:
            self.all_view_definitions[(normalize(name), normalize(owner))] = definition


def _read_scalar(result):
    """Return a scalar result, materializing a LOB locator to str if needed."""
    value = result.scalar()
    return value.read() if value is not None and hasattr(value, "read") else value


def _fetch_view_definition_by_name(connection, prefix, owner, name, object_type):
    """Fetch one view's definition without the bulk LONG array truncation.

    Reads the raw text/query with a single-row query first. A single-row fetch is
    not an array fetch, so it does not hit ORA-01406, and it needs no privileges
    beyond the bulk read (this is the same column SQLAlchemy's Oracle dialect
    reads). Only when the text is NULL or still cannot be read does it fall back
    to DBMS_METADATA.GET_DDL, mirroring the bulk query's text-else-GET_DDL logic.
    """
    is_mview = object_type == "MATERIALIZED_VIEW"
    text_query = ORACLE_GET_MVIEW_QUERY_BY_NAME if is_mview else ORACLE_GET_VIEW_TEXT_BY_NAME
    try:
        raw_text = _read_scalar(
            connection.execute(text(text_query.format(prefix=prefix)), {"owner": owner, "name": name})
        )
        if raw_text:
            return f"CREATE OR REPLACE VIEW {name} AS {raw_text}"
    except DatabaseError:
        logger.debug(f"Single-row text read failed for {owner}.{name}, using GET_DDL")
    return _read_scalar(
        connection.execute(
            text(ORACLE_GET_VIEW_DEFINITION_BY_NAME),
            {"object_type": object_type, "name": name, "owner": owner},
        )
    )


def _get_col_type(  # pylint: disable=too-many-branches
    self, coltype, precision, scale, length, colname, char_used=None
):
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
        char_semantics = char_used == CHAR_SEMANTICS_FLAG and coltype in CHAR_SEMANTICS_TYPES
        coltype = self.ischema_names.get(coltype)(length)
        if length:
            raw_type += f"({length} CHAR)" if char_semantics else f"({length})"
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
def get_columns(self, connection, table_name, schema=None, **kw):  # noqa: C901
    """

    Dialect method overridden to add raw data type

    kw arguments can be:

        oracle_resolve_synonyms

        dblink

    """
    dblink = kw.get("dblink", "")
    resolve_synonyms = kw.get("oracle_resolve_synonyms", False)
    info_cache = kw.get("info_cache")

    if resolve_synonyms:
        try:
            rows = list(self._get_synonyms(connection, schema, [table_name], dblink, info_cache=info_cache))
        except Exception:
            rows = []

        if rows:
            row = rows[0]
            actual_name = getattr(row, "table_name", None)
            actual_owner = getattr(row, "table_owner", None)
            db_link_val = getattr(row, "db_link", None)

            if actual_name:
                table_name = self.denormalize_name(actual_name)
            if actual_owner:
                schema = self.denormalize_name(actual_owner)
            if db_link_val:
                if not db_link_val.startswith("@"):
                    dblink = "@" + db_link_val
                else:
                    dblink = db_link_val
    else:
        table_name = self.denormalize_name(table_name)
        if schema is not None:
            schema = self.denormalize_name(schema)

    columns = []

    char_length_col = "data_length"
    if self._supports_char_length:
        char_length_col = "char_length"

    identity_cols = "NULL as default_on_null, NULL as identity_options"
    if self.server_version_info >= (12,):
        identity_cols = ORACLE_IDENTITY_TYPE.format(dblink=dblink, prefix=_get_table_prefix(self))

    params = {"table_name": table_name}

    text = ORACLE_GET_COLUMNS.format(
        dblink=dblink,
        char_length_col=char_length_col,
        identity_cols=identity_cols,
        prefix=_get_table_prefix(self),
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
        char_used = row[9]
        default_on_nul = row[10]
        identity_options = row[11]

        coltype, raw_coltype = self._get_col_type(coltype, precision, scale, length, colname, char_used)

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
        tablespace = f"nvl(tablespace_name, 'no tablespace') NOT IN ({exclude_tablespace}) AND "
    sql_str = ORACLE_GET_TABLE_NAMES.format(tablespace=tablespace, prefix=_get_table_prefix(self))
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
    sql_query = sql.text(GET_VIEW_NAMES.format(prefix=_get_table_prefix(self)))
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
    sql_query = sql.text(GET_MATERIALIZED_VIEW_NAMES.format(prefix=_get_table_prefix(self)))
    cursor = connection.execute(sql_query, {"owner": self.denormalize_name(schema)})
    return [self.normalize_name(row[0]) for row in cursor]


@reflection.cache
def _get_constraint_data(self, connection, table_name, schema=None, dblink="", **kw):

    params = {"table_name": table_name, "owner": schema}
    text = ORACLE_CONSTRAINTS.format(dblink=dblink, prefix=_get_table_prefix(self))

    rp = connection.execute(sql.text(text), params)
    constraint_data = rp.fetchall()
    return constraint_data  # noqa: RET504


def _prepare_constraint_args(self, connection, table_name, schema, **kw):
    dblink = kw.get("dblink", "")
    if dblink and not dblink.startswith("@"):
        dblink = f"@{dblink}"

    if kw.get("oracle_resolve_synonyms", False):
        rows = list(
            self._get_synonyms(
                connection,
                schema,
                [table_name],
                dblink,
                info_cache=kw.get("info_cache"),
            )
        )
        if rows:
            row = rows[0]
            table_name = self.denormalize_name(row.table_name)
            schema = self.denormalize_name(row.table_owner)
            if row.db_link:
                dblink = row.db_link if row.db_link.startswith("@") else f"@{row.db_link}"
    else:
        table_name = self.denormalize_name(table_name)
        schema = self.denormalize_name(schema or self.default_schema_name)

    return table_name, schema, dblink


@reflection.cache
def get_pk_constraint(self, connection, table_name, schema=None, **kw):
    """Reflect a primary key from the selected Oracle catalog."""
    table_name, schema, dblink = _prepare_constraint_args(self, connection, table_name, schema, **kw)
    constraint_data = _get_constraint_data(
        self,
        connection,
        table_name,
        schema,
        dblink,
        info_cache=kw.get("info_cache"),
    )

    constrained_columns = []
    constraint_name = None
    for row in constraint_data:
        if row[1] == "P":
            constraint_name = constraint_name or self.normalize_name(row[0])
            constrained_columns.append(self.normalize_name(row[2]))

    return {"constrained_columns": constrained_columns, "name": constraint_name}


@reflection.cache
def get_unique_constraints(self, connection, table_name, schema=None, **kw):
    """Reflect unique constraints from the selected Oracle catalog."""
    table_name, schema, dblink = _prepare_constraint_args(self, connection, table_name, schema, **kw)
    constraint_data = _get_constraint_data(
        self,
        connection,
        table_name,
        schema,
        dblink,
        info_cache=kw.get("info_cache"),
    )

    unique_constraints = {}
    for row in constraint_data:
        if row[1] != "U":
            continue
        constraint_name = self.normalize_name(row[0])
        index_name = self.normalize_name(row[10])
        constraint = unique_constraints.setdefault(
            constraint_name,
            {
                "name": constraint_name,
                "column_names": [],
                "duplicates_index": constraint_name if index_name == constraint_name else None,
            },
        )
        constraint["column_names"].append(self.normalize_name(row[2]))

    return list(unique_constraints.values())


@reflection.cache
def get_foreign_keys(self, connection, table_name, schema=None, **kw):
    """Reflect foreign keys from the selected Oracle catalog."""
    requested_schema = schema
    table_name, schema, dblink = _prepare_constraint_args(self, connection, table_name, schema, **kw)
    constraint_data = _get_constraint_data(
        self,
        connection,
        table_name,
        schema,
        dblink,
        info_cache=kw.get("info_cache"),
    )

    foreign_keys = {}
    for row in constraint_data:
        if row[1] != "R":
            continue

        constraint_name = self.normalize_name(row[0])
        local_column = self.normalize_name(row[2])
        remote_table = self.normalize_name(row[3])
        remote_column = self.normalize_name(row[4])
        remote_owner = self.normalize_name(row[5])

        if remote_table is None:
            util.warn(
                f"Got 'None' querying 'table_name' from {_get_table_prefix(self)}_CONS_COLUMNS{dblink}; "
                "does the user have proper rights to the table?"
            )
            continue

        foreign_key = foreign_keys.setdefault(
            constraint_name,
            {
                "name": constraint_name,
                "constrained_columns": [],
                "referred_schema": None,
                "referred_table": remote_table,
                "referred_columns": [],
                "options": {},
            },
        )
        if requested_schema is not None or self.denormalize_name(remote_owner) != schema:
            foreign_key["referred_schema"] = remote_owner
        if row[9] != "NO ACTION":
            foreign_key["options"]["ondelete"] = row[9]
        foreign_key["constrained_columns"].append(local_column)
        foreign_key["referred_columns"].append(remote_column)

    return list(foreign_keys.values())


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
    schema: str = None,  # noqa: RUF013
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
        query=ORACLE_TABLE_COMMENTS_PRESERVE_CASE.format(prefix=_get_table_prefix(self)),
    )


@reflection.cache
def get_view_definition_preserve_case(
    self,
    connection,
    view_name: str,
    schema: str = None,  # noqa: RUF013
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
        query=ORACLE_VIEW_DEFINITIONS_PRESERVE_CASE.format(prefix=_get_table_prefix(self)),
    )


@reflection.cache
def get_indexes_preserve_case(  # noqa: C901
    self,
    connection,
    table_name,
    schema=None,
    resolve_synonyms=False,
    dblink="",
    **kw,
):
    """Override get_indexes to fix two issues when preserveIdentifierCase=True:
    1. Use original table_name (before denormalize_name uppercases it)
       so quoted lowercase identifiers are found in ALL_IND_COLUMNS.
    2. Access result row columns case-insensitively — Oracle thick mode returns
       INDEX_NAME (uppercase) while thin mode returns index_name (lowercase).
       A lowercased dict handles both without branching.
    """
    original_table_name = table_name
    resolve_synonyms = kw.get("oracle_resolve_synonyms", False)

    # SQLAlchemy 2.0 removed _prepare_reflection_args; denormalize schema/table
    # for the pk_constraint lookup while the index query itself uses
    # original_table_name (preserve-case mode keeps identifiers as-is).
    table_name = self.denormalize_name(table_name)
    if schema is not None:
        schema = self.denormalize_name(schema)
    if dblink and not dblink.startswith("@"):
        dblink = "@" + dblink

    if resolve_synonyms:
        try:
            rows = list(
                self._get_synonyms(
                    connection,
                    schema,
                    [table_name],
                    dblink,
                    info_cache=kw.get("info_cache"),
                )
            )
        except Exception:
            rows = []
        if rows:
            row = rows[0]
            actual_name = getattr(row, "table_name", None)
            actual_owner = getattr(row, "table_owner", None)
            db_link_val = getattr(row, "db_link", None)
            if actual_name:
                table_name = self.denormalize_name(actual_name)
            if actual_owner:
                schema = self.denormalize_name(actual_owner)
            if db_link_val:
                if not db_link_val.startswith("@"):
                    dblink = "@" + db_link_val
                else:
                    dblink = db_link_val

    params = {"table_name": original_table_name}
    prefix = _get_table_prefix(self)
    text = (
        "SELECT a.index_name, a.column_name, "
        "\nb.index_type, b.uniqueness, b.compression, b.prefix_length "
        "\nFROM %(prefix)s_IND_COLUMNS%(dblink)s a, "
        "\n%(prefix)s_INDEXES%(dblink)s b "
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
    text = text % {"dblink": dblink, "prefix": prefix}

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

    uniqueness = dict(NONUNIQUE=False, UNIQUE=True)  # noqa: C408
    enabled = dict(DISABLED=False, ENABLED=True)  # noqa: C408
    oracle_sys_col = re.compile(r"SYS_NC\d+\$", re.IGNORECASE)

    index = None
    for rset in rp:
        row = {k.lower(): v for k, v in rset._mapping.items()}
        raw_index_name = row["index_name"]
        index_name_normalized = self.normalize_name(raw_index_name)

        if pk_constraint and index_name_normalized == pk_constraint["name"]:
            continue

        if raw_index_name != last_index_name:
            index = dict(  # noqa: C408
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
