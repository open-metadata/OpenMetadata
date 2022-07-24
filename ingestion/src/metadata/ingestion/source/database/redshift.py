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
Redshift source ingestion
"""

import re
from collections import defaultdict
from typing import Iterable, Optional, Tuple

import sqlalchemy as sa
from packaging.version import Version
from sqlalchemy import inspect, util
from sqlalchemy.dialects.postgresql.base import ENUM, PGDialect
from sqlalchemy.dialects.postgresql.base import ischema_names as pg_ischema_names
from sqlalchemy.engine import reflection
from sqlalchemy.sql import sqltypes
from sqlalchemy.types import CHAR, VARCHAR, NullType
from sqlalchemy_redshift.dialect import RedshiftDialectMixin, RelationKey

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils.filters import filter_by_database, filter_by_table
from metadata.utils.logger import ingestion_logger
from metadata.utils.sql_queries import (
    REDSHIFT_GET_ALL_RELATION_INFO,
    REDSHIFT_GET_SCHEMA_COLUMN_INFO,
)

sa_version = Version(sa.__version__)

logger = ingestion_logger()

ischema_names = pg_ischema_names
ischema_names.update({"binary varying": sqltypes.VARBINARY})


@reflection.cache
def get_table_names(self, connection, schema=None, **kw):
    """
    Get table names

    Args:
        connection ():
        schema ():
        **kw:
    Returns:
    """
    return self._get_table_or_view_names(
        ["r", "e"], connection, schema, **kw
    )  # pylint: disable=protected-access


@reflection.cache
def get_view_names(self, connection, schema=None, **kw):
    """
    Get view name

    Args:
        connection ():
        schema ():
        **kw:
    Returns:
    """
    return self._get_table_or_view_names(
        ["v"], connection, schema, **kw
    )  # pylint: disable=protected-access


@reflection.cache
def _get_table_or_view_names(self, relkinds, connection, schema=None, **kw):
    """
    Get table or view name

    Args:
        relkinds:
        connection:
        schema:
        **kw:
    Returns
    """
    default_schema = inspect(connection).default_schema_name
    if not schema:
        schema = default_schema
    info_cache = kw.get("info_cache")
    all_relations = self._get_all_relation_info(
        connection, info_cache=info_cache
    )  # pylint: disable=protected-access
    relation_names = []
    for key, relation in all_relations.items():
        if key.schema == schema and relation.relkind in relkinds:
            relation_names.append(
                (
                    key.name,
                    relation.relkind,
                )
            )
    return relation_names


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
    column_info = super(RedshiftDialectMixin, self)._get_column_info(
        *args, **kwdrs
    )  # pylint: disable=protected-access
    column_info["raw_data_type"] = kwdrs["format_type"]

    if isinstance(column_info["type"], VARCHAR):
        if column_info["type"].length is None:
            column_info["type"] = NullType()
    if re.match("char", column_info["raw_data_type"]):
        column_info["type"] = CHAR

    if "info" not in column_info:
        column_info["info"] = {}
    if encode and encode != "none":
        column_info["info"]["encode"] = encode
    return column_info


# pylint: disable=unused-argument
@reflection.cache
def _get_all_relation_info(self, connection, **kw):
    """
    Get all relation info

    Args:
        connection:
        **kw:
    Returns
    """
    result = connection.execute(REDSHIFT_GET_ALL_RELATION_INFO)
    relations = {}
    for rel in result:
        key = RelationKey(rel.relname, rel.schema, connection)
        relations[key] = rel

    result = connection.execute(
        """
            SELECT
                schemaname as "schema",
                tablename as "relname",
                'e' as relkind
            FROM svv_external_tables;
            """
    )
    for rel in result:
        key = RelationKey(rel.relname, rel.schema, connection)
        relations[key] = rel
    return relations


@reflection.cache
def _get_schema_column_info(self, connection, schema=None, **kw):
    """
    Get schema column info

    Args:
        connection:
        schema:
        **kw:
    Returns:
    """
    schema_clause = f"AND schema = '{schema if schema else ''}'"
    all_columns = defaultdict(list)
    with connection.connect() as cnct:
        result = cnct.execute(
            REDSHIFT_GET_SCHEMA_COLUMN_INFO.format(schema_clause=schema_clause)
        )
        for col in result:
            key = RelationKey(col.table_name, col.schema, connection)
            all_columns[key].append(col)
    return dict(all_columns)


RedshiftDialectMixin._get_table_or_view_names = (
    _get_table_or_view_names  # pylint: disable=protected-access
)
RedshiftDialectMixin.get_view_names = get_view_names  # pylint: disable=protected-access
RedshiftDialectMixin.get_table_names = (
    get_table_names  # pylint: disable=protected-access
)
RedshiftDialectMixin._get_column_info = (
    _get_column_info  # pylint: disable=protected-access
)
RedshiftDialectMixin._get_all_relation_info = (
    _get_all_relation_info  # pylint: disable=protected-access
)
RedshiftDialectMixin._get_schema_column_info = (
    _get_schema_column_info  # pylint: disable=protected-access
)


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


def _update_column_info(
    default, schema, coltype, autoincrement, name, nullable, identity, comment, computed
):
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
        autoincrement=autoincrement or identity is not None,
        comment=comment,
    )
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
        util.warn("Did not recognize type '%s' of column '%s'" % (attype, name))
        coltype = sqltypes.NULLTYPE
    return coltype


def _update_computed_and_default(generated, default):
    computed = None
    if generated not in (None, "", b"\x00"):
        computed = dict(sqltext=default, persisted=generated in ("s", b"s"))
        default = None
    return computed, default


def _get_charlen(format_type):
    charlen = re.search(r"\(([\d,]+)\)", format_type)
    if charlen:
        charlen = charlen.group(1)
    return charlen


@reflection.cache
def _get_column_info(
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


PGDialect._get_column_info = _get_column_info

STANDARD_TABLE_TYPES = {
    "r": TableType.Local,
    "e": TableType.External,
    "v": TableType.View,
}

# pylint: disable=useless-super-delegation
class RedshiftSource(CommonDbSourceService):
    """
    Redshift source cloass

    Args:
        confi:
        metadata_config:
    """

    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        """
        Create source

        Args:
            config_dict:
            metadata_config:
        Returns:
        """
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: RedshiftConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, RedshiftConnection):
            raise InvalidSourceException(
                f"Expected RedshiftConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Handle table and views.

        Fetches them up using the context information and
        the inspector set when preparing the db.

        :return: tables or views, depending on config
        """
        schema_name = self.context.database_schema.name.__root__
        if self.source_config.includeTables:
            # table_type value for regular tables will be 'r' and for external tables will be 'e'
            for table_name, table_type in self.inspector.get_table_names(schema_name):
                if filter_by_table(
                    self.source_config.tableFilterPattern, table_name=table_name
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{table_name}",
                        "Table pattern not allowed",
                    )
                    continue
                yield table_name, STANDARD_TABLE_TYPES.get(table_type)
        if self.source_config.includeViews:
            # table_type value for views will be 'v'
            for view_name, table_type in self.inspector.get_view_names(schema_name):
                if filter_by_table(
                    self.source_config.tableFilterPattern, table_name=view_name
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{view_name}",
                        "Table pattern not allowed for view",
                    )
                    continue
                yield view_name, STANDARD_TABLE_TYPES.get(table_type)

    def get_database_names(self) -> Iterable[str]:
        if not self.config.serviceConnection.__root__.config.ingestAllDatabases:
            self.inspector = inspect(self.engine)
            yield self.config.serviceConnection.__root__.config.database
        else:
            results = self.connection.execute("SELECT datname FROM pg_database")
            for res in results:
                row = list(res)
                new_database = row[0]

                if filter_by_database(
                    self.source_config.databaseFilterPattern, database_name=new_database
                ):
                    self.status.filter(new_database, "Database pattern not allowed")
                    continue

                try:
                    self.set_inspector(database_name=new_database)
                    yield new_database
                except Exception as err:
                    logger.error(
                        f"Error trying to connect to database {new_database} - {err}"
                    )
