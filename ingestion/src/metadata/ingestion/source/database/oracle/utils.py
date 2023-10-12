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
    ORACLE_ALL_TABLE_COMMENTS,
    ORACLE_ALL_VIEW_DEFINITIONS,
    ORACLE_GET_COLUMNS,
    ORACLE_GET_SCHEMA_NAME,
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


def get_table_names_reflection(self, schema=None, **kw):
    """Return all table names in referred to within a particular schema.

    The names are expected to be real tables only, not views.
    Views are instead returned using the
    :meth:`_reflection.Inspector.get_view_names`
    method.


    :param schema: Schema name. If ``schema`` is left at ``None``, the
        database's default schema is
        used, else the named schema is searched.  If the database does not
        support named schemas, behavior is undefined if ``schema`` is not
        passed as ``None``.  For special quoting, use :class:`.quoted_name`.

    .. seealso::

        :meth:`_reflection.Inspector.get_sorted_table_and_fkc_names`

        :attr:`_schema.MetaData.sorted_tables`

    """

    with self._operation_context() as conn:  # pylint: disable=protected-access
        return self.dialect.get_table_names(conn, schema, **kw)


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


def _get_col_type(
    self, coltype, precision, scale, length, colname
):  # pylint: disable=too-many-branches
    """ """
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
        length = row[2]
        nullable = row[5] == "Y"
        default = row[6]
        generated = row[8]
        default_on_nul = row[9]
        identity_options = row[10]

        coltype, raw_coltype = self._get_col_type(
            row.data_type, row.data_precision, row.data_scale, length, colname
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
            "comment": row.comments,
            "system_data_type": raw_coltype,
        }
        if row.column_name.lower() == row.column_name:
            cdict["quote"] = True
        if computed is not None:
            cdict["computed"] = computed
        if identity is not None:
            cdict["identity"] = identity

        columns.append(cdict)
    return columns


def get_filter_pattern_query(filter_pattern_name, name, exclude=False):
    query_conditions = []
    # Define the operator based on whether it's an inclusion or exclusion query
    operator = "NOT LIKE" if exclude else "LIKE"
    # Iterate over the list and build the query conditions
    for pattern in filter_pattern_name:
        query_conditions.append(f"{name} {operator} '{pattern}'")
    # Join the query conditions with 'OR' and add them to the SQL query
    if query_conditions:
        query_condition = " OR ".join(query_conditions)
        return query_condition
    return ""


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
    if kw["filter_pattern"]:
        tb_patterns_include = [
            tb_name.replace("%", "%%")
            for tb_name in kw["filter_pattern"].includes
            if kw["filter_pattern"].includes
        ]
        tb_patterns_exclude = [
            tb_name.replace("%", "%%")
            for tb_name in kw["filter_pattern"].excludes
            if kw["filter_pattern"].excludes
        ]

        format_pattern = (
            f'and( {get_filter_pattern_query(tb_patterns_include,"table_name")})'
            if kw["filter_pattern"].includes
            else f'and({get_filter_pattern_query(tb_patterns_exclude, "table_name",exclude=True)})'
        )
    cursor = connection.execute(
        sql.text(
            ORACLE_GET_TABLE_NAMES.format(
                tablespace=tablespace, table_filter=format_pattern
            )
        )
        if kw.get("pushDownFilter") and kw["filter_pattern"]
        else sql.text(
            ORACLE_GET_TABLE_NAMES.format(tablespace=tablespace, table_filter="")
        ),
        {"owner": schema},
    )
    return [row[0] for row in cursor]


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


def get_mview_definition(self, mview_name, schema=None):
    """Return definition for `mview_name`.

    :param schema: Optional, retrieve names from a non-default schema.
        For special quoting, use :class:`.quoted_name`.

    """

    with self._operation_context() as conn:
        return self.dialect.get_view_definition(
            conn, mview_name, schema, info_cache=self.info_cache
        )


def get_schema_names_reflection(self, **kw):
    """Return all schema names."""

    if hasattr(self.dialect, "get_schema_names"):
        with self._operation_context() as conn:  # pylint: disable=protected-access
            return self.dialect.get_schema_names(conn, info_cache=self.info_cache, **kw)
    return []


def get_schema_names(self, connection, **kw):
    """Return all schema names."""

    query = ORACLE_GET_SCHEMA_NAME
    if kw["filter_pattern"]:
        sc_patterns_include = [
            sc_name.replace("%", "%%")
            for sc_name in kw["filter_pattern"].includes
            if kw["filter_pattern"].includes
        ]
        sc_patterns_exclude = [
            sc_name.replace("%", "%%")
            for sc_name in kw["filter_pattern"].excludes
            if kw["filter_pattern"].excludes
        ]

        format_pattern = (
            f'where {get_filter_pattern_query(sc_patterns_include,"username")}'
            if kw["filter_pattern"].includes
            else f'where {get_filter_pattern_query(sc_patterns_exclude, "username",exclude=True)}'
        )

    cursor = connection.execute(
        query.format(format_pattern)
        if kw.get("pushDownFilter") and kw["filter_pattern"]
        else query.format("")
    )
    result = [self.normalize_name(row[0]) for row in cursor]
    return result
