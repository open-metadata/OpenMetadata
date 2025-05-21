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
Iceberg source methods.
"""
import traceback
from typing import Any, Iterable, Optional, Tuple

import pyiceberg
import pyiceberg.exceptions

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.entity.services.connections.database.icebergConnection import (
    IcebergConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.iceberg.helper import (
    get_owner_from_table,
    get_table_name_as_str,
    namespace_to_str,
)
from metadata.ingestion.source.database.iceberg.models import IcebergTable
from metadata.utils import fqn
from metadata.utils.filters import filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class IcebergSource(DatabaseServiceSource):
    """
    Implements the necessary methods to extract Iceberg metadata.
    Relies on [PyIceberg](https://py.iceberg.apache.org/).
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.iceberg = get_connection(self.service_connection)

        self.connection_obj = self.iceberg
        self.test_connection()

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: IcebergConnection = config.serviceConnection.root.config
        if not isinstance(connection, IcebergConnection):
            raise InvalidSourceException(
                f"Expected GlueConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        """
        Prepares the database name to be sent to stage.
        Filtering happens here.
        """
        yield self.service_connection.catalog.databaseName or "default"

    def yield_database(
        self, database_name: str
    ) -> Iterable[Either[CreateDatabaseRequest]]:
        """
        From topology.
        Prepare a database request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """
        yield Either(
            right=CreateDatabaseRequest(
                name=database_name,
                service=self.context.get().database_service,
            )
        )

    def get_database_schema_names(self) -> Iterable[str]:
        """
        Prepares the database schema name to be sent to stage.
        Filtering happens here.
        """
        for namespace in self.iceberg.list_namespaces():
            namespace_name = namespace_to_str(namespace)
            try:
                schema_fqn = fqn.build(
                    self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=namespace_name,
                )
                if filter_by_schema(
                    self.config.sourceConfig.config.schemaFilterPattern,
                    schema_fqn
                    if self.config.sourceConfig.config.useFqnForFiltering
                    else namespace_name,
                ):
                    self.status.filter(schema_fqn, "Schema Filtered Out")
                    continue
                yield namespace_name
            except Exception as exc:
                self.status.failed(
                    StackTraceError(
                        name=namespace_name,
                        error=f"Unexpected exception to get the namespace [{namespace_name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
        """
        From topology.
        Prepare a database request and pass it to the sink.
        """
        yield Either(
            right=CreateDatabaseSchemaRequest(
                name=EntityName(schema_name),
                database=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=Database,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                    )
                ),
            )
        )

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Prepares the table name to be sent to stage.
        Filtering happens here.
        """
        namespace = self.context.get().database_schema

        for table_identifier in self.iceberg.list_tables(namespace):
            try:
                table = self.iceberg.load_table(table_identifier)
                # extract table name from table identifier, which does not include catalog name
                table_name = get_table_name_as_str(table_identifier)
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=self.context.get().database_schema,
                    table_name=table_name,
                )
                if filter_by_table(
                    self.config.sourceConfig.config.tableFilterPattern,
                    table_fqn
                    if self.config.sourceConfig.config.useFqnForFiltering
                    else table_name,
                ):
                    self.status.filter(
                        table_fqn,
                        "Table Filtered Out",
                    )
                    continue

                self.context.get().iceberg_table = table
                yield table_name, TableType.Regular
            except pyiceberg.exceptions.NoSuchPropertyException:
                logger.warning(
                    f"Table [{table_identifier}] does not have the 'table_type' property. Skipped."
                )
                continue
            except pyiceberg.exceptions.NoSuchIcebergTableError:
                logger.warning(
                    f"Table [{table_identifier}] is not an Iceberg Table. Skipped."
                )
                continue
            except pyiceberg.exceptions.NoSuchTableError:
                logger.warning(f"Table [{table_identifier}] not Found. Skipped.")
                continue
            except Exception as exc:
                table_name = ".".join(table_identifier)
                self.status.failed(
                    StackTraceError(
                        name=table_name,
                        error=f"Unexpected exception to get table [{table_name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def get_owner_ref(self, table_name: str) -> Optional[EntityReferenceList]:
        owner = get_owner_from_table(
            self.context.get().iceberg_table, self.service_connection.ownershipProperty
        )
        try:
            if owner:
                owner_reference = self.metadata.get_reference_by_email(owner)
                return owner_reference
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner data due to {err}")
        return None

    def yield_table(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """
        table_name, table_type = table_name_and_type
        iceberg_table = self.context.get().iceberg_table
        try:
            owners = self.get_owner_ref(table_name)
            table = IcebergTable.from_pyiceberg(
                table_name, table_type, owners, iceberg_table
            )
            table_request = CreateTableRequest(
                name=EntityName(table.name),
                tableType=table.tableType,
                description=table.description,
                owners=table.owners,
                columns=table.columns,
                tablePartition=table.tablePartition,
                databaseSchema=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                    )
                ),
            )
            yield Either(right=table_request)
            self.register_record(table_request=table_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=table_name,
                    error=f"Unexpected exception to yield table [{table_name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each schema
        """
        yield from []

    def get_stored_procedures(self) -> Iterable[Any]:
        """Not Implemented"""

    def yield_stored_procedure(
        self, stored_procedure: Any
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Process the stored procedure information"""
        yield from []

    def close(self):
        """There is no connection to close."""
