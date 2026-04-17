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
Datalake S3 Client
"""
from functools import partial
from typing import Callable, Iterable, Optional, Set, Tuple

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.ingestion.source.database.datalake.clients.base import DatalakeBaseClient
from metadata.utils.constants import DEFAULT_DATABASE
from metadata.utils.logger import ingestion_logger
from metadata.utils.s3_utils import list_s3_objects

logger = ingestion_logger()

S3_COLD_STORAGE_CLASSES: Set[str] = {"GLACIER", "DEEP_ARCHIVE", "GLACIER_IR"}


class DatalakeS3Client(DatalakeBaseClient):
    @classmethod
    def from_config(cls, config: S3Config) -> "DatalakeS3Client":
        if not config.securityConfig:
            raise RuntimeError("S3Config securityConfig can't be None.")

        aws_client = AWSClient(config.securityConfig)
        session = aws_client.create_session()
        if config.securityConfig.endPointURL:
            s3_client = session.client(
                service_name="s3",
                endpoint_url=str(config.securityConfig.endPointURL),
            )
        else:
            s3_client = session.client(service_name="s3")
        return cls(client=s3_client, session=session)

    def update_client_database(self, config, database_name: str):
        # For the S3 Client we don't need to do anything when changing the database
        pass

    def get_database_names(self, service_connection) -> Iterable[str]:
        yield service_connection.databaseName or DEFAULT_DATABASE

    def get_database_schema_names(self, bucket_name: Optional[str]) -> Iterable[str]:
        if bucket_name:
            yield bucket_name
        else:
            for bucket in self._client.list_buckets()["Buckets"]:
                yield bucket["Name"]

    def get_table_names(
        self,
        bucket_name: str,
        prefix: Optional[str],
        skip_cold_storage: bool = False,
    ) -> Iterable[Tuple[str, Optional[int]]]:
        kwargs = {"Bucket": bucket_name}

        if prefix:
            kwargs["Prefix"] = prefix if prefix.endswith("/") else f"{prefix}/"

        for key in list_s3_objects(self._client, **kwargs):
            if skip_cold_storage:
                storage_class = key.get("StorageClass", "STANDARD")
                archive_status = key.get("ArchiveStatus", "")
                if storage_class in S3_COLD_STORAGE_CLASSES or archive_status in {
                    "ARCHIVE_ACCESS",
                    "DEEP_ARCHIVE_ACCESS",
                }:
                    logger.debug(
                        f"Skipping cold storage object: {key['Key']} "
                        f"(StorageClass: {storage_class}, ArchiveStatus: {archive_status})"
                    )
                    continue
            yield key["Key"], key.get("Size")

    def get_folders_prefix(
        self, bucket_name: str, prefix: Optional[str]
    ) -> Iterable[str]:
        for page in self._client.get_paginator("list_objects_v2").paginate(
            Bucket=bucket_name, Prefix=prefix or "", Delimiter="/"
        ):
            for common_prefix in page.get("CommonPrefixes", []):
                yield common_prefix.get("Prefix")

    def close(self, service_connection):
        # For the S3 Client we don't need to do anything when closing the connection
        pass

    def get_test_list_buckets_fn(self, bucket_name: Optional[str]) -> Callable:

        if bucket_name:
            return partial(self._client.list_objects, Bucket=bucket_name)
        return self._client.list_buckets
