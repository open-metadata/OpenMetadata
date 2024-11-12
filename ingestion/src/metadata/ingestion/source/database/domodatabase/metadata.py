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
from typing import Any, Iterable, Optional, Tuple

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
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    Table,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.domoDatabaseConnection import (
    DomoDatabaseConnection,
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
from metadata.ingestion.source.database.domodatabase.models import (
    OutputDataset,
    Owner,
    Schema,
    SchemaColumn,
    User,
)
from metadata.ingestion.source.database.stored_procedures_mixin import QueryByProcedure
from metadata.utils import fqn
from metadata.utils.constants import DEFAULT_DATABASE
from metadata.utils.filters import filter_by_table
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DomodatabaseSource(DatabaseServiceSource):
    """
    Implements the necessary methods to extract
    Database metadata from Domo Database Source
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.domo_client = get_connection(self.service_connection)
        self.connection_obj = self.domo_client
        self.test_connection()

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: DomoDatabaseConnection = config.serviceConnection.root.config
        if not isinstance(connection, DomoDatabaseConnection):
            raise InvalidSourceException(
                f"Expected DomoDatabaseConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        database_name = self.service_connection.databaseName or DEFAULT_DATABASE
        yield database_name

    def yield_database(
        self, database_name: str
    ) -> Iterable[Either[CreateDatabaseRequest]]:
        yield Either(
            right=CreateDatabaseRequest(
                name=EntityName(database_name),
                service=self.context.get().database_service,
            )
        )

    def get_database_schema_names(self) -> Iterable[str]:
        scheme_name = "default"
        yield scheme_name

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
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
        schema_name = self.context.get().database_schema
        try:
            tables = list(self.domo_client.datasets.list())
            for table in tables:
                table_id = table["id"]
                table_id = self.standardize_table_name(schema_name, table_id)
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=self.context.get().database_schema,
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
            self.status.failed(
                StackTraceError(
                    name=schema_name,
                    error=f"Fetching tables names failed for schema {schema_name} due to - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_owners(self, owner: Owner) -> Optional[EntityReferenceList]:
        try:
            owner_details = User(**self.domo_client.users_get(owner.id))
            if owner_details.email:
                return self.metadata.get_reference_by_email(owner_details.email)
        except Exception as exc:
            logger.warning(f"Error while getting details of user {owner.name} - {exc}")
        return None

    def yield_table(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[CreateTableRequest]]:
        table_id, table_type = table_name_and_type
        try:
            table_constraints = None
            table_object = OutputDataset(**self.domo_client.datasets.get(table_id))
            columns = self.get_columns(table_object)
            table_request = CreateTableRequest(
                name=EntityName(table_object.name),
                displayName=table_object.name,
                tableType=table_type,
                description=table_object.description,
                columns=columns,
                owners=self.get_owners(owner=table_object.owner),
                tableConstraints=table_constraints,
                databaseSchema=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                    )
                ),
                sourceUrl=self.get_source_url(
                    table_name=table_id,
                ),
            )
            yield Either(right=table_request)
            self.register_record(table_request=table_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=table_id,
                    error=f"Unexpected exception for table [{table_id}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_columns_from_federated_dataset(self, table_name: str, dataset_id: str):
        """
        Method to retrieve the column metadata from federated datasets
        """
        try:
            # SQL query to get all columns without fetching any rows
            sql_query = f'SELECT * FROM "{table_name}" LIMIT 1'
            schema_columns = []
            response = self.domo_client.datasets.query(dataset_id, sql_query)
            if response:
                for i, column_name in enumerate(response["columns"] or []):
                    schema_column = SchemaColumn(
                        name=column_name, type=response["metadata"][i]["type"]
                    )
                    schema_columns.append(schema_column)
            if schema_columns:
                return Schema(columns=schema_columns)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error while fetching columns from federated dataset {table_name} - {exc}"
            )
        return None

    def get_columns(self, table_object: OutputDataset):
        """
        Method to get domo table columns
        """
        row_order = 1
        columns = []
        if not table_object.schemas or not table_object.schemas.columns:
            table_object.schemas = self.get_columns_from_federated_dataset(
                table_name=table_object.name, dataset_id=table_object.id
            )

        for column in table_object.schemas.columns or []:
            try:
                columns.append(
                    Column(
                        name=ColumnName(column.name),
                        description=column.description,
                        dataType=column.type,
                        ordinalPosition=row_order,
                    )
                )
                row_order += 1
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error while fetching details of column {column} - {exc}"
                )
        return columns

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """No tags to send"""

    def get_stored_procedures(self) -> Iterable[Any]:
        """Not implemented"""

    def yield_stored_procedure(
        self, stored_procedure: Any
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Not implemented"""

    def get_stored_procedure_queries(self) -> Iterable[QueryByProcedure]:
        """Not Implemented"""

    def get_source_url(
        self,
        table_name: Optional[str] = None,
    ) -> Optional[str]:
        """
        Method to get the source url for domodatabase
        """
        try:
            return f"{clean_uri(self.service_connection.instanceDomain)}/datasources/{table_name}/details/overview"
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get source url for {table_name}: {exc}")
        return None

    def standardize_table_name(  # pylint: disable=unused-argument
        self, schema: str, table: str
    ) -> str:
        return table

    def close(self) -> None:
        """Nothing to close"""
