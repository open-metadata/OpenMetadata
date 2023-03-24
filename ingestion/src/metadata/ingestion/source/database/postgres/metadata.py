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
Postgres source module
"""
import traceback
from collections import namedtuple
from typing import Iterable, Tuple

from sqlalchemy import sql
from sqlalchemy.dialects.postgresql.base import PGDialect, ischema_names
from sqlalchemy.engine import reflection
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.sql import sqltypes

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    IntervalType,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.postgres.queries import (
    POSTGRES_COL_IDENTITY,
    POSTGRES_GET_ALL_TABLE_PG_POLICY,
    POSTGRES_GET_DB_NAMES,
    POSTGRES_GET_TABLE_NAMES,
    POSTGRES_PARTITION_DETAILS,
    POSTGRES_SQL_COLUMNS,
    POSTGRES_TABLE_COMMENTS,
    POSTGRES_VIEW_DEFINITIONS,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_view_definitions,
    get_table_comment_wrapper,
    get_view_definition_wrapper,
)

TableKey = namedtuple("TableKey", ["schema", "table_name"])

logger = ingestion_logger()


INTERVAL_TYPE_MAP = {
    "list": IntervalType.COLUMN_VALUE.value,
    "hash": IntervalType.COLUMN_VALUE.value,
    "range": IntervalType.TIME_UNIT.value,
}

RELKIND_MAP = {
    "r": TableType.Regular,
    "p": TableType.Partitioned,
    "f": TableType.Foreign,
}

GEOMETRY = create_sqlalchemy_type("GEOMETRY")
POINT = create_sqlalchemy_type("POINT")
POLYGON = create_sqlalchemy_type("POLYGON")

ischema_names.update(
    {
        "geometry": GEOMETRY,
        "point": POINT,
        "polygon": POLYGON,
        "box": create_sqlalchemy_type("BOX"),
        "circle": create_sqlalchemy_type("CIRCLE"),
        "line": create_sqlalchemy_type("LINE"),
        "lseg": create_sqlalchemy_type("LSEG"),
        "path": create_sqlalchemy_type("PATH"),
        "pg_lsn": create_sqlalchemy_type("PG_LSN"),
        "pg_snapshot": create_sqlalchemy_type("PG_SNAPSHOT"),
        "tsquery": create_sqlalchemy_type("TSQUERY"),
        "txid_snapshot": create_sqlalchemy_type("TXID_SNAPSHOT"),
        "xml": create_sqlalchemy_type("XML"),
    }
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
def get_columns(  # pylint: disable=too-many-locals
    self, connection, table_name, schema=None, **kw
):
    """
    Overriding the dialect method to add raw_data_type in response
    """

    table_oid = self.get_table_oid(
        connection, table_name, schema, info_cache=kw.get("info_cache")
    )

    generated = (
        "a.attgenerated as generated"
        if self.server_version_info >= (12,)
        else "NULL as generated"
    )
    if self.server_version_info >= (10,):
        # a.attidentity != '' is required or it will reflect also
        # serial columns as identity.
        identity = POSTGRES_COL_IDENTITY
    else:
        identity = "NULL as identity_options"

    sql_col_query = POSTGRES_SQL_COLUMNS.format(
        generated=generated,
        identity=identity,
    )
    sql_col_query = (
        sql.text(sql_col_query)
        .bindparams(sql.bindparam("table_oid", type_=sqltypes.Integer))
        .columns(attname=sqltypes.Unicode, default=sqltypes.Unicode)
    )
    conn = connection.execute(sql_col_query, {"table_oid": table_oid})
    rows = conn.fetchall()

    # dictionary with (name, ) if default search path or (schema, name)
    # as keys
    domains = self._load_domains(connection)  # pylint: disable=protected-access

    # dictionary with (name, ) if default search path or (schema, name)
    # as keys
    enums = dict(
        ((rec["name"],), rec) if rec["visible"] else ((rec["schema"], rec["name"]), rec)
        for rec in self._load_enums(  # pylint: disable=protected-access
            connection, schema="*"
        )
    )

    # format columns
    columns = []

    for (
        name,
        format_type,
        default_,
        notnull,
        table_oid,
        comment,
        generated,
        identity,
    ) in rows:
        column_info = self._get_column_info(  # pylint: disable=protected-access
            name,
            format_type,
            default_,
            notnull,
            domains,
            enums,
            schema,
            comment,
            generated,
            identity,
        )
        column_info["system_data_type"] = format_type
        columns.append(column_info)
    return columns


PGDialect.get_all_table_comments = get_all_table_comments
PGDialect.get_table_comment = get_table_comment


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


PGDialect.get_view_definition = get_view_definition
PGDialect.get_columns = get_columns
PGDialect.get_all_view_definitions = get_all_view_definitions

PGDialect.ischema_names = ischema_names


class PostgresSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Postgres Source
    """

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: PostgresConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, PostgresConnection):
            raise InvalidSourceException(
                f"Expected PostgresConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Overwrite the inspector implementation to handle partitioned
        and foreign types
        """
        result = self.connection.execute(
            sql.text(POSTGRES_GET_TABLE_NAMES),
            {"schema": schema_name},
        )

        return [
            TableNameAndType(
                name=name, type_=RELKIND_MAP.get(relkind, TableType.Regular)
            )
            for name, relkind in result
        ]

    def get_database_names(self) -> Iterable[str]:
        if not self.config.serviceConnection.__root__.config.ingestAllDatabases:
            configured_db = self.config.serviceConnection.__root__.config.database
            self.set_inspector(database_name=configured_db)
            yield configured_db
        else:
            results = self.connection.execute(POSTGRES_GET_DB_NAMES)
            for res in results:
                row = list(res)
                new_database = row[0]
                database_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.database_service.name.__root__,
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
                    yield new_database
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error trying to connect to database {new_database}: {exc}"
                    )

    def get_table_partition_details(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> Tuple[bool, TablePartition]:
        result = self.engine.execute(
            POSTGRES_PARTITION_DETAILS.format(
                table_name=table_name, schema_name=schema_name
            )
        ).all()
        if result:
            partition_details = TablePartition(
                intervalType=INTERVAL_TYPE_MAP.get(
                    result[0].partition_strategy, IntervalType.COLUMN_VALUE.value
                ),
                columns=[row.column_name for row in result if row.column_name],
            )
            return True, partition_details
        return False, None

    def yield_tag(self, schema_name: str) -> Iterable[OMetaTagAndClassification]:
        """
        Fetch Tags
        """
        try:
            result = self.engine.execute(
                POSTGRES_GET_ALL_TABLE_PG_POLICY.format(
                    database_name=self.context.database.name.__root__,
                    schema_name=schema_name,
                )
            ).all()

            for res in result:
                row = list(res)
                fqn_elements = [name for name in row[2:] if name]
                yield OMetaTagAndClassification(
                    fqn=fqn._build(  # pylint: disable=protected-access
                        self.context.database_service.name.__root__, *fqn_elements
                    ),
                    classification_request=CreateClassificationRequest(
                        name=self.service_connection.classificationName,
                        description="Postgres Tag Name",
                    ),
                    tag_request=CreateTagRequest(
                        classification=self.service_connection.classificationName,
                        name=row[1],
                        description="Postgres Tag Value",
                    ),
                )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Skipping Policy Tag: {exc}")
