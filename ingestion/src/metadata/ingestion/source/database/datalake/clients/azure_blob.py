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
Datalake Azure Blob Client
"""
from functools import partial
from typing import Callable, Iterable, Optional

from azure.storage.blob import BlobServiceClient

from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.ingestion.source.database.datalake.clients.base import DatalakeBaseClient
from metadata.utils.constants import DEFAULT_DATABASE


class DatalakeAzureBlobClient(DatalakeBaseClient):
    def __init__(self, client: BlobServiceClient):
        self._client = client

    @classmethod
    def from_config(cls, config: AzureConfig) -> "DatalakeAzureBlobClient":
        try:
            if not config.securityConfig:
                raise RuntimeError("AzureConfig securityConfig can't be None.")

            client = AzureClient(config.securityConfig).create_blob_client()
            return cls(client=client)
        except Exception as exc:
            raise RuntimeError(
                f"Unknown error connecting with {config.securityConfig}: {exc}."
            )

    def update_client_database(self, config, database_name):
        # For the AzureBlob Client we don't need to do anything when changing the database
        pass

    def get_database_names(self, service_connection) -> Iterable[str]:
        yield service_connection.databaseName or DEFAULT_DATABASE

    def get_database_schema_names(self, bucket_name: Optional[str]) -> Iterable[str]:
        prefix = bucket_name or ""

        for schema in self._client.list_containers(name_starts_with=prefix):
            yield schema["name"]

    def get_table_names(self, bucket_name: str, prefix: Optional[str]) -> Iterable[str]:
        container_client = self._client.get_container_client(bucket_name)

        for file in container_client.list_blobs(name_starts_with=prefix or None):
            yield file.name

    def close(self, service_connection):
        self._client.close()

    def get_test_list_buckets_fn(self, bucket_name: Optional[str]) -> Callable:
        def list_buckets(client: BlobServiceClient):
            conn = client.list_containers(name_starts_with="")
            list(conn)

        return partial(list_buckets, self._client)
