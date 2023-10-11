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
Hosts the singledispatch to get Storage Metadata manifest file
"""
import json
import traceback
from functools import singledispatch

import requests

from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.generated.schema.metadataIngestion.storage.manifestMetadataConfig import (
    ManifestMetadataConfig,
)
from metadata.generated.schema.metadataIngestion.storage.storageMetadataADLSConfig import (
    StorageMetadataAdlsConfig,
)
from metadata.generated.schema.metadataIngestion.storage.storageMetadataHttpConfig import (
    StorageMetadataHttpConfig,
)
from metadata.generated.schema.metadataIngestion.storage.storageMetadataLocalConfig import (
    StorageMetadataLocalConfig,
)
from metadata.generated.schema.metadataIngestion.storage.storageMetadataS3Config import (
    StorageMetadataS3Config,
)
from metadata.readers.file.config_source_factory import get_reader
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

STORAGE_METADATA_MANIFEST_FILE_NAME = "openmetadata_storage_manifest.json"


class StorageMetadataConfigException(Exception):
    """
    Raise when encountering errors while extracting storage metadata manifest file
    """


@singledispatch
def get_manifest(config):
    """
    Single dispatch method to get the Storage Metadata manifest file from different sources
    """

    if config:
        raise NotImplementedError(
            f"Config not implemented for type {type(config)}: {config}"
        )


@get_manifest.register
def _(config: StorageMetadataLocalConfig) -> ManifestMetadataConfig:
    try:
        if config.manifestFilePath is not None:
            logger.debug(f"Reading [manifestFilePath] from: {config.manifestFilePath}")
            with open(config.manifestFilePath, "r", encoding="utf-8") as manifest:
                metadata_manifest = manifest.read()
        return ManifestMetadataConfig.parse_obj(json.loads(metadata_manifest))
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise StorageMetadataConfigException(
            f"Error fetching manifest file from local: {exc}"
        )


@get_manifest.register
def _(config: StorageMetadataHttpConfig) -> ManifestMetadataConfig:
    try:
        logger.debug(f"Requesting [dbtManifestHttpPath] to: {config.manifestHttpPath}")
        http_manifest = requests.get(  # pylint: disable=missing-timeout
            config.manifestHttpPath
        )
        if not http_manifest:
            raise StorageMetadataConfigException(
                "Manifest file not found in file server"
            )
        return ManifestMetadataConfig.parse_obj(http_manifest.json())
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise StorageMetadataConfigException(
            f"Error fetching manifest file from file server: {exc}"
        )


@get_manifest.register
def _(config: StorageMetadataS3Config) -> ManifestMetadataConfig:
    try:
        bucket_name, prefix = (
            config.prefixConfig.containerName,
            config.prefixConfig.objectPrefix,
        )

        path = (
            f"{prefix}/{STORAGE_METADATA_MANIFEST_FILE_NAME}"
            if prefix
            else STORAGE_METADATA_MANIFEST_FILE_NAME
        )

        from metadata.clients.aws_client import (  # pylint: disable=import-outside-toplevel
            AWSClient,
        )

        aws_client = AWSClient(config.securityConfig).get_client(service_name="s3")
        reader = get_reader(
            config_source=S3Config(securityConfig=config.securityConfig),
            client=aws_client,
        )

        manifest = reader.read(path=path, bucket_name=bucket_name)
        return ManifestMetadataConfig.parse_obj(json.loads(manifest))
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise StorageMetadataConfigException(
            f"Error fetching manifest file from s3: {exc}"
        )


@get_manifest.register
def _(config: StorageMetadataAdlsConfig) -> ManifestMetadataConfig:
    """Read the manifest from ADLS"""
    try:
        bucket_name, prefix = (
            config.prefixConfig.containerName,
            config.prefixConfig.objectPrefix,
        )

        path = (
            f"{prefix}/{STORAGE_METADATA_MANIFEST_FILE_NAME}"
            if prefix
            else STORAGE_METADATA_MANIFEST_FILE_NAME
        )

        from azure.identity import (  # pylint: disable=import-outside-toplevel
            ClientSecretCredential,
        )
        from azure.storage.blob import (  # pylint: disable=import-outside-toplevel
            BlobServiceClient,
        )

        blob_client = BlobServiceClient(
            account_url=f"https://{config.securityConfig.accountName}.blob.core.windows.net/",
            credential=ClientSecretCredential(
                config.securityConfig.tenantId,
                config.securityConfig.clientId,
                config.securityConfig.clientSecret.get_secret_value(),
            ),
        )

        reader = get_reader(
            config_source=AzureConfig(securityConfig=config.securityConfig),
            client=blob_client,
        )

        manifest = reader.read(path=path, bucket_name=bucket_name)
        return ManifestMetadataConfig.parse_obj(json.loads(manifest))
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise StorageMetadataConfigException(
            f"Error fetching manifest file from s3: {exc}"
        )
