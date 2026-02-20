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
from typing import Any, Dict, List

from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.readers.file.base import Reader, ReadException
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def return_s3_storage_options(config_source: S3Config) -> Dict[str, Any]:
    """
    Build the S3 storage options to pass to pandas/fsspec readers.
    Returns a dictionary with AWS credentials and client configuration.
    """
    connection_args = config_source.securityConfig
    storage_options = {}

    if connection_args.awsAccessKeyId:
        storage_options["key"] = connection_args.awsAccessKeyId
    if connection_args.awsSecretAccessKey:
        storage_options[
            "secret"
        ] = connection_args.awsSecretAccessKey.get_secret_value()
    if connection_args.awsSessionToken:
        storage_options["token"] = connection_args.awsSessionToken

    client_kwargs = {}
    if connection_args.endPointURL:
        client_kwargs["endpoint_url"] = str(connection_args.endPointURL)
    if connection_args.awsRegion:
        client_kwargs["region_name"] = connection_args.awsRegion

    if client_kwargs:
        storage_options["client_kwargs"] = client_kwargs

    return storage_options


class S3Reader(Reader):
    """S3 Reader
    Class to read from buckets with prefix as paths
    """

    def __init__(self, client):
        self.client = client

    def read(
        self, path: str, *, bucket_name: str = None, verbose: bool = True, **__
    ) -> bytes:
        try:
            return self.client.get_object(Bucket=bucket_name, Key=path)["Body"].read()
        except Exception as err:
            if verbose:
                logger.debug(traceback.format_exc())
            raise ReadException(f"Error fetching file [{path}] from S3: {err}")

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
            self.client.download_file(bucket_name, path, local_file_path)
        except Exception as err:
            if verbose:
                logger.debug(traceback.format_exc())
            raise ReadException(f"Error downloading file [{path}] from S3: {err}")
