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

from metadata.generated.schema.metadataIngestion.storage.manifestMetadataConfig import (
    ManifestMetadataConfig,
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
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

STORAGE_METADATA_MANIFEST_FILE_NAME = "storage_metadata_manifest.json"


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
    except StorageMetadataConfigException as exc:
        raise exc
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise StorageMetadataConfigException(
            f"Error fetching manifest file from file server: {exc}"
        )


@get_manifest.register
def _(config: StorageMetadataS3Config) -> ManifestMetadataConfig:
    manifest = None
    try:
        bucket_name, prefix = (
            config.prefixConfig.bucketName,
            config.prefixConfig.objectPrefix,
        )
        from metadata.clients.aws_client import (  # pylint: disable=import-outside-toplevel
            AWSClient,
        )

        aws_client = AWSClient(config.securityConfig).get_resource("s3")
        bucket = aws_client.Bucket(bucket_name)
        obj_list = bucket.objects.filter(Prefix=prefix)
        for bucket_object in obj_list:
            if STORAGE_METADATA_MANIFEST_FILE_NAME in bucket_object.key:
                logger.debug(f"{STORAGE_METADATA_MANIFEST_FILE_NAME} found")
                manifest = bucket_object.get()["Body"].read().decode()
                break
        if not manifest:
            raise StorageMetadataConfigException("Manifest file not found in s3")
        return ManifestMetadataConfig.parse_obj(json.loads(manifest))
    except StorageMetadataConfigException as exc:
        raise exc
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise StorageMetadataConfigException(
            f"Error fetching manifest file from s3: {exc}"
        )
