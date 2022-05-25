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
from textwrap import dedent

from sqlalchemy import sql, util
from sqlalchemy.engine import reflection
from sqlalchemy.sql import sqltypes
from sqlalchemy.sql.sqltypes import String
from sqlalchemy_vertica.base import VerticaDialect

from metadata.generated.schema.entity.services.connections.database.verticaConnection import (
    VerticaConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils.sql_queries import (
    VERTICA_GET_COLUMNS,
    VERTICA_GET_PRIMARY_KEYS,
    VERTICA_VIEW_DEFINITION,
)


class UUID(String):

    """The SQL UUID type."""

    __visit_name__ = "UUID"


@reflection.cache
def get_columns(self, connection, table_name, schema=None, **kw):
    if schema is not None:
        schema_condition = "lower(table_schema) = '%(schema)s'" % {
            "schema": schema.lower()
        }
    else:
        schema_condition = "1"

    s = sql.text(
        dedent(
            VERTICA_GET_COLUMNS.format(
                table=table_name.lower(), schema_condition=schema_condition
            )
        )
    )

    spk = sql.text(
        dedent(
            VERTICA_GET_PRIMARY_KEYS.format(
                table=table_name.lower(), schema_condition=schema_condition
            )
        )
    )

    pk_columns = [x[0] for x in connection.execute(spk)]
    columns = []
    for row in connection.execute(s):
        name = row.column_name
        dtype = row.data_type.lower()
        primary_key = name in pk_columns
        default = row.column_default
        nullable = row.is_nullable
        comment = row.comment

        column_info = self._get_column_info(
            name,
            dtype,
            default,
            nullable,
            schema,
            comment,
        )
        column_info.update({"primary_key": primary_key})
        columns.append(column_info)
    return columns


def _get_column_info(
    self,
    name,
    format_type,
    default,
    nullable,
    schema,
    comment,
):

    # strip (*) from character varying(5), timestamp(5)
    # with time zone, geometry(POLYGON), etc.
    attype = re.sub(r"\(.*\)", "", format_type)

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
    elif attype == "integer":
        args = ()
    elif attype in ("timestamptz", "timetz"):
        kwargs["timezone"] = True
        if charlen:
            kwargs["precision"] = int(charlen)
        args = ()
    elif attype in (
        "timestamp",
        "time",
    ):
        kwargs["timezone"] = False
        if charlen:
            kwargs["precision"] = int(charlen)
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
    self.ischema_names["UUID"] = UUID
    if attype.upper() in self.ischema_names:
        coltype = self.ischema_names[attype.upper()]
    else:
        coltype = None

    if coltype:
        coltype = coltype(*args, **kwargs)
    else:
        util.warn("Did not recognize type '%s' of column '%s'" % (attype, name))
        coltype = sqltypes.NULLTYPE
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
        autoincrement=autoincrement,
        comment=comment,
    )
    return column_info


@reflection.cache
def get_view_definition(self, connection, view_name, schema=None, **kw):
    if schema is not None:
        schema_condition = "lower(table_schema) = '%(schema)s'" % {
            "schema": schema.lower()
        }
    else:
        schema_condition = "1"

    s = sql.text(
        dedent(
            VERTICA_VIEW_DEFINITION.format(
                view_name=view_name.lower(), schema_condition=schema_condition
            )
        )
    )
    rows = [row for row in connection.execute(s)]
    if len(rows) >= 1:
        return rows[0][0]
    return None


VerticaDialect.get_columns = get_columns  # pylint: disable=protected-access
VerticaDialect._get_column_info = _get_column_info  # pylint: disable=protected-access
VerticaDialect.get_view_definition = (
    get_view_definition  # pylint: disable=protected-access
)


class VerticaSource(CommonDbSourceService):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: VerticaConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, VerticaConnection):
            raise InvalidSourceException(
                f"Expected VerticaConnection, but got {connection}"
            )

        return cls(config, metadata_config)
