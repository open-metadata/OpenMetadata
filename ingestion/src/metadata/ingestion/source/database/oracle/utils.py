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
from itertools import groupby

from sqlalchemy import sql, util
from sqlalchemy.dialects.oracle.base import FLOAT, INTEGER, INTERVAL, NUMBER, TIMESTAMP
from sqlalchemy.engine import reflection
from sqlalchemy.sql import sqltypes

from metadata.ingestion.source.database.oracle.queries import (
    GET_MATERIALIZED_VIEW_NAMES,
    ORACLE_ALL_TABLE_COMMENTS,
    ORACLE_ALL_VIEW_DEFINITIONS,
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
        table_name=table_name,
        schema=schema if schema else None,
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
        table_name=view_name,
        schema=schema if schema else None,
        query=ORACLE_ALL_VIEW_DEFINITIONS,
    )


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
        colname = row[0]
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
    return [self.denormalize_name(row[0]) for row in cursor]


@reflection.cache
def get_schema_names(self, connection, **kw):
    s = "SELECT username FROM all_users ORDER BY username"
    cursor = connection.exec_driver_sql(s)
    return [row[0] for row in cursor]


def get_mview_definition(self, mview_name, schema=None):
    """Return definition for `mview_name`.

    :param schema: Optional, retrieve names from a non-default schema.
        For special quoting, use :class:`.quoted_name`.

    """

    with self._operation_context() as conn:
        return self.dialect.get_view_definition(
            conn, mview_name, schema, info_cache=self.info_cache
        )


def _get_default_schema_name(self, connection):
    return self.denormalize_name(
        connection.exec_driver_sql(
            "select sys_context( 'userenv', 'current_schema' ) from dual"
        ).scalar()
    )


@reflection.cache
def _prepare_reflection_args(
    self, connection, table_name, schema=None, resolve_synonyms=False, dblink="", **kw
):

    if resolve_synonyms:
        actual_name, owner, dblink, synonym = self._resolve_synonym(
            connection,
            desired_owner=self.denormalize_name(schema),
            desired_synonym=self.denormalize_name(table_name),
        )
    else:
        actual_name, owner, dblink, synonym = None, None, None, None
    if not actual_name:
        actual_name = self.denormalize_name(table_name)

    if dblink:
        # using user_db_links here since all_db_links appears
        # to have more restricted permissions.
        # https://docs.oracle.com/cd/B28359_01/server.111/b28310/ds_admin005.htm
        # will need to hear from more users if we are doing
        # the right thing here.  See [ticket:2619]
        owner = connection.scalar(
            sql.text("SELECT username FROM user_db_links " "WHERE db_link=:link"),
            dict(link=dblink),
        )
        dblink = "@" + dblink
    elif not owner:
        owner = self.denormalize_name(schema or self.default_schema_name)
    if table_name == table_name.lower():
        actual_name = table_name
    return (actual_name, owner, dblink or "", synonym)


@reflection.cache
def get_pk_constraint(self, connection, table_name, schema=None, **kw):
    resolve_synonyms = kw.get("oracle_resolve_synonyms", False)
    dblink = kw.get("dblink", "")
    info_cache = kw.get("info_cache")

    (table_name, schema, dblink, synonym) = self._prepare_reflection_args(
        connection,
        table_name,
        schema,
        resolve_synonyms,
        dblink,
        info_cache=info_cache,
    )
    pkeys = []
    constraint_name = None
    constraint_data = self._get_constraint_data(
        connection,
        table_name,
        schema,
        dblink,
        info_cache=kw.get("info_cache"),
    )

    for row in constraint_data:
        (
            cons_name,
            cons_type,
            local_column,
            remote_table,
            remote_column,
            remote_owner,
        ) = row[0:2] + tuple([self.denormalize_name(x) for x in row[2:6]])
        if cons_type == "P":
            if constraint_name is None:
                constraint_name = self.denormalize_name(cons_name)
            pkeys.append(local_column)
    return {"constrained_columns": pkeys, "name": constraint_name}


