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
Vertica source implementation.
"""

import contextlib
import re
import traceback
from collections.abc import Iterable
from textwrap import dedent

from sqlalchemy import sql, text, util
from sqlalchemy.engine import Inspector, reflection
from sqlalchemy.engine.default import DefaultDialect
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.sql import sqltypes
from sqlalchemy_vertica.base import VerticaDialect, ischema_names

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.verticaConnection import (
    VerticaConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.ingestion.source.database.vertica.queries import (
    VERTICA_GET_COLUMNS,
    VERTICA_GET_COLUMNS_WITHOUT_COMMENTS,
    VERTICA_GET_CURRENT_SCHEMA,
    VERTICA_GET_PRIMARY_KEYS,
    VERTICA_GET_SERVER_VERSION,
    VERTICA_LIST_DATABASES,
    VERTICA_SCHEMA_COMMENTS,
    VERTICA_SUPPORTS_COLUMN_COMMENTS,
    VERTICA_TABLE_COMMENTS,
    VERTICA_VIEW_DEFINITION,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_table_ddls,
    get_schema_descriptions,
    get_table_comment_wrapper,
    get_table_ddl,
)

logger = ingestion_logger()

VERTICA_VERSION_PATTERN = re.compile(r".*Vertica Analytic Database v(\d+)\.(\d+)\.(\d+).*")

ischema_names.update(
    {
        "UUID": create_sqlalchemy_type("UUID"),
        "GEOGRAPHY": create_sqlalchemy_type("GEOGRAPHY"),
        "GEOMETRY": create_sqlalchemy_type("GEOMETRY"),
        # Binary types
        "BINARY": sqltypes.LargeBinary,
        "VARBINARY": sqltypes.LargeBinary,
        "LONG VARBINARY": sqltypes.LargeBinary,
        # Long string
        "LONG VARCHAR": sqltypes.Text,
        # Complex / semi-structured types (Vertica v11+)
        "ARRAY": create_sqlalchemy_type("ARRAY"),
        "NATIVE ARRAY": create_sqlalchemy_type("ARRAY"),
        "ROW": create_sqlalchemy_type("ROW"),
        "SET": create_sqlalchemy_type("SET"),
    }
)


def _rollback_quietly(connection) -> None:
    """A failed statement leaves the transaction unusable for whatever follows,
    and the caller goes straight on to read columns.
    """
    with contextlib.suppress(Exception):
        connection.rollback()


def supports_column_comments(self, connection) -> bool:
    """Whether this server exposes v_catalog.comments.child_object.

    Vertica 10 added it. Without it the column query cannot be expressed, and
    the failure takes out the whole column read rather than just the comments,
    so tables end up with no columns and no schema definition.

    A definite answer is remembered on the dialect, since it cannot change while
    connected and re-asking would log once per table. An inconclusive one is not,
    so a passing timeout cannot quietly cost every later table its comments.
    """
    remembered = getattr(self, "_column_comment_support", None)
    if remembered is not None:
        return remembered

    try:
        connection.execute(sql.text(VERTICA_SUPPORTS_COLUMN_COMMENTS))
    except ProgrammingError as exc:
        # The server rejected the statement itself, so it will keep rejecting it.
        # Remember that and stop asking.
        logger.warning(
            "This Vertica server does not expose v_catalog.comments.child_object, "
            "so column comments cannot be read. Columns and schema definitions are "
            "still ingested, without comments. Vertica 10 and later expose it: %s",
            exc,
        )
        _rollback_quietly(connection)
        self._column_comment_support = False  # pylint: disable=protected-access
        return False
    except Exception as exc:
        # Anything else, a timeout or a dropped connection, says nothing about
        # what this server supports. Read columns without comments this once so
        # the table still arrives, and leave the question open for the next call
        # rather than stripping comments for the rest of the session.
        logger.warning("Could not determine Vertica column comment support, reading columns without them: %s", exc)
        _rollback_quietly(connection)
        return False

    self._column_comment_support = True  # pylint: disable=protected-access
    return True


@reflection.cache
def get_columns(self, connection, table_name, schema=None, **kw):  # pylint: disable=too-many-locals,unused-argument
    """
    Method to handle column details
    """
    if schema is not None:
        schema_condition = f"lower(table_schema) = '{schema.lower()}'"
    else:
        schema_condition = "1"

    columns_query = (
        VERTICA_GET_COLUMNS if supports_column_comments(self, connection) else VERTICA_GET_COLUMNS_WITHOUT_COMMENTS
    )
    sql_query = sql.text(dedent(columns_query.format(table=table_name.lower(), schema_condition=schema_condition)))

    spk = sql.text(dedent(VERTICA_GET_PRIMARY_KEYS.format(table=table_name.lower(), schema_condition=schema_condition)))

    pk_columns = [x[0] for x in connection.execute(spk)]
    columns = {}
    for row in connection.execute(sql_query):
        name = row.column_name
        dtype = row.data_type.lower()
        primary_key = name in pk_columns
        default = row.column_default
        nullable = row.is_nullable
        comment = row.comment

        column_info = self._get_column_info(  # pylint: disable=protected-access
            name,
            dtype,
            default,
            nullable,
            schema,
            comment,
        )
        column_info.update({"primary_key": primary_key})
        if columns.get(name) is None or comment:
            columns[name] = column_info
    return columns.values()


def _get_column_info(  # pylint: disable=too-many-locals,too-many-branches,too-many-statements  # noqa: C901
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
    elif attype == "integer" or attype.startswith("geography"):
        args = ()
    elif attype in ("timestamptz", "timetz"):
        kwargs["timezone"] = True
        args = ()
    elif attype in (
        "timestamp",
        "time",
    ):
        kwargs["timezone"] = False
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
    if attype.upper() in self.ischema_names:
        coltype = self.ischema_names[attype.upper()]
    else:
        coltype = None

    if coltype:
        coltype = coltype(*args, **kwargs) if callable(coltype) else coltype
    else:
        util.warn(f"Did not recognize type '{attype}' of column '{name}'")
        coltype = sqltypes.NULLTYPE
    # adjust the default value
    autoincrement = False
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
                default = match.group(1) + (f'"{sch}"') + "." + match.group(2) + match.group(3)

    column_info = {
        "name": name,
        "type": coltype,
        "nullable": nullable,
        "system_data_type": format_type,
        "default": default,
        "autoincrement": autoincrement,
        "comment": comment,
    }
    return column_info  # noqa: RET504


@reflection.cache
def get_view_definition(self, connection, view_name, schema=None, **kw):  # pylint: disable=unused-argument,unused-argument
    """
    If we create a view as:
        CREATE VIEW vendor_dimension_v AS
        SELECT vendor_key, vendor_name
        FROM public.vendor_dimension_new;
    Then the VIEW_DEFINITION statement from V_CATALOG.VIEWS
    will only contain the SELECT query:
        SELECT vendor_key, vendor_name
        FROM public.vendor_dimension_new;
    We will add the `CREATE VIEW XYZ AS` piece
    to ensure that the column lineage and target table
    can be properly inferred.
    """
    if schema is not None:
        schema_condition = f"lower(table_schema) = '{schema.lower()}'"
    else:
        schema_condition = "1"

    sql_query = sql.text(
        dedent(VERTICA_VIEW_DEFINITION.format(view_name=view_name.lower(), schema_condition=schema_condition))
    )
    rows = list(connection.execute(sql_query))
    if len(rows) >= 1:
        return f"CREATE VIEW {view_name} AS {rows[0][0]}"
    return None


@reflection.cache
def get_table_comment(
    self,
    connection,
    table_name,
    schema=None,
    **kw,  # pylint: disable=unused-argument
):
    return get_table_comment_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=VERTICA_TABLE_COMMENTS,
    )


def _get_server_version_info(self, connection):  # pylint: disable=unused-argument
    """Read the server version while the dialect initializes.

    sqlalchemy-vertica passes this statement to Connection.scalar() as a bare
    string, which SQLAlchemy 2.x refuses to execute, so the first
    engine.connect() raises instead of returning a connection and the
    CheckAccess step of Test Connection fails.
    """
    version = connection.scalar(text(VERTICA_GET_SERVER_VERSION))
    match = VERTICA_VERSION_PATTERN.match(version or "")
    if not match:
        raise AssertionError(f"Could not determine version from string '{version}'")
    return tuple(int(group) for group in match.group(1, 2, 3) if group is not None)


def _get_default_schema_name(self, connection):  # pylint: disable=unused-argument
    """Read the default schema while the dialect initializes.

    initialize() calls this straight after the server version and the upstream
    dialect has the same bare-string defect here, so correcting only the version
    moves the failure rather than clearing it.
    """
    return connection.scalar(text(VERTICA_GET_CURRENT_SCHEMA))


VerticaDialect.get_columns = get_columns
VerticaDialect._get_column_info = _get_column_info  # pylint: disable=protected-access
VerticaDialect.get_view_definition = get_view_definition  # pyright: ignore[reportAttributeAccessIssue]
VerticaDialect.get_all_table_comments = get_all_table_comments
VerticaDialect.get_table_comment = get_table_comment  # pyright: ignore[reportAttributeAccessIssue]
VerticaDialect._get_server_version_info = _get_server_version_info  # pylint: disable=protected-access
VerticaDialect._get_default_schema_name = _get_default_schema_name  # pylint: disable=protected-access

# get_schema_definition only reaches for table DDL when the inspector carries
# these, and they are registered globally rather than per dialect. Vertica does
# import a connector that installs them, but only as a side effect of sharing
# Postgres helpers, so declare them here rather than depend on that chain.
Inspector.get_all_table_ddls = get_all_table_ddls  # pyright: ignore[reportAttributeAccessIssue]
Inspector.get_table_ddl = get_table_ddl  # pyright: ignore[reportAttributeAccessIssue]

# sqlalchemy-vertica predates SQLAlchemy 2.0 and overrides only the singular
# get_* reflection methods. The batched get_multi_* API that MetaData.reflect()
# now calls is therefore inherited from PGDialect, which reads pg_catalog, a
# schema Vertica does not have. Reflection fails with MissingSchema, and because
# get_all_table_ddls swallows that at debug level, tables silently end up with no
# schema definition while views, reflected one at a time, are unaffected.
#
# DefaultDialect's versions are generic loops over the singular methods, so this
# routes the batched API back onto the Vertica implementations above.
for _batched_reflection_method in (
    "get_multi_columns",
    "get_multi_pk_constraint",
    "get_multi_foreign_keys",
    "get_multi_indexes",
    "get_multi_table_comment",
    "get_multi_unique_constraints",
    "get_multi_check_constraints",
):
    setattr(
        VerticaDialect,
        _batched_reflection_method,
        getattr(DefaultDialect, _batched_reflection_method),
    )


class VerticaSource(CommonDbSourceService, MultiDBSource):
    """
    Implements the necessary methods to extract
    Database metadata from Vertica Source
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.schema_desc_map = {}

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: VerticaConnection = config.serviceConnection.root.config
        if not isinstance(connection, VerticaConnection):
            raise InvalidSourceException(f"Expected VerticaConnection, but got {connection}")
        return cls(config, metadata)

    def get_schema_description(self, schema_name: str) -> str | None:
        """
        Method to fetch the schema description
        """
        return self.schema_desc_map.get(schema_name)

    def set_schema_description_map(self) -> None:
        self.schema_desc_map = get_schema_descriptions(self.engine, VERTICA_SCHEMA_COMMENTS)

    def get_configured_database(self) -> str | None:
        return self.service_connection.database

    def get_database_names_raw(self) -> Iterable[str]:
        yield from self._execute_database_query(VERTICA_LIST_DATABASES)

    def get_database_names(self) -> Iterable[str]:
        configured_db = self.config.serviceConnection.root.config.database  # pyright: ignore[reportAttributeAccessIssue]
        if configured_db:
            self.set_inspector(database_name=configured_db)
            self.set_schema_description_map()
            yield configured_db
        else:
            for new_database in self.get_database_names_raw():
                database_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.get().database_service,
                    database_name=new_database,
                )

                if filter_by_database(
                    self.source_config.databaseFilterPattern,
                    database_fqn if self.source_config.useFqnForFiltering else new_database,
                ):
                    self.status.filter(database_fqn, "Database Filtered Out")
                    continue

                try:
                    self.set_inspector(database_name=new_database)
                    self.set_schema_description_map()
                    yield new_database
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(f"Error trying to connect to database {new_database}: {exc}")
