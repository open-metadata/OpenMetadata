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
Hosts the singledispatch to get Storage Metadata manifest file
"""
import json
import traceback
from functools import singledispatch

import requests

from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
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
from metadata.generated.schema.metadataIngestion.storage.storageMetadataGCSConfig import (
    StorageMetadataGcsConfig,
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
from metadata.utils.credentials import set_google_credentials
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
            return ManifestMetadataConfig.model_validate(json.loads(metadata_manifest))
        raise StorageMetadataConfigException("Manifest file path not provided")
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
        return ManifestMetadataConfig.model_validate(http_manifest.json())
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
        return ManifestMetadataConfig.model_validate(json.loads(manifest))
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

        blob_client = AzureClient(config.securityConfig).create_blob_client()

        reader = get_reader(
            config_source=AzureConfig(securityConfig=config.securityConfig),
            client=blob_client,
        )

        manifest = reader.read(path=path, bucket_name=bucket_name)
        return ManifestMetadataConfig.model_validate(json.loads(manifest))
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise StorageMetadataConfigException(
            f"Error fetching manifest file from adls: {exc}"
        )


@get_manifest.register
def _(config: StorageMetadataGcsConfig) -> ManifestMetadataConfig:
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

        from google.cloud.storage import (  # pylint: disable=import-outside-toplevel
            Client,
        )

        set_google_credentials(gcp_credentials=config.securityConfig)
        gcs_client = Client()
        reader = get_reader(
            config_source=GCSConfig(securityConfig=config.securityConfig),
            client=gcs_client,
        )

        manifest = reader.read(path=path, bucket_name=bucket_name)
        return ManifestMetadataConfig.model_validate(json.loads(manifest))
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise StorageMetadataConfigException(
            f"Error fetching manifest file from gcs: {exc}"
        )
