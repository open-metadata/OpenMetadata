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
Domo Database source to extract metadata
"""

import traceback
from typing import Iterable, Optional, Tuple

from metadata.clients.domo_client import DomoClient
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Column, Table, TableType
from metadata.generated.schema.entity.services.connections.database.domodatabaseConnection import (
    DomoDatabaseConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.database_service import (
    DatabaseServiceSource,
    SQLSourceStatus,
)
from metadata.utils import fqn
from metadata.utils.connections import get_connection, test_connection
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DomodatabaseSource(DatabaseServiceSource):
    """
    Implements the necessary methods to extract
    Database metadata from Domo Database Source
    """

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata = OpenMetadata(metadata_config)
        self.service_connection = self.config.serviceConnection.__root__.config
        self.status = SQLSourceStatus()
        self.connection = get_connection(self.service_connection)
        self.domo_client = self.connection.client
        self.client = DomoClient(self.service_connection)
        super().__init__()

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: DomoDatabaseConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, DomoDatabaseConnection):
            raise InvalidSourceException(
                f"Expected DomoDatabaseConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_database_names(self) -> Iterable[str]:
        database_name = "default"
        yield database_name

    def yield_database(self, database_name: str) -> Iterable[CreateDatabaseRequest]:
        yield CreateDatabaseRequest(
            name=database_name,
            service=EntityReference(
                id=self.context.database_service.id,
                type="databaseService",
            ),
        )

    def get_database_schema_names(self) -> Iterable[str]:
        scheme_name = "default"
        yield scheme_name

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[CreateDatabaseSchemaRequest]:
        yield CreateDatabaseSchemaRequest(
            name=schema_name,
            database=EntityReference(id=self.context.database.id, type="database"),
        )

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        schema_name = self.context.database_schema.name.__root__
        table_id = ""
        try:
            tables = list(self.domo_client.datasets.list())
            for table in tables:
                table_id = table["id"]
                table_id = self.standardize_table_name(schema_name, table_id)
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.context.database_service.name.__root__,
                    database_name=self.context.database.name.__root__,
                    schema_name=self.context.database_schema.name.__root__,
                    table_name=table["name"],
                )

                if filter_by_table(
                    self.config.sourceConfig.config.tableFilterPattern,
                    table_fqn
                    if self.config.sourceConfig.config.useFqnForFiltering
                    else table["name"],
                ):
                    self.status.filter(
                        table_fqn,
                        "Table Filtered out",
                    )
                    continue
                yield table_id, TableType.Regular
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unexpected exception for schema name [{schema_name}]: {exc}"
            )
            self.status.failures.append(f"{self.config.serviceName}.{table_id}")

    def yield_table(
        self, table_name_and_type: Tuple[str, str]
    ) -> Iterable[Optional[CreateTableRequest]]:
        table_id, table_type = table_name_and_type
        try:
            table_constraints = None
            table_object = self.domo_client.datasets.get(table_id)
            columns = self.get_columns(table_object=table_object["schema"]["columns"])
            table_request = CreateTableRequest(
                name=table_object["name"],
                displayName=table_object["name"],
                tableType=table_type,
                description=table_object.get("description"),
                columns=columns,
                tableConstraints=table_constraints,
                databaseSchema=EntityReference(
                    id=self.context.database_schema.id,
                    type="databaseSchema",
                ),
            )
            yield table_request
            self.register_record(table_request=table_request)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception for table [{table_id}]: {exc}")
            self.status.failures.append(f"{self.config.serviceName}.{table_id}")

    def get_columns(self, table_object):
        row_order = 1
        columns = []
        for column in table_object:
            columns.append(
                Column(
                    name=column["name"],
                    description=column.get("description", ""),
                    dataType=column["type"],
                    ordinalPosition=row_order,
                )
            )
            row_order += 1
        return columns

    def test_connection(self) -> None:
        test_connection(self.connection)

    def yield_tag(self, schema_name: str) -> Iterable[OMetaTagAndCategory]:
        pass

    def yield_view_lineage(self) -> Optional[Iterable[AddLineageRequest]]:
        yield from []

    def standardize_table_name(  # pylint: disable=unused-argument
        self, schema: str, table: str
    ) -> str:
        return table
