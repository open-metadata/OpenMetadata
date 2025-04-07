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
Read files as string from S3
"""
import traceback
from typing import Dict, List

from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.readers.file.base import Reader, ReadException
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


AZURE_PATH = "abfs://{bucket_name}@{account_name}.dfs.core.windows.net/{key}"


def return_azure_storage_options(config_source: AzureConfig) -> Dict[str, str]:
    """
    Build the Azure Storage options to pass to the readers.
    We are not adding the `account_name` since it is added in the path.
    If we pass it here as well we'll get an error reading the data:
      "got multiple values for argument 'account_name'"
    """
    connection_args = config_source.securityConfig
    return {
        "tenant_id": connection_args.tenantId,
        "client_id": connection_args.clientId,
        "client_secret": connection_args.clientSecret.get_secret_value(),
    }


class ADLSReader(Reader):
    """ADLS Reader
    Class to read from buckets with prefix as paths
    """

    def __init__(self, client):
        self.client = client

    def read(
        self, path: str, *, bucket_name: str = None, verbose: bool = True, **__
    ) -> bytes:
        try:
            container_client = self.client.get_container_client(bucket_name)
            return container_client.get_blob_client(path).download_blob().readall()
        except Exception as err:
            if verbose:
                logger.debug(traceback.format_exc())
            raise ReadException(f"Error fetching file [{path}] from ADLS: {err}")

    def _get_tree(self) -> List[str]:
        """
        We are not implementing this yet. This should
        only be needed for now for the Datalake where we don't need
        to traverse any directories.
        """
        raise NotImplementedError("Not implemented")

    def download(
        self,
        path: str,
        local_file_path: str,
        *,
        bucket_name: str = None,
        verbose: bool = True,
        **__,
    ):
        try:
            container_client = self.client.get_container_client(bucket_name)
            with open(local_file_path, "wb") as download_file:
                download_file.write(
                    container_client.get_blob_client(path).download_blob().readall()
                )
        except Exception as err:
            if verbose:
                logger.debug(traceback.format_exc())
            raise ReadException(f"Error downloading file [{path}] from ADLS: {err}")
