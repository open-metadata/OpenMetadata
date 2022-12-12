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
Datalake Gen2 source to extract metadata
"""

from typing import Iterable, Optional, Tuple

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Column, Table, TableType
from metadata.generated.schema.entity.services.connections.database.datalakegen2Connection import (
    DatalakeGen2Connection,
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


DATALAKE_SUPPORTED_FILE_TYPES = (".csv", ".parquet")


class Datalakegen2Source(DatabaseServiceSource):
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
        self.client = self.connection.client
        super().__init__()

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: DatalakeGen2Connection = config.serviceConnection.__root__.config
        if not isinstance(connection, DatalakeGen2Connection):
            raise InvalidSourceException(
                f"Expected DomoDatabaseConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_database_names(self) -> Iterable[str]:
        databases = self.client.list_containers(name_starts_with="")
        return databases

    def get_database_schema_names(self) -> Iterable[str]:
        schema_name = "default"
        yield schema_name

    def get_tables(self, container_name) -> Iterable[any]:
        tables = self.client.get_container_client(container_name)
        return tables

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:

        container_name = self.context.database.name.__root__
        file_names = self.get_tables(container_name=container_name)
        for file in file_names.list_blobs(name_starts_with=""):
            file_name = file.name
            if "/" in file.name:
                file_name = file.name.split("/")[-1]
                table_name = self.standardize_table_name(container_name, file_name)
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.context.database_service.name.__root__,
                    database_name=self.context.database.name.__root__,
                    schema_name=self.context.database_schema.name.__root__,
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
                        "Object Filtered Out",
                    )
                    continue
                if not self.check_valid_file_type(file_name):
                    logger.debug(
                        f"Object filtered due to unsupported file type: {file_name}"
                    )
                    continue
                self.context.file_path = file.name
                yield file_name, TableType.Regular

    def check_valid_file_type(self, key_name):
        if key_name.endswith(DATALAKE_SUPPORTED_FILE_TYPES):
            return True
        return False

    def yield_database(self, database_name: str) -> Iterable[CreateDatabaseRequest]:
        yield CreateDatabaseRequest(
            name=database_name["name"],
            displayName=database_name["name"],
            service=EntityReference(
                id=self.context.database_service.id,
                type="databaseService",
            ),
        )

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[CreateDatabaseSchemaRequest]:
        yield CreateDatabaseSchemaRequest(
            name=schema_name,
            displayName=schema_name,
            database=EntityReference(id=self.context.database.id, type="database"),
        )

    def get_columns(self, dataframe):
        columns = []
        for col in dataframe.columns:
            columns.append(
                Column(name=dataframe[col].name, dataType=dataframe[col].dtype.upper())
            )

        return columns

    def yield_table(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[CreateTableRequest]:

        import pandas  # pylint: disable=import-outside-toplevel

        table_name, table_type = table_name_and_type

        dataframe = pandas.read_csv(
            f"abfs[s]://{self.context.database.name.__root__}@{self.service_connection.accountName}"
            f".dfs.core.windows.net/{self.context.file_path}"
        )

        yield CreateTableRequest(
            name=table_name,
            displayName=table_name,
            columns=self.get_columns(dataframe),
            tableType=table_type,
            databaseSchema=EntityReference(
                id=self.context.database_schema.id,
                type="databaseSchema",
            ),
        )

    def yield_tag(self, schema_name: str) -> Iterable[OMetaTagAndCategory]:
        pass

    def yield_view_lineage(self) -> Optional[Iterable[AddLineageRequest]]:
        pass

    def standardize_table_name(
        self, schema: str, table: str  # pylint: disable=unused-argument
    ) -> str:
        return table

    def test_connection(self) -> None:
        test_connection(self.connection)
