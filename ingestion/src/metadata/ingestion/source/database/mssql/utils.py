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
MSSQL SQLAlchemy Helper Methods
"""

from typing import Optional

from sqlalchemy import Column, Integer, MetaData, String, Table, alias, sql, text
from sqlalchemy import types as sqltypes
from sqlalchemy import util
from sqlalchemy.dialects.mssql import information_schema as ischema
from sqlalchemy.dialects.mssql.base import (
    MSBinary,
    MSChar,
    MSNChar,
    MSNText,
    MSNVarchar,
    MSString,
    MSText,
    MSVarBinary,
    _owner_plus_db,
    _switch_db,
    update_wrapper,
)
from sqlalchemy.engine import Engine, reflection
from sqlalchemy.sql import func
from sqlalchemy.types import NVARCHAR
from sqlalchemy.util import compat

from metadata.ingestion.source.database.mssql.queries import (
    GET_DB_CONFIGS,
    MSSQL_ALL_VIEW_DEFINITIONS,
    MSSQL_GET_FOREIGN_KEY,
    MSSQL_GET_TABLE_COMMENTS,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_display_datatype,
    get_table_comment_wrapper,
    get_view_definition_wrapper,
)

logger = ingestion_logger()


@reflection.cache
def get_table_comment(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    return get_table_comment_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=MSSQL_GET_TABLE_COMMENTS,
    )


def db_plus_owner_listing(fn):
    def wrap(dialect, connection, schema=None, **kw):
        schema = f"[{schema}]" if schema and "." in schema else schema
        dbname, owner = _owner_plus_db(dialect, schema)
        return _switch_db(
            dbname, connection, fn, dialect, connection, dbname, owner, schema, **kw
        )

    return update_wrapper(wrap, fn)


def db_plus_owner(fn):
    def wrap(dialect, connection, tablename, schema=None, **kw):
        schema = f"[{schema}]" if schema and "." in schema else schema
        dbname, owner = _owner_plus_db(dialect, schema)
        return _switch_db(
            dbname,
            connection,
            fn,
            dialect,
            connection,
            tablename,
            dbname,
            owner,
            schema,
            **kw,
        )

    return update_wrapper(wrap, fn)


@reflection.cache
@db_plus_owner
def get_columns(
    self, connection, tablename, dbname, owner, schema, **kw
):  # pylint: disable=unused-argument, too-many-locals, disable=too-many-branches, too-many-statements
    """
    This function overrides to add support for column comments
    """
    is_temp_table = tablename.startswith("#")
    if is_temp_table:
        (
            owner,
            tablename,
        ) = self._get_internal_temp_table_name(  # pylint: disable=protected-access
            connection, tablename
        )

        columns = ischema.mssql_temp_table_columns
    else:
        columns = ischema.columns

    computed_cols = ischema.computed_columns
    identity_cols = ischema.identity_columns
    sqlalchemy_metadata = MetaData()
    extended_properties = Table(
        "extended_properties",
        sqlalchemy_metadata,
        Column("major_id", Integer, primary_key=True),
        Column("minor_id", Integer, primary_key=True),
        Column("name", String, primary_key=True),
        Column("value", String),
        Column("class_desc", String),
        schema="sys",
    )
    sys_columns = alias(
        Table(
            "columns",
            sqlalchemy_metadata,
            Column("object_id", Integer, primary_key=True),
            Column("name", String, primary_key=True),
            Column("column_id", Integer, primary_key=True),
            schema="sys",
        )
    )
    if owner:
        whereclause = sql.and_(
            columns.c.table_name == tablename,
            columns.c.table_schema == owner,
        )
        full_name = columns.c.table_schema + "." + columns.c.table_name
    else:
        whereclause = columns.c.table_name == tablename
        full_name = columns.c.table_name

    # adding the condition for fetching column comments
    whereclause.and_(extended_properties.c.name == "MS_Description")

    join = (
        columns.join(
            computed_cols,
            onclause=sql.and_(
                computed_cols.c.object_id == func.object_id(full_name),
                computed_cols.c.name
                == columns.c.column_name.collate("DATABASE_DEFAULT"),
            ),
            isouter=True,
        )
        .join(
            identity_cols,
            onclause=sql.and_(
                identity_cols.c.object_id == func.object_id(full_name),
                identity_cols.c.name
                == columns.c.column_name.collate("DATABASE_DEFAULT"),
            ),
            isouter=True,
        )
        .join(
            sys_columns,
            onclause=sql.and_(
                sys_columns.c.object_id == func.object_id(full_name),
                sys_columns.c.name == columns.c.column_name.collate("DATABASE_DEFAULT"),
            ),
            isouter=True,
        )
        .join(
            extended_properties,
            onclause=sql.and_(
                extended_properties.c.major_id == sys_columns.c.object_id,
                extended_properties.c.minor_id == sys_columns.c.column_id,
                extended_properties.c.class_desc == "OBJECT_OR_COLUMN",
                extended_properties.c.name == "MS_Description",
            ),
            isouter=True,
        )
    )

    if self._supports_nvarchar_max:  # pylint: disable=protected-access
        computed_definition = computed_cols.c.definition
    else:
        # tds_version 4.2 does not support NVARCHAR(MAX)
        computed_definition = sql.cast(computed_cols.c.definition, NVARCHAR(4000))

    sql_qry = (
        sql.select(
            columns,
            computed_definition,
            computed_cols.c.is_persisted,
            identity_cols.c.is_identity,
            identity_cols.c.seed_value,
            identity_cols.c.increment_value,
            sql.cast(extended_properties.c.value, NVARCHAR(4000)).label("comment"),
        )
        .where(whereclause)
        .select_from(join)
        .order_by(columns.c.ordinal_position)
    )

    cursr = connection.execution_options(future_result=True).execute(sql_qry)

    cols = []
    for row in cursr.mappings():
        name = row[columns.c.column_name]
        type_ = row[columns.c.data_type]
        nullable = row[columns.c.is_nullable] == "YES"
        charlen = row[columns.c.character_maximum_length]
        numericprec = row[columns.c.numeric_precision]
        numericscale = row[columns.c.numeric_scale]
        default = row[columns.c.column_default]
        collation = row[columns.c.collation_name]
        definition = row[computed_definition]
        is_persisted = row[computed_cols.c.is_persisted]
        is_identity = row[identity_cols.c.is_identity]
        identity_start = row[identity_cols.c.seed_value]
        identity_increment = row[identity_cols.c.increment_value]
        comment = row["comment"]

        coltype = self.ischema_names.get(type_, None)

        kwargs = {}
        if coltype in (
            MSString,
            MSChar,
            MSNVarchar,
            MSNChar,
            MSText,
            MSNText,
            MSBinary,
            MSVarBinary,
            sqltypes.LargeBinary,
        ):
            if charlen == -1:
                charlen = None
            kwargs["length"] = charlen
            if collation:
                kwargs["collation"] = collation

        precision = None
        scale = None
        if coltype is None:
            util.warn(f"Did not recognize type '{type_}' of column '{name}'")
            coltype = sqltypes.NULLTYPE
        else:
            if issubclass(coltype, sqltypes.Numeric):
                kwargs["precision"] = numericprec
                precision = numericprec

                if not issubclass(coltype, sqltypes.Float):
                    kwargs["scale"] = numericscale
                    scale = numericscale

            coltype = coltype(**kwargs)
        raw_data_type = get_display_datatype(
            type_, char_len=charlen, precision=precision, scale=scale
        )
        cdict = {
            "name": name,
            "type": coltype,
            "system_data_type": raw_data_type,
            "nullable": nullable,
            "default": default,
            "autoincrement": is_identity is not None,
            "comment": comment,
        }

        if definition is not None and is_persisted is not None:
            cdict["computed"] = {
                "sqltext": definition,
                "persisted": is_persisted,
            }

        if is_identity is not None:
            # identity_start and identity_increment are Decimal or None
            if identity_start is None or identity_increment is None:
                cdict["identity"] = {}
            else:
                if isinstance(coltype, sqltypes.BigInteger):
                    start = compat.long_type(identity_start)
                    increment = compat.long_type(identity_increment)
                elif isinstance(coltype, sqltypes.Integer):
                    start = int(identity_start)
                    increment = int(identity_increment)
                else:
                    start = identity_start
                    increment = identity_increment

                cdict["identity"] = {
                    "start": start,
                    "increment": increment,
                }

        cols.append(cdict)
    return cols


@reflection.cache
@db_plus_owner
def get_view_definition(
    self, connection, viewname, dbname, owner, schema, **kw
):  # pylint: disable=unused-argument
    return get_view_definition_wrapper(
        self,
        connection,
        table_name=viewname,
        schema=owner,
        query=MSSQL_ALL_VIEW_DEFINITIONS,
    )


@reflection.cache
@db_plus_owner
def get_pk_constraint(
    self, connection, tablename, dbname, owner=None, schema=None, **kw
):  # pylint: disable=unused-argument
    """
    This function overrides to get pk constraint
    """
    pkeys = []
    tc_ = ischema.constraints
    c_key_constaint = ischema.key_constraints.alias("C")

    # Primary key constraints
    query_ = (
        sql.select(
            c_key_constaint.c.column_name,
            tc_.c.constraint_type,
            c_key_constaint.c.constraint_name,
        )
        .where(
            sql.and_(
                tc_.c.constraint_name == c_key_constaint.c.constraint_name,
                tc_.c.table_schema == c_key_constaint.c.table_schema,
                c_key_constaint.c.table_name == tablename,
                c_key_constaint.c.table_schema == owner,
            ),
        )
        .order_by(tc_.c.constraint_name, c_key_constaint.c.ordinal_position)
    )
    cursor = connection.execution_options(future_result=True).execute(query_)
    constraint_name = None
    for row in cursor.mappings():
        if "PRIMARY" in row[tc_.c.constraint_type.name]:
            pkeys.append(row["COLUMN_NAME"])
            if constraint_name is None:
                constraint_name = row[c_key_constaint.c.constraint_name.name]
    return {"constrained_columns": pkeys, "name": constraint_name}


@reflection.cache
def get_unique_constraints(self, connection, table_name, schema=None, **kw):
    raise NotImplementedError()


@reflection.cache
@db_plus_owner
def get_foreign_keys(
    self, connection, tablename, dbname, owner=None, schema=None, **kw
):  # pylint: disable=unused-argument, too-many-locals
    """
    This function overrides to get foreign key constraint
    """
    query_ = (
        text(MSSQL_GET_FOREIGN_KEY)
        .bindparams(
            sql.bindparam("tablename", tablename, ischema.CoerceUnicode()),
            sql.bindparam("owner", owner, ischema.CoerceUnicode()),
        )
        .columns(
            constraint_schema=sqltypes.Unicode(),
            constraint_name=sqltypes.Unicode(),
            table_schema=sqltypes.Unicode(),
            table_name=sqltypes.Unicode(),
            constrained_column=sqltypes.Unicode(),
            referred_table_schema=sqltypes.Unicode(),
            referred_table_name=sqltypes.Unicode(),
            referred_column=sqltypes.Unicode(),
        )
    )

    # group rows by constraint ID, to handle multi-column FKs
    fkeys = []

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

    for row_ in connection.execute(query_).fetchall():
        (
            _,  # constraint schema
            rfknm,
            _,  # ordinal position
            scol,
            rschema,
            rtbl,
            rcol,
            # TODO: we support match=<keyword> for foreign keys so
            # we can support this also, PG has match=FULL for example
            # but this seems to not be a valid value for SQL Server
            _,  # match rule
            fkuprule,
            fkdelrule,
        ) = row_

        rec = fkeys[rfknm]
        rec["name"] = rfknm

        if fkuprule != "NO ACTION":
            rec["options"]["onupdate"] = fkuprule

        if fkdelrule != "NO ACTION":
            rec["options"]["ondelete"] = fkdelrule

        if not rec["referred_table"]:
            rec["referred_table"] = rtbl
            if schema is not None or owner != rschema:
                if dbname:
                    rschema = dbname + "." + rschema
                rec["referred_schema"] = rschema

        local_cols, remote_cols = (
            rec["constrained_columns"],
            rec["referred_columns"],
        )

        local_cols.append(scol)
        remote_cols.append(rcol)

    return list(fkeys.values())


@reflection.cache
@db_plus_owner_listing
def get_table_names(
    self, connection, dbname, owner, schema, **kw
):  # pylint: disable=unused-argument
    tables = ischema.tables
    query_ = (
        sql.select(tables.c.table_name)
        .where(
            sql.and_(
                tables.c.table_schema == owner,
                tables.c.table_type == "BASE TABLE",
            )
        )
        .order_by(tables.c.table_name)
    )
    table_names = [r[0] for r in connection.execute(query_)]
    return table_names


@reflection.cache
@db_plus_owner_listing
def get_view_names(
    self, connection, dbname, owner, schema, **kw
):  # pylint: disable=unused-argument
    tables = ischema.tables
    query_ = (
        sql.select(tables.c.table_name)
        .where(
            sql.and_(
                tables.c.table_schema == owner,
                tables.c.table_type == "VIEW",
            )
        )
        .order_by(tables.c.table_name)
    )
    view_names = [r[0] for r in connection.execute(query_)]
    return view_names


def get_sqlalchemy_engine_dateformat(engine: Engine) -> Optional[str]:
    """
    returns sqlaclhemdy engine date format by running config query
    """
    result = engine.execute(GET_DB_CONFIGS)
    for row in result:
        row_dict = dict(row)
        if row_dict.get("Set Option") == "dateformat":
            return row_dict.get("Value")
    return
