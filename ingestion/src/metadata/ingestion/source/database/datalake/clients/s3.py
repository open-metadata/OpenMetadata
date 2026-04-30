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
from typing import Callable, Dict, Iterable, Optional, Set, Tuple  # noqa: UP035

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.ingestion.source.database.datalake.clients.base import DatalakeBaseClient
from metadata.utils.constants import DEFAULT_DATABASE
from metadata.utils.logger import ingestion_logger
from metadata.utils.s3_utils import list_s3_objects

logger = ingestion_logger()

S3_COLD_STORAGE_CLASSES: Set[str] = {"GLACIER", "DEEP_ARCHIVE", "GLACIER_IR"}  # noqa: UP006


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

    def get_database_schema_names(self, bucket_name: Optional[str]) -> Iterable[str]:  # noqa: UP045
        if bucket_name:
            yield bucket_name
        else:
            for bucket in self._client.list_buckets()["Buckets"]:
                yield bucket["Name"]

    @staticmethod
    def _should_skip_s3_cold_storage(key: dict) -> bool:
        storage_class = key.get("StorageClass", "STANDARD")
        archive_status = key.get("ArchiveStatus", "")
        return storage_class in S3_COLD_STORAGE_CLASSES or archive_status in {
            "ARCHIVE_ACCESS",
            "DEEP_ARCHIVE_ACCESS",
        }

    def _discover_iceberg_dirs(
        self,
        skip_cold_storage: bool,
        **kwargs: str,
    ) -> Tuple[Dict[str, Tuple[int, str, int | None]], Set[str]]:  # noqa: UP006
        """Pass 1: discover Iceberg table directories and return (iceberg_tables, iceberg_dirs)."""
        iceberg_tables: Dict[str, Tuple[int, str, int | None]] = {}  # noqa: UP006
        cold_iceberg_dirs: Set[str] = set()  # noqa: UP006

        for key in list_s3_objects(self._client, **kwargs):
            key_name = key["Key"]
            size = key.get("Size")
            if skip_cold_storage and self._should_skip_s3_cold_storage(key):
                logger.debug(
                    f"Skipping cold storage object: {key_name} "
                    f"(StorageClass: {key.get('StorageClass', 'STANDARD')}, "
                    f"ArchiveStatus: {key.get('ArchiveStatus', '')})"
                )
                match = self._ICEBERG_METADATA_RE.match(key_name)
                if match:
                    cold_iceberg_dirs.add(match.group(1))
                continue
            self._update_iceberg_entry(iceberg_tables, key_name, size)

        return iceberg_tables, set(iceberg_tables.keys()) | cold_iceberg_dirs

    def _yield_regular_files(
        self,
        skip_cold_storage: bool,
        iceberg_dirs: Set[str],  # noqa: UP006
        **kwargs: str,
    ) -> Iterable[Tuple[str, Optional[int]]]:  # noqa: UP006, UP045
        """Pass 2: stream regular files, skipping Iceberg directory contents."""
        for key in list_s3_objects(self._client, **kwargs):
            key_name = key["Key"]
            size = key.get("Size")
            if skip_cold_storage and self._should_skip_s3_cold_storage(key):
                continue
            if iceberg_dirs and (
                self._ICEBERG_METADATA_RE.match(key_name) or any(key_name.startswith(d + "/") for d in iceberg_dirs)
            ):
                continue
            yield key_name, size

    def get_table_names(
        self,
        bucket_name: str,
        prefix: Optional[str],  # noqa: UP045
        skip_cold_storage: bool = False,
    ) -> Iterable[Tuple[str, Optional[int]]]:  # noqa: UP006, UP045
        """
        Lists tables in an S3 bucket using a two-pass approach.

        Pass 1 collects only the Iceberg table dict (memory proportional to the
        number of Iceberg tables, which is always small). Pass 2 streams regular
        files without accumulation, keeping memory overhead at O(1) per object.
        """
        kwargs: Dict[str, str] = {"Bucket": bucket_name}  # noqa: UP006
        if prefix:
            kwargs["Prefix"] = prefix if prefix.endswith("/") else f"{prefix}/"

        iceberg_tables, iceberg_dirs = self._discover_iceberg_dirs(skip_cold_storage, **kwargs)

        for _, metadata_key, size in iceberg_tables.values():
            yield metadata_key, size

        yield from self._yield_regular_files(skip_cold_storage, iceberg_dirs, **kwargs)

    def get_folders_prefix(self, bucket_name: str, prefix: Optional[str]) -> Iterable[str]:  # noqa: UP045
        for page in self._client.get_paginator("list_objects_v2").paginate(
            Bucket=bucket_name, Prefix=prefix or "", Delimiter="/"
        ):
            for common_prefix in page.get("CommonPrefixes", []):
                yield common_prefix.get("Prefix")

    def close(self, service_connection):
        # For the S3 Client we don't need to do anything when closing the connection
        pass

    def get_test_list_buckets_fn(self, bucket_name: Optional[str]) -> Callable:  # noqa: UP045

        if bucket_name:
            return partial(self._client.list_objects, Bucket=bucket_name)
        return self._client.list_buckets
