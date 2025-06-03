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
Glue source methods.
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
    FileFormat,
    Table,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection,
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
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.column_helpers import truncate_column_name
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.external_table_lineage_mixin import (
    ExternalTableLineageMixin,
)
from metadata.ingestion.source.database.glue.models import Column as GlueColumn
from metadata.ingestion.source.database.glue.models import (
    DatabasePage,
    StorageDetails,
    TablePage,
)
from metadata.ingestion.source.database.stored_procedures_mixin import QueryByProcedure
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class GlueSource(ExternalTableLineageMixin, DatabaseServiceSource):
    """
    Implements the necessary methods to extract
    Database metadata from Glue Source
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.glue = get_connection(self.service_connection)

        self.connection_obj = self.glue
        self.schema_description_map = {}
        self.external_location_map = {}
        self.test_connection()

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: GlueConnection = config.serviceConnection.root.config
        if not isinstance(connection, GlueConnection):
            raise InvalidSourceException(
                f"Expected GlueConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _get_glue_database_and_schemas(self):
        paginator = self.glue.get_paginator("get_databases")
        paginator_response = paginator.paginate()
        for page in paginator_response:
            yield DatabasePage(**page)

    def _get_glue_tables(self):
        schema_name = self.context.get().database_schema
        paginator = self.glue.get_paginator("get_tables")
        paginator_response = paginator.paginate(DatabaseName=schema_name)
        for page in paginator_response:
            yield TablePage(**page)

    def get_database_names(self) -> Iterable[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this and
        apply the necessary filters.

        Catalog ID -> Database
        """
        if self.service_connection.databaseName:
            yield self.service_connection.databaseName
        else:
            database_names = set()
            for page in self._get_glue_database_and_schemas() or []:
                for schema in page.DatabaseList:
                    try:
                        database_fqn = fqn.build(
                            self.metadata,
                            entity_type=Database,
                            service_name=self.context.get().database_service,
                            database_name=schema.CatalogId,
                        )
                        if filter_by_database(
                            self.config.sourceConfig.config.databaseFilterPattern,
                            database_fqn
                            if self.config.sourceConfig.config.useFqnForFiltering
                            else schema.CatalogId,
                        ):
                            self.status.filter(
                                database_fqn,
                                "Database (Catalog ID) Filtered Out",
                            )
                            continue
                        if schema.CatalogId in database_names:
                            continue
                        database_names.add(schema.CatalogId)
                    except Exception as exc:
                        self.status.failed(
                            StackTraceError(
                                name=schema.CatalogId,
                                error=f"Unexpected exception to get database name [{schema.CatalogId}]: {exc}",
                                stackTrace=traceback.format_exc(),
                            )
                        )

            yield from database_names

    def yield_database(
        self, database_name: str
    ) -> Iterable[Either[CreateDatabaseRequest]]:
        """
        From topology.
        Prepare a database request and pass it to the sink
        """
        yield Either(
            right=CreateDatabaseRequest(
                name=database_name,
                service=self.context.get().database_service,
            )
        )

    def get_database_schema_names(self) -> Iterable[str]:
        """
        return schema names
        """
        for page in self._get_glue_database_and_schemas() or []:
            for schema in page.DatabaseList:
                try:
                    schema_fqn = fqn.build(
                        self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=schema.Name,
                    )
                    if filter_by_schema(
                        self.config.sourceConfig.config.schemaFilterPattern,
                        schema_fqn
                        if self.config.sourceConfig.config.useFqnForFiltering
                        else schema.Name,
                    ):
                        self.status.filter(schema_fqn, "Schema Filtered Out")
                        continue
                    if schema.Description:
                        self.schema_description_map[schema.Name] = Markdown(
                            schema.Description
                        )
                    yield schema.Name
                except Exception as exc:
                    self.status.failed(
                        StackTraceError(
                            name=schema.Name,
                            error=f"Unexpected exception to get database schema [{schema.Name}]: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """
        yield Either(
            right=CreateDatabaseSchemaRequest(
                name=EntityName(schema_name),
                description=self.schema_description_map.get(schema_name),
                database=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=Database,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                    )
                ),
                sourceUrl=self.get_source_url(
                    database_name=self.context.get().database,
                    schema_name=schema_name,
                ),
            )
        )

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Handle table and views.

        Fetches them up using the context information and
        the inspector set when preparing the db.

        :return: tables or views, depending on config
        """
        schema_name = self.context.get().database_schema

        for page in self._get_glue_tables():
            for table in page.TableList:
                try:
                    table_name = table.Name
                    table_name = self.standardize_table_name(schema_name, table_name)
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

                    parameters = table.Parameters

                    table_type: TableType = TableType.Regular
                    if parameters and parameters.table_type == "ICEBERG":
                        # iceberg tables need to pass a key/value pair in the DDL `'table_type'='ICEBERG'`
                        # https://docs.aws.amazon.com/athena/latest/ug/querying-iceberg-creating-tables.html
                        table_type = TableType.Iceberg
                    elif table.TableType == "EXTERNAL_TABLE":
                        table_type = TableType.External
                    elif table.TableType == "VIRTUAL_VIEW":
                        table_type = TableType.View

                    self.context.get().table_data = table
                    yield table_name, table_type
                except Exception as exc:
                    self.status.failed(
                        StackTraceError(
                            name=table.Name,
                            error=f"Unexpected exception to get table [{table.Name}]: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def yield_table(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        table = self.context.get().table_data
        table_constraints = None
        storage_descriptor = table.StorageDescriptor
        database_name = self.context.get().database
        schema_name = self.context.get().database_schema
        if storage_descriptor.Location:
            # s3a doesn't occur as a path in containers, so it needs to be replaced for lineage to work
            self.external_location_map[
                (database_name, schema_name, table_name)
            ] = storage_descriptor.Location.replace("s3a://", "s3://")
        try:
            columns = self.get_columns(storage_descriptor)
            table_request = CreateTableRequest(
                name=EntityName(table_name),
                tableType=table_type,
                description=table.Description,
                columns=list(columns),
                tableConstraints=table_constraints,
                databaseSchema=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=database_name,
                        schema_name=schema_name,
                    )
                ),
                sourceUrl=self.get_source_url(
                    table_name=table_name,
                    schema_name=self.context.get().database_schema,
                    database_name=self.context.get().database,
                ),
                fileFormat=self.get_format(storage_descriptor),
                locationPath=storage_descriptor.Location,
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

    def prepare(self):
        """Nothing to prepare"""

    def _get_column_object(self, column: GlueColumn) -> Column:
        if column.Type.lower().startswith("union"):
            column.Type = column.Type.replace(" ", "")
        parsed_string = (
            ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
                column.Type.lower()
            )
        )
        if isinstance(parsed_string, list):
            parsed_string = {}
            parsed_string["dataTypeDisplay"] = str(column.Type)
            parsed_string["dataType"] = "UNION"
        parsed_string["name"] = truncate_column_name(column.Name)
        parsed_string["displayName"] = column.Name
        parsed_string["dataLength"] = parsed_string.get("dataLength", 1)
        parsed_string["description"] = column.Comment
        return Column(**parsed_string)

    def get_columns(self, column_data: StorageDetails) -> Optional[Iterable[Column]]:
        # process table regular columns info
        for column in column_data.Columns:
            yield self._get_column_object(column)

        # process table regular columns info
        for column in self.context.get().table_data.PartitionKeys:
            yield self._get_column_object(column)

    @classmethod
    def get_format(cls, storage: StorageDetails) -> Optional[FileFormat]:
        library = storage.SerdeInfo.SerializationLibrary
        if library is None:
            return None
        if library.endswith(".LazySimpleSerDe"):
            return (
                FileFormat.tsv
                if storage.SerdeInfo.Parameters.get("serialization.format") == "\t"
                else FileFormat.csv
            )
        return next((fmt for fmt in FileFormat if fmt.value in library.lower()), None)

    def standardize_table_name(self, _: str, table: str) -> str:
        return table[:128]

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """We don't pick up tags from Glue"""

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
        database_name: Optional[str],
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None,
    ) -> Optional[str]:
        """
        Method to get the source url for dynamodb
        """
        try:
            if schema_name:
                base_url = (
                    f"https://{self.service_connection.awsConfig.awsRegion}.console.aws.amazon.com/"
                    f"glue/home?region={self.service_connection.awsConfig.awsRegion}#/v2/data-catalog/"
                )

                schema_url = (
                    f"{base_url}databases/view"
                    f"/{schema_name}?catalogId={database_name}"
                )
                if not table_name:
                    return schema_url
                table_url = (
                    f"{base_url}tables/view/{table_name}"
                    f"?database={schema_name}&catalogId={database_name}&versionId=latest"
                )
                return table_url
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get source url: {exc}")
        return None

    def close(self):
        """Nothing to close"""
