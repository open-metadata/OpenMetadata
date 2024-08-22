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
Vertica source implementation.
"""
import re
import traceback
from textwrap import dedent
from typing import Iterable, Optional

from sqlalchemy import sql, util
from sqlalchemy.engine import reflection
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
    VERTICA_GET_PRIMARY_KEYS,
    VERTICA_LIST_DATABASES,
    VERTICA_SCHEMA_COMMENTS,
    VERTICA_TABLE_COMMENTS,
    VERTICA_VIEW_DEFINITION,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_schema_descriptions,
    get_table_comment_wrapper,
)

logger = ingestion_logger()

ischema_names.update(
    {
        "UUID": create_sqlalchemy_type("UUID"),
        "GEOGRAPHY": create_sqlalchemy_type("GEOGRAPHY"),
    }
)


@reflection.cache
def get_columns(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=too-many-locals,unused-argument
    """
    Method to handle column details
    """
    if schema is not None:
        schema_condition = f"lower(table_schema) = '{schema.lower()}'"
    else:
        schema_condition = "1"

    sql_query = sql.text(
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


def _get_column_info(  # pylint: disable=too-many-locals,too-many-branches,too-many-statements
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
        "system_data_type": format_type,
        "default": default,
        "autoincrement": autoincrement,
        "comment": comment,
    }
    return column_info


@reflection.cache
def get_view_definition(
    self, connection, view_name, schema=None, **kw
):  # pylint: disable=unused-argument,unused-argument
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
        dedent(
            VERTICA_VIEW_DEFINITION.format(
                view_name=view_name.lower(), schema_condition=schema_condition
            )
        )
    )
    rows = list(connection.execute(sql_query))
    if len(rows) >= 1:
        return f"CREATE VIEW {view_name} AS {rows[0][0]}"
    return None


@reflection.cache
def get_table_comment(
    self, connection, table_name, schema=None, **kw  # pylint: disable=unused-argument
):
    return get_table_comment_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=VERTICA_TABLE_COMMENTS,
    )


VerticaDialect.get_columns = get_columns
VerticaDialect._get_column_info = _get_column_info  # pylint: disable=protected-access
VerticaDialect.get_view_definition = get_view_definition
VerticaDialect.get_all_table_comments = get_all_table_comments
VerticaDialect.get_table_comment = get_table_comment


class VerticaSource(CommonDbSourceService, MultiDBSource):
    """
    Implements the necessary methods to extract
    Database metadata from Vertica Source
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.schema_desc_map = {}

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: VerticaConnection = config.serviceConnection.root.config
        if not isinstance(connection, VerticaConnection):
            raise InvalidSourceException(
                f"Expected VerticaConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_schema_description(self, schema_name: str) -> Optional[str]:
        """
        Method to fetch the schema description
        """
        return self.schema_desc_map.get(schema_name)

    def set_schema_description_map(self) -> None:
        self.schema_desc_map = get_schema_descriptions(
            self.engine, VERTICA_SCHEMA_COMMENTS
        )

    def get_configured_database(self) -> Optional[str]:
        return self.service_connection.database

    def get_database_names_raw(self) -> Iterable[str]:
        yield from self._execute_database_query(VERTICA_LIST_DATABASES)

    def get_database_names(self) -> Iterable[str]:
        configured_db = self.config.serviceConnection.root.config.database
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
                    database_fqn
                    if self.source_config.useFqnForFiltering
                    else new_database,
                ):
                    self.status.filter(database_fqn, "Database Filtered Out")
                    continue

                try:
                    self.set_inspector(database_name=new_database)
                    self.set_schema_description_map()
                    yield new_database
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error trying to connect to database {new_database}: {exc}"
                    )