@reflection.cache
def get_unique_constraints(self, connection, table_name, schema=None, **kw):

    resolve_synonyms = kw.get("oracle_resolve_synonyms", False)
    dblink = kw.get("dblink", "")
    info_cache = kw.get("info_cache")

    (table_name, schema, dblink, synonym) = self._prepare_reflection_args(
        connection,
        table_name,
        schema,
        resolve_synonyms,
        dblink,
        info_cache=info_cache,
    )

    constraint_data = self._get_constraint_data(
        connection,
        table_name,
        schema,
        dblink,
        info_cache=kw.get("info_cache"),
    )

    unique_keys = filter(lambda x: x[1] == "U", constraint_data)
    uniques_group = groupby(unique_keys, lambda x: x[0])

    index_names = {
        ix["name"] for ix in self.get_indexes(connection, table_name, schema=schema)
    }
    return [
        {
            "name": name,
            "column_names": cols,
            "duplicates_index": name if name in index_names else None,
        }
        for name, cols in [
            [
                self.denormalize_name(i[0]),
                [self.denormalize_name(x[2]) for x in i[1]],
            ]
            for i in uniques_group
        ]
    ]


@reflection.cache
def get_foreign_keys(self, connection, table_name, schema=None, **kw):
    """

    kw arguments can be:

        oracle_resolve_synonyms

        dblink

    """
    requested_schema = schema  # to check later on
    resolve_synonyms = kw.get("oracle_resolve_synonyms", False)
    dblink = kw.get("dblink", "")
    info_cache = kw.get("info_cache")

    (table_name, schema, dblink, synonym) = self._prepare_reflection_args(
        connection,
        table_name,
        schema,
        resolve_synonyms,
        dblink,
        info_cache=info_cache,
    )

    constraint_data = self._get_constraint_data(
        connection,
        table_name,
        schema,
        dblink,
        info_cache=kw.get("info_cache"),
    )

    def fkey_rec():
        return {
            "name": None,
            "constrained_columns": [],
            "referred_schema": None,
            "referred_table": None,
            "referred_columns": [],
            "options": {},
        }

    fkeys = util.defaultdict(fkey_rec)

    for row in constraint_data:
        (
            cons_name,
            cons_type,
            local_column,
            remote_table,
            remote_column,
            remote_owner,
        ) = row[0:2] + tuple([self.denormalize_name(x) for x in row[2:6]])

        cons_name = self.denormalize_name(cons_name)

        if cons_type == "R":
            if remote_table is None:
                # ticket 363
                util.warn(
                    (
                        "Got 'None' querying 'table_name' from "
                        "all_cons_columns%(dblink)s - does the user have "
                        "proper rights to the table?"
                    )
                    % {"dblink": dblink}
                )
                continue

            rec = fkeys[cons_name]
            rec["name"] = cons_name
            local_cols, remote_cols = (
                rec["constrained_columns"],
                rec["referred_columns"],
            )

            if not rec["referred_table"]:
                if resolve_synonyms:
                    (
                        ref_remote_name,
                        ref_remote_owner,
                        ref_dblink,
                        ref_synonym,
                    ) = self._resolve_synonym(
                        connection,
                        desired_owner=self.denormalize_name(remote_owner),
                        desired_table=self.denormalize_name(remote_table),
                    )
                    if ref_synonym:
                        remote_table = self.denormalize_name(ref_synonym)
                        remote_owner = self.denormalize_name(ref_remote_owner)

                rec["referred_table"] = remote_table

                if (
                    requested_schema is not None
                    or self.denormalize_name(remote_owner) != schema
                ):
                    rec["referred_schema"] = remote_owner

                if row[9] != "NO ACTION":
                    rec["options"]["ondelete"] = row[9]

            local_cols.append(local_column)
            remote_cols.append(remote_column)

    return list(fkeys.values())


@reflection.cache
def get_view_names(self, connection, schema=None, **kw):
    schema = self.denormalize_name(schema or self.default_schema_name)
    s = sql.text("SELECT view_name FROM all_views WHERE owner = :owner")
    cursor = connection.execute(s, dict(owner=self.denormalize_name(schema)))
    return [self.denormalize_name(row[0]) for row in cursor]
