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

import re

from sqlalchemy import sql, util
from sqlalchemy.dialects.postgresql.base import ENUM
from sqlalchemy.engine import reflection
from sqlalchemy.sql import sqltypes

from metadata.ingestion.source.database.postgres.queries import (
    POSTGRES_COL_IDENTITY,
    POSTGRES_SQL_COLUMNS,
    POSTGRES_TABLE_COMMENTS,
    POSTGRES_VIEW_DEFINITIONS,
)
from metadata.utils.sqlalchemy_utils import (
    get_table_comment_wrapper,
    get_view_definition_wrapper,
)


@reflection.cache
def get_table_comment(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    return get_table_comment_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=POSTGRES_TABLE_COMMENTS,
    )


@reflection.cache
def get_view_definition(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    return get_view_definition_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=POSTGRES_VIEW_DEFINITIONS,
    )


def get_column_info(
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
    """
    Overriding the dialect method to add raw_data_type & profile_key in response
    """

    def _handle_array_type(attype):
        return (
            # strip '[]' from integer[], etc.
            re.sub(r"\[\]$", "", attype),
            attype.endswith("[]"),
        )

    if format_type is None:
        no_format_type = True
        attype = format_type = "no format_type()"
        is_array = False
    else:
        no_format_type = False

        # strip (*) from character varying(5), timestamp(5)
        # with time zone, geometry(POLYGON), etc.
        attype = re.sub(r"\(.*\)", "", format_type)

        # strip '[]' from integer[], etc. and check if an array
        attype, is_array = _handle_array_type(attype)

    # strip quotes from case sensitive enum or domain names
    enum_or_domain_key = tuple(util.quoted_token_parser(attype))

    nullable = not notnull

    charlen = re.search(r"\(([\d,]+)\)", format_type)
    if charlen:
        charlen = charlen.group(1)
    args = re.search(r"\((.*)\)", format_type)
    if args and args.group(1):
        args = tuple(re.split(r"\s*,\s*", args.group(1)))
    else:
        args = ()
    kwargs = {}

    if attype == "numeric":
        if charlen:
            prec, scale = charlen.split(",")
            args = (int(prec), int(scale))
        else:
            args = ()
    elif attype == "double precision":
        args = (53,)
    elif attype == "integer":
        args = ()
    elif attype in ("timestamp with time zone", "time with time zone"):
        kwargs["timezone"] = True
        if charlen:
            kwargs["precision"] = int(charlen)
        args = ()
    elif attype in (
        "timestamp without time zone",
        "time without time zone",
        "time",
    ):
        kwargs["timezone"] = False
        if charlen:
            kwargs["precision"] = int(charlen)
        args = ()
    elif attype == "bit varying":
        kwargs["varying"] = True
        if charlen:
            args = (int(charlen),)
        else:
            args = ()
    elif attype.startswith("interval"):
        field_match = re.match(r"interval (.+)", attype, re.I)
        if charlen:
            kwargs["precision"] = int(charlen)
        if field_match:
            kwargs["fields"] = field_match.group(1)
        attype = "interval"
        args = ()
    elif charlen:
        args = (int(charlen),)

    profile_key = None
    while True:
        # looping here to suit nested domains
        if attype in self.ischema_names:
            coltype = self.ischema_names[attype]
            profile_key = attype
            break
        elif enum_or_domain_key in enums:
            enum = enums[enum_or_domain_key]
            coltype = ENUM
            kwargs["name"] = enum["name"]
            if not enum["visible"]:
                kwargs["schema"] = enum["schema"]
            args = tuple(enum["labels"])
            break
        elif enum_or_domain_key in domains:
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
            continue
        else:
            coltype = None
            break

    if coltype:
        coltype = coltype(*args, **kwargs)
        if is_array:
            coltype = self.ischema_names["_array"](coltype)
            profile_key = "_array"
    elif no_format_type:
        util.warn("PostgreSQL format_type() returned NULL for column '%s'" % (name,))
        coltype = sqltypes.NULLTYPE
    else:
        util.warn("Did not recognize type '%s' of column '%s'" % (attype, name))
        coltype = sqltypes.NULLTYPE

    # If a zero byte or blank string depending on driver (is also absent
    # for older PG versions), then not a generated column. Otherwise, s =
    # stored. (Other values might be added in the future.)
    if generated not in (None, "", b"\x00"):
        computed = dict(sqltext=default, persisted=generated in ("s", b"s"))
        default = None
    else:
        computed = None

    # adjust the default value
    autoincrement = False
    if default is not None:
        match = re.search(r"""(nextval\(')([^']+)('.*$)""", default)
        if match is not None:
            if issubclass(coltype._type_affinity, sqltypes.Integer):
                autoincrement = True
            # the default is related to a Sequence
            sch = schema
            if "." not in match.group(2) and sch is not None:
                # unconditionally quote the schema name.  this could
                # later be enhanced to obey quoting rules /
                # "quote schema"
                default = (
                    match.group(1)
                    + ('"%s"' % sch)
                    + "."
                    + match.group(2)
                    + match.group(3)
                )

    column_info = dict(
        name=name,
        type=coltype,
        nullable=nullable,
        default=default,
        raw_data_type=format_type,
        profile_key=profile_key,
        autoincrement=autoincrement or identity is not None,
        comment=comment,
    )
    if computed is not None:
        column_info["computed"] = computed
    if identity is not None:
        column_info["identity"] = identity
    return column_info
