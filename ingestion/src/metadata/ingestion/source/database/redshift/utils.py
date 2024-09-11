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
Redshift SQLAlchemy util methods
"""
import re
from collections import defaultdict

import sqlalchemy as sa
from packaging.version import Version
from sqlalchemy import util
from sqlalchemy.dialects.postgresql.base import ENUM
from sqlalchemy.dialects.postgresql.base import ischema_names as pg_ischema_names
from sqlalchemy.engine import reflection
from sqlalchemy.sql import sqltypes
from sqlalchemy_redshift.dialect import (
    REDSHIFT_ISCHEMA_NAMES,
    RedshiftDialectMixin,
    RelationKey,
)

from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_GET_ALL_RELATIONS,
    REDSHIFT_GET_SCHEMA_COLUMN_INFO,
    REDSHIFT_TABLE_COMMENTS,
)
from metadata.utils.execution_time_tracker import calculate_execution_time
from metadata.utils.sqlalchemy_utils import get_table_comment_wrapper

sa_version = Version(sa.__version__)

ischema_names = pg_ischema_names
GEOGRAPHY = create_sqlalchemy_type("GEOGRAPHY")
ischema_names["geography"] = GEOGRAPHY
ischema_names.update({"binary varying": sqltypes.VARBINARY})
ischema_names.update(REDSHIFT_ISCHEMA_NAMES)


# pylint: disable=protected-access
@calculate_execution_time()
@reflection.cache
def get_columns(self, connection, table_name, schema=None, **kw):
    """
    Return information about columns in `table_name`.

    Overrides interface
    :meth:`~sqlalchemy.engine.interfaces.Dialect.get_columns`.

    overriding the default dialect method to include the
    distkey and sortkey info
    """
    cols = self._get_redshift_columns(connection, table_name, schema, **kw)
    if not self._domains:
        self._domains = self._load_domains(connection)
    domains = self._domains
    columns = []
    for col in cols:
        column_info = self._get_column_info(
            name=col.name,
            format_type=col.format_type,
            default=col.default,
            notnull=col.notnull,
            domains=domains,
            enums=[],
            schema=col.schema,
            encode=col.encode,
            comment=col.comment,
        )
        column_info["distkey"] = col.distkey
        column_info["sortkey"] = col.sortkey
        column_info["system_data_type"] = col.format_type
        columns.append(column_info)
    return columns


@calculate_execution_time()
def _get_column_info(self, *args, **kwargs):
    """
    Get column info

    Args:
        *args:
        **kwargs:
    Returns
    """
    kwdrs = kwargs.copy()
    encode = kwdrs.pop("encode", None)
    if sa_version >= Version("1.3.16"):
        kwdrs["generated"] = ""
    if sa_version < Version("1.4.0") and "identity" in kwdrs:
        del kwdrs["identity"]
    elif sa_version >= Version("1.4.0") and "identity" not in kwdrs:
        kwdrs["identity"] = None
    column_info = super(  # pylint: disable=protected-access
        RedshiftDialectMixin, self
    )._get_column_info(*args, **kwdrs)

    # raw_data_type is not included in column_info as
    # redhift doesn't support complex data types directly
    # https://docs.aws.amazon.com/redshift/latest/dg/c_Supported_data_types.html

    if "info" not in column_info:
        column_info["info"] = {}
    if encode and encode != "none":
        column_info["info"]["encode"] = encode
    return column_info


@calculate_execution_time()
@reflection.cache
def _get_schema_column_info(
    self, connection, schema=None, **kw
):  # pylint: disable=unused-argument
    """
    Get schema column info

    Args:
        connection:
        schema:
        **kw:
    Returns:

    This method is responsible for fetching all the column details like
    name, type, constraints, distkey and sortkey etc.
    """
    schema_clause = f"AND schema = '{schema if schema else ''}'"
    all_columns = defaultdict(list)
    result = connection.execute(
        REDSHIFT_GET_SCHEMA_COLUMN_INFO.format(schema_clause=schema_clause)
    )
    for col in result:
        key = RelationKey(col.table_name, col.schema, connection)
        all_columns[key].append(col)
    return dict(all_columns)


def _handle_array_type(attype):
    return (
        # strip '[]' from integer[], etc.
        re.sub(r"\[\]$", "", attype),
        attype.endswith("[]"),
    )


def _init_args(format_type):
    args = re.search(r"\((.*)\)", format_type)
    if args and args.group(1):
        args = tuple(re.split(r"\s*,\s*", args.group(1)))
    else:
        args = ()
    return args


def _get_kwargs_for_time_type(kwargs, charlen, attype):
    if charlen:
        kwargs["precision"] = int(charlen)
    if attype in {"timestamp with time zone", "time with time zone"}:
        kwargs["timezone"] = True
    else:
        kwargs["timezone"] = False
    return kwargs


def _get_args_and_kwargs(charlen, attype, format_type):
    kwargs = {}
    args = _init_args(format_type)
    if attype == "numeric" and charlen:
        prec, scale = charlen.split(",")
        args = (int(prec), int(scale))

    elif attype == "double precision":
        args = (53,)

    elif attype in {
        "timestamp with time zone",
        "time with time zone",
        "timestamp without time zone",
        "time without time zone",
        "time",
    }:
        kwargs = _get_kwargs_for_time_type(kwargs, charlen, attype)

    elif attype == "bit varying":
        kwargs["varying"] = True
        if charlen:
            args = (int(charlen),)

    elif attype.startswith("interval"):
        field_match = re.match(r"interval (.+)", attype, re.I)
        if charlen:
            kwargs["precision"] = int(charlen)
        if field_match:
            kwargs["fields"] = field_match.group(1)
    elif charlen:
        args = (int(charlen),)
    return args, kwargs


def _update_column_info(  # pylint: disable=too-many-arguments
    default, schema, coltype, autoincrement, name, nullable, identity, comment, computed
):
    if default is not None:
        match = re.search(r"""(nextval\(')([^']+)('.*$)""", default)
        if match is not None:
            if issubclass(
                coltype._type_affinity,  # pylint: disable=protected-access
                sqltypes.Integer,
            ):
                autoincrement = True
            # the default is related to a Sequence
            sch = schema
            if "." not in match.group(2) and sch is not None:
                # unconditionally quote the schema name.  this could
                # later be enhanced to obey quoting rules /
                # "quote schema"
                default = (
                    match.group(1)
                    + (f'"{sch}"')
                    + "."
                    + match.group(2)
                    + match.group(3)
                )
    column_info = {
        "name": name,
        "type": coltype,
        "nullable": nullable,
        "default": default,
        "autoincrement": autoincrement or identity is not None,
        "comment": comment,
    }
    if computed is not None:
        column_info["computed"] = computed
    if identity is not None:
        column_info["identity"] = identity
    return column_info


def _update_coltype(coltype, args, kwargs, attype, name, is_array):
    if coltype:
        coltype = coltype(*args, **kwargs)
        if is_array:
            coltype = ischema_names["_array"](coltype)
    else:
        util.warn(f"Did not recognize type '{attype}' of column '{name}'")
        coltype = sqltypes.NULLTYPE
    return coltype


def _update_computed_and_default(generated, default):
    computed = None
    if generated not in (None, "", b"\x00"):
        computed = {
            "sqltext": default,
            "persisted": generated in ("s", b"s"),
        }
        default = None
    return computed, default


def _get_charlen(format_type):
    charlen = re.search(r"\(([\d,]+)\)", format_type)
    if charlen:
        charlen = charlen.group(1)
    return charlen


@calculate_execution_time()
@reflection.cache
def _get_pg_column_info(  # pylint: disable=too-many-locals,too-many-arguments, unused-argument
    self,
    name,
    format_type,
    default,
    notnull,
    domains,
    enums,
    schema,
    comment,
    generated,
    identity,
):
    # strip (*) from character varying(5), timestamp(5)
    # with time zone, geometry(POLYGON), etc.
    attype = re.sub(r"\(.*\)", "", format_type)

    # strip '[]' from integer[], etc. and check if an array
    attype, is_array = _handle_array_type(attype)

    # strip quotes from case sensitive enum or domain names
    enum_or_domain_key = tuple(util.quoted_token_parser(attype))

    nullable = not notnull
    charlen = _get_charlen(format_type)
    args, kwargs = _get_args_and_kwargs(charlen, attype, format_type)
    if attype.startswith("interval"):
        attype = "interval"
    while True:
        # looping here to suit nested domains
        if attype in ischema_names:
            coltype = ischema_names[attype]
            break
        if enum_or_domain_key in enums:
            enum = enums[enum_or_domain_key]
            coltype = ENUM
            kwargs["name"] = enum["name"]
            if not enum["visible"]:
                kwargs["schema"] = enum["schema"]
            args = tuple(enum["labels"])
            break
        if enum_or_domain_key in domains:
            domain = domains[enum_or_domain_key]
            attype = domain["attype"]
            attype, is_array = _handle_array_type(attype)
            # strip quotes from case sensitive enum or domain names
            enum_or_domain_key = tuple(util.quoted_token_parser(attype))
            # A table can't override a not null on the domain,
            # but can override nullable
            nullable = nullable and domain["nullable"]
            if domain["default"] and not default:
                # It can, however, override the default
                # value, but can't set it to null.
                default = domain["default"]
        else:
            coltype = None
            break

    coltype = _update_coltype(coltype, args, kwargs, attype, name, is_array)

    # If a zero byte or blank string depending on driver (is also absent
    # for older PG versions), then not a generated column. Otherwise, s =
    # stored. (Other values might be added in the future.)
    computed, default = _update_computed_and_default(generated, default)

    # adjust the default value
    autoincrement = False
    column_info = _update_column_info(
        default,
        schema,
        coltype,
        autoincrement,
        name,
        nullable,
        identity,
        comment,
        computed,
    )

    return column_info


@calculate_execution_time()
@reflection.cache
def get_table_comment(
    self, connection, table_name, schema=None, **kw  # pylint: disable=unused-argument
):
    return get_table_comment_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=REDSHIFT_TABLE_COMMENTS,
    )


