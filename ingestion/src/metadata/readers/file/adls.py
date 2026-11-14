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
Read files from Azure Data Lake Storage Gen2 / Blob Storage.
"""

from __future__ import annotations

import traceback
from typing import TYPE_CHECKING, Any

from metadata.clients.azure_client import AzureClient
from metadata.readers.file.base import Reader, ReadException
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
        AzureConfig,
    )

logger = ingestion_logger()


AZURE_PATH = "abfs://{bucket_name}@{account_name}.dfs.core.windows.net/{key}"


def build_azure_abfs_path(
    bucket_name: str,
    account_name: str | None,
    key: str,
    endpoint_suffix: str | None = None,
) -> str:
    validated_bucket = AzureClient.validate_container_name(bucket_name)
    validated_account = AzureClient.validate_resource_name(account_name, "Account Name")
    resolved_suffix = AzureClient.resolve_endpoint_suffix(endpoint_suffix)
    return f"abfs://{validated_bucket}@{validated_account}.dfs.{resolved_suffix}/{key}"


def return_azure_storage_options(config_source: AzureConfig) -> dict[str, Any]:
    """
    Build the Azure Storage options passed to adlfs / fsspec readers.
    `account_name` is omitted here because callers instantiating
    `AzureBlobFileSystem(account_name=..., **storage_options)` pass it explicitly.
    """
    connection_args = config_source.securityConfig
    if connection_args is None:
        raise ValueError("Azure securityConfig is required")

    account_name = AzureClient.validate_resource_name(connection_args.accountName, "Account Name")
    endpoint_suffix = AzureClient.resolve_endpoint_suffix(connection_args.endpointSuffix)
    authority = AzureClient.resolve_authority(endpoint_suffix, connection_args.authority)

    if (
        endpoint_suffix == AzureClient.DEFAULT_ENDPOINT_SUFFIX
        and authority is None
        and connection_args.tenantId
        and connection_args.clientId
        and connection_args.clientSecret
    ):
        return {
            "tenant_id": connection_args.tenantId,
            "client_id": connection_args.clientId,
            "client_secret": connection_args.clientSecret.get_secret_value(),
        }

    # adlfs constructs ClientSecretCredential without `authority` when given raw
    # client_id/client_secret, and crashes on None.get_secret_value() for Managed
    # Identity / DefaultAzureCredential; passing the pre-built credential fixes both
    # (ADR:2026-11-13-azure-credentials-derive-sovereign-endpoints-from-suffix).
    storage_options: dict[str, Any] = {
        "credential": AzureClient(connection_args).create_client(),
    }
    if endpoint_suffix != AzureClient.DEFAULT_ENDPOINT_SUFFIX:
        storage_options["account_host"] = f"{account_name}.blob.{endpoint_suffix}"
    return storage_options


def ensure_azure_pandas_storage_options(storage_options: dict[str, Any], account_name: str | None) -> dict[str, Any]:
    """
    adlfs._get_kwargs_from_urls only extracts `account_name` from `.core.windows.net`
    ABFS URLs; pandas readers targeting sovereign or custom clouds require `account_name`
    in `storage_options`.
    """
    if (
        "account_host" in storage_options
        and "account_name" not in storage_options
        and "connection_string" not in storage_options
        and account_name
    ):
        validated_account = AzureClient.validate_resource_name(account_name, "Account Name")
        return {**storage_options, "account_name": validated_account}
    return storage_options


class ADLSReader(Reader):
    """ADLS Reader
    Class to read from buckets with prefix as paths
    """

    def __init__(self, client: Any):
        self.client = client

    def read(
        self,
        path: str,
        *,
        bucket_name: str | None = None,
        verbose: bool = True,
        **__: Any,
    ) -> bytes:
        try:
            container_client = self.client.get_container_client(bucket_name)
            return container_client.get_blob_client(path).download_blob().readall()
        except Exception as err:
            if verbose:
                logger.debug(traceback.format_exc())
            raise ReadException(f"Error fetching file [{path}] from ADLS: {err}") from err

    def _get_tree(self) -> list[str]:
        raise NotImplementedError("Not implemented")

    def download(
        self,
        path: str,
        local_file_path: str,
        *,
        bucket_name: str | None = None,
        verbose: bool = True,
        **__: Any,
    ) -> None:
        try:
            container_client = self.client.get_container_client(bucket_name)
            with open(local_file_path, "wb") as download_file:  # noqa: PTH123
                download_file.write(container_client.get_blob_client(path).download_blob().readall())
        except Exception as err:
            if verbose:
                logger.debug(traceback.format_exc())
            raise ReadException(f"Error downloading file [{path}] from ADLS: {err}") from err
