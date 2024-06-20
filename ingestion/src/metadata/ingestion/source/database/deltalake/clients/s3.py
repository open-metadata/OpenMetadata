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
Deltalake S3 Client
"""
import traceback
from functools import partial
from typing import Callable, Iterable, List, Optional

from deltalake import DeltaTable
from deltalake.exceptions import TableNotFoundError
from urllib3.util import Url

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.data.table import (
    Column,
    PartitionColumnDetails,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.deltalake.storageConfig import (
    StorageConfig,
)
from metadata.generated.schema.entity.services.connections.database.deltaLakeConnection import (
    DeltaLakeConnection,
)
from metadata.ingestion.source.database.datalake.clients.s3 import DatalakeS3Client
from metadata.ingestion.source.database.deltalake.clients.base import (
    DeltalakeBaseClient,
    TableInfo,
)
from metadata.utils.datalake.datalake_utils import ParquetDataFrameColumnParser
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DeltalakeS3Client(DeltalakeBaseClient):
    def __init__(self, client: DatalakeS3Client, storage_options: dict):
        self._client = client
        self._storage_options = storage_options

    @classmethod
    def from_config(
        cls, service_connection: DeltaLakeConnection
    ) -> "DeltalakeS3Client":
        # Get the credentials to pass to the storage options
        aws_client = AWSClient(
            service_connection.configSource.connection.securityConfig
        )
        session = aws_client.create_session()

        profile = session.profile_name
        region = session.region_name

        credentials = session.get_credentials().get_frozen_credentials()

        endpoint_url = (
            str(service_connection.configSource.connection.securityConfig.endPointURL)[
                :-1
            ]
            if service_connection.configSource.connection.securityConfig.endPointURL
            else None
        )

        storage_options = {
            "AWS_ACCESS_KEY_ID": credentials.access_key,
            "AWS_SECRET_ACCESS_KEY": credentials.secret_key,
            "AWS_SESSION_TOKEN": credentials.token,
            "AWS_PROFILE": profile,
            "AWS_REGION": region,
            "AWS_ENDPOINT_URL": endpoint_url,
            # Allow to use MinIO
            "AWS_ALLOW_HTTP": "true",
        }

        storage_options = {
            key: value for key, value in storage_options.items() if value
        }

        return cls(
            client=DatalakeS3Client.from_config(
                config=service_connection.configSource.connection
            ),
            storage_options=storage_options,
        )

    @staticmethod
    def _get_configured_bucket(
        service_connection: DeltaLakeConnection,
    ) -> Optional[str]:
        return (
            service_connection.configSource.bucketName
            if service_connection.configSource.bucketName
            else None
        )

    @staticmethod
    def _get_configured_prefix(service_connection: DeltaLakeConnection) -> str:
        return service_connection.configSource.prefix

    def get_database_names(
        self, service_connection: DeltaLakeConnection
    ) -> Iterable[str]:
        """Yields the Database name as set by the DatalakeS3Client."""
        yield from self._client.get_database_names(service_connection)

    def get_database_schema_names(
        self, service_connection: DeltaLakeConnection
    ) -> Iterable[str]:
        """Yields the Bucket Names as Schema Names from the DatalakeS3Client."""
        yield from self._client.get_database_schema_names(
            self._get_configured_bucket(service_connection)
        )

    def _read_delta_table(self, schema_name: str, prefix: str) -> Optional[DeltaTable]:
        url = Url(scheme="s3", host=schema_name, path=prefix)

        try:
            return DeltaTable(
                url.url,
                storage_options=self._storage_options,
                without_files=True,  # Avoids tracking the files that belongs to the Delta Table, reducing memory footprint
            )
        except TableNotFoundError:
            logger.debug(traceback.format_exc())
            logger.warning("No Delta Table found at path '%s/%s'.", schema_name, prefix)
            return None

    def _get_columns(self, table) -> List[Column]:
        return ParquetDataFrameColumnParser(data_frame=table.to_pandas()).get_columns()

    def _get_partitions(self, table) -> Optional[List[PartitionColumnDetails]]:
        return [
            PartitionColumnDetails(columnName=column)
            for column in table.metadata().partition_columns
        ] or None

    def _get_table_info(self, schema_name: str, prefix: str) -> Iterable[TableInfo]:
        """Iterates on the s3 'folders' trying to find DeltaTables. If a DeltaTable is found, yield its information."""
        table = self._read_delta_table(schema_name, prefix)

        if table:
            name = (
                table.metadata().name
                or [part for part in prefix.split("/") if part][-1]
                or table.metadata().id
            )
            yield TableInfo(
                schema=schema_name,
                name=name,
                location=prefix,
                description=table.metadata().description,
                _type=TableType.Regular,
            )
        else:
            for folder in self._client.get_folders_prefix(schema_name, prefix):
                yield from self._get_table_info(schema_name, folder)

    def get_table_info(
        self, service_connection: DeltaLakeConnection, schema_name: str
    ) -> Iterable[TableInfo]:
        """Yield TableInfo from found DeltaTables."""
        yield from self._get_table_info(
            schema_name, self._get_configured_prefix(service_connection)
        )

    def update_table_info(self, table_info: TableInfo) -> TableInfo:
        table = self._read_delta_table(table_info.schema, table_info.location)
        return TableInfo(
            schema=table_info.schema,
            name=table_info.name,
            _type=table_info._type,
            location=table_info.location,
            description=table_info.description,
            columns=self._get_columns(table),
            table_partitions=self._get_partitions(table),
        )

    def close(self, service_connection: DeltaLakeConnection):
        # For the S3 Client we don't need to do anything when closing the connection
        pass

    def get_test_get_databases_fn(self, config: StorageConfig) -> Callable:
        """Returns a Callable used to test the GetDatabases condition."""
        if config.bucketName:
            return partial(self._client._client.list_objects, Bucket=config.bucketName)
        return self._client._client.list_buckets

    def get_test_get_tables_fn(self, config: StorageConfig) -> Callable:
        """Returns a Callable used to test the GetTables condition."""
        return lambda: True