@calculate_execution_time()
@reflection.cache
def _get_all_relation_info(self, connection, **kw):  # pylint: disable=unused-argument
    # pylint: disable=consider-using-f-string
    schema = kw.get("schema", None)
    schema_clause = "AND schema = '{schema}'".format(schema=schema) if schema else ""

    table_name = kw.get("table_name", None)
    table_clause = (
        "AND relname = '{table}'".format(table=table_name) if table_name else ""
    )

    result = connection.execute(
        sa.text(
            REDSHIFT_GET_ALL_RELATIONS.format(
                schema_clause=schema_clause, table_clause=table_clause
            )
        )
    )
    relations = {}
    for rel in result:
        key = RelationKey(rel.relname, rel.schema, connection)
        relations[key] = rel
    return relations


@reflection.cache
def get_view_definition(self, connection, view_name, schema=None, **kw):
    """Return view definition.
    Given a :class:`.Connection`, a string `view_name`,
    and an optional string `schema`, return the view definition.

    Overrides interface
    :meth:`~sqlalchemy.engine.interfaces.Dialect.get_view_definition`.
    """
    view = self._get_redshift_relation(connection, view_name, schema, **kw)
    pattern = re.compile("WITH NO SCHEMA BINDING", re.IGNORECASE)
    view_definition = str(sa.text(pattern.sub("", view.view_definition)))
    if not view_definition.startswith("create"):
        view_definition = (
            f"CREATE VIEW {view.schema}.{view.relname} AS {view_definition}"
        )
    return view_definition
