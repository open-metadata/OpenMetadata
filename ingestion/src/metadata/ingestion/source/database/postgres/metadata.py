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
from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    IntervalType,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.postgres.queries import (
    POSTGRES_GET_ALL_TABLE_PG_POLICY,
    POSTGRES_GET_DB_NAMES,
    POSTGRES_GET_TABLE_NAMES,
    POSTGRES_PARTITION_DETAILS,
)
from metadata.ingestion.source.database.postgres.utils import (
    get_column_info,
    get_columns,
    get_schema_names,
    get_schema_names_reflection,
    get_table_comment,
    get_view_definition,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_view_definitions,
)
from metadata.utils.tag_utils import get_ometa_tag_and_classification

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


PGDialect.get_all_table_comments = get_all_table_comments
PGDialect.get_table_comment = get_table_comment
PGDialect._get_column_info = get_column_info  # pylint: disable=protected-access
PGDialect.get_view_definition = get_view_definition
PGDialect.get_columns = get_columns
PGDialect.get_all_view_definitions = get_all_view_definitions
PGDialect.get_schema_names = get_schema_names
Inspector.get_schema_names = get_schema_names_reflection
PGDialect.ischema_names = ischema_names


class PostgresSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Postgres Source
    """

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: PostgresConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, PostgresConnection):
            raise InvalidSourceException(
                f"Expected PostgresConnection, but got {connection}"
            )
        return cls(config, metadata)

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Overwrite the inspector implementation to handle partitioned
        and foreign types
        """
        if self.source_config.tableFilterPattern:
            tb_patterns_include = [
                tb_name.replace("%", "%%")
                for tb_name in self.source_config.tableFilterPattern.includes
                if self.source_config.tableFilterPattern.includes
            ]
            tb_patterns_exclude = [
                tb_name.replace("%", "%%")
                for tb_name in self.source_config.tableFilterPattern.excludes
                if self.source_config.tableFilterPattern.excludes
            ]
            format_pattern = (
                f"AND c.relname LIKE ANY (ARRAY{tb_patterns_include})"
                if self.source_config.databaseFilterPattern.includes
                else f"AND c.relname NOT LIKE ANY (ARRAY{tb_patterns_exclude})"
            )

        result = self.connection.execute(
            sql.text(POSTGRES_GET_TABLE_NAMES.format(format_pattern))
            if self.source_config.pushDownFilter
            and self.source_config.tableFilterPattern
            else sql.text(POSTGRES_GET_TABLE_NAMES.format("")),
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
            if self.source_config.databaseFilterPattern:
                db_patterns_include = [
                    db_name.replace("%", "%%")
                    for db_name in self.source_config.databaseFilterPattern.includes
                    if self.source_config.databaseFilterPattern.includes
                ]
                db_patterns_exclude = [
                    db_name.replace("%", "%%")
                    for db_name in self.source_config.databaseFilterPattern.excludes
                    if self.source_config.databaseFilterPattern.excludes
                ]

                format_pattern = (
                    f"WHERE datname LIKE ANY (ARRAY{db_patterns_include})"
                    if self.source_config.databaseFilterPattern.includes
                    else f"WHERE datname NOT LIKE ANY (ARRAY{db_patterns_exclude})"
                )

            results = self.connection.execute(
                POSTGRES_GET_DB_NAMES.format(format_pattern)
                if self.source_config.pushDownFilter
                and self.source_config.databaseFilterPattern
                else POSTGRES_GET_DB_NAMES.format("")
            )
            for res in results:
                row = list(res)
                new_database = row[0]
                database_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.database_service.name.__root__,
                    database_name=new_database,
                )
                if not self.source_config.pushDownFilter:
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

    def get_raw_database_schema_names(self) -> Iterable[str]:
        if self.service_connection.__dict__.get("databaseSchema"):
            yield self.service_connection.databaseSchema
        else:
            for schema_name in self.inspector.get_schema_names(
                pushDownFilter=self.source_config.pushDownFilter,
                filter_pattern=self.source_config.schemaFilterPattern,
            ):
                yield schema_name

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

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
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
                yield from get_ometa_tag_and_classification(
                    tag_fqn=fqn._build(  # pylint: disable=protected-access
                        self.context.database_service.name.__root__, *fqn_elements
                    ),
                    tags=[row[1]],
                    classification_name=self.service_connection.classificationName,
                    tag_description="Postgres Tag Value",
                    classification_description="Postgres Tag Name",
                )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Tags and Classification",
                    error=f"Skipping Policy Tag: {exc}",
                    stack_trace=traceback.format_exc(),
                )
            )
