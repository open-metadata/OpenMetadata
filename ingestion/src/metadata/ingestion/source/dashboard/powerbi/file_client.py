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
File Client for PowerBi
"""
import json
import os
import shutil
import traceback
import zipfile
from collections import defaultdict
from functools import singledispatch
from typing import Dict, List, Optional, Tuple

from metadata.clients.aws_client import AWSClient
from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.entity.services.connections.dashboard.powerbi.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.entity.services.connections.dashboard.powerbi.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.entity.services.connections.dashboard.powerbi.s3Config import (
    S3Config,
)
from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    LocalConfig,
    PowerBIConnection,
)
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.source.dashboard.powerbi.models import (
    ConnectionFile,
    DataModelSchema,
    PowerBiTable,
)
from metadata.readers.file.config_source_factory import get_reader
from metadata.readers.file.local import LocalReader
from metadata.utils.credentials import set_google_credentials
from metadata.utils.logger import utils_logger
from metadata.utils.s3_utils import list_s3_objects

logger = utils_logger()


def get_prefix_config(config) -> Tuple[Optional[str], Optional[str]]:
    """
    Return (bucket, prefix) tuple
    """
    if config.prefixConfig:
        return (
            config.prefixConfig.bucketName,
            config.prefixConfig.objectPrefix,
        )
    return None, None


def get_blobs_grouped_by_dir(blobs: List[str]) -> Dict[str, List[str]]:
    """
    Method to group the objs by the dir
    """
    blob_grouped_by_directory = defaultdict(list)
    for blob in blobs or []:
        subdirectory = blob.rsplit("/", 1)[0] if "/" in blob else ""
        blob_file_name = blob.rsplit("/", 1)[1] if "/" in blob else blob
        if blob_file_name.lower().endswith(".pbit"):
            blob_grouped_by_directory[subdirectory].append(blob)
    return blob_grouped_by_directory


def download_pbit_files(
    blob_grouped_by_directory: Dict,
    config,
    client,
    bucket_name: Optional[str],
    extract_dir: str,
):
    """
    Method to download the files from sources
    """
    for (
        key,
        blobs,
    ) in blob_grouped_by_directory.items():
        kwargs = {}
        if bucket_name:
            kwargs = {"bucket_name": bucket_name}
        try:
            for blob in blobs:
                if blob:
                    reader = get_reader(config_source=config, client=client)
                    # create the required dir before downloading
                    os.makedirs(f"{extract_dir}/{key}", exist_ok=True)
                    reader.download(
                        path=blob, local_file_path=f"{extract_dir}/{blob}", **kwargs
                    )
        except PowerBIFileConfigException as exc:
            logger.warning(exc)


def _get_datamodel_schema_list(path: str) -> Optional[List[DataModelSchema]]:
    """
    Method maps the json to datamodel schema model
    """
    reader = LocalReader(f"{path}/extracted")
    connection_files = reader.get_local_files(search_key="Connections")
    datamodel_schema_list = []
    for connection_file in connection_files:
        try:
            datamodel_schema = DataModelSchema()
            with open(connection_file, "rb") as file:
                connection_json_file = json.load(file)
                datamodel_schema.connectionFile = ConnectionFile(**connection_json_file)

            datamodel_schema_file = connection_file.replace(
                "Connections", "DataModelSchema"
            )
            with open(datamodel_schema_file, "rb") as file:
                data_model_schema_json_file = json.load(file)
                datamodel_schema.tables = [
                    PowerBiTable(**table)
                    for table in data_model_schema_json_file.get("model")["tables"]
                    or []
                ]
            if datamodel_schema.tables and datamodel_schema.connectionFile:
                datamodel_schema_list.append(datamodel_schema)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error reading and mapping the datamodel schema file for {connection_file}: {exc}"
            )
    return datamodel_schema_list


def get_datamodel_schema_files_from_pbit(path: str) -> Optional[List[DataModelSchema]]:
    """
    Method to unzip the locally saved pbit files and get the schema files
    """
    try:
        reader = LocalReader(path)
        file_paths = reader.get_local_files(search_key=".pbit")

        # Iterate over the file paths
        for file_path in file_paths:
            # Open each pbit file
            with zipfile.ZipFile(file_path, "r") as zip_ref:
                # Extract all files in the specified folder
                zip_ref.extractall(
                    f"{path}/extracted/{file_path.split('/')[-1].split('.')[0]}"
                )

        return _get_datamodel_schema_list(path)

    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Error extracting pbit files: {exc}")
    return None


@singledispatch
def get_pbit_files(config):
    """
    Single dispatch method to get the pbit files from different sources
    """

    if config:
        raise NotImplementedError(
            f"Config not implemented for type {type(config)}: {config}"
        )


@get_pbit_files.register
def _(config: S3Config):
    try:
        bucket_name, prefix = get_prefix_config(config)

        client = AWSClient(config.securityConfig).get_client(service_name="s3")

        if not bucket_name:
            buckets = client.list_buckets()["Buckets"]
        else:
            buckets = [{"Name": bucket_name}]
        for bucket in buckets:
            kwargs = {"Bucket": bucket["Name"]}
            if prefix:
                kwargs["Prefix"] = prefix if prefix.endswith("/") else f"{prefix}/"

            # Download the pbit files and store them in the local path
            download_pbit_files(
                blob_grouped_by_directory=get_blobs_grouped_by_dir(
                    blobs=[key["Key"] for key in list_s3_objects(client, **kwargs)]
                ),
                config=config,
                client=client,
                bucket_name=bucket["Name"],
                extract_dir=config.pbitFilesExtractDir,
            )
        # Extract the datamodel schema files from pbit files and return the list of datamodel schema objects
        return get_datamodel_schema_files_from_pbit(path=config.pbitFilesExtractDir)

    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise PowerBIFileConfigException(f"Error fetching .pbit files from s3: {exc}")


@get_pbit_files.register
def _(config: AzureConfig):
    try:
        bucket_name, prefix = get_prefix_config(config)

        client = AzureClient(config.securityConfig).create_blob_client()

        if not bucket_name:
            container_dicts = client.list_containers()
            containers = [
                client.get_container_client(container["name"])
                for container in container_dicts
            ]
        else:
            container_client = client.get_container_client(bucket_name)
            containers = [container_client]
        for container_client in containers:
            if prefix:
                blob_list = container_client.list_blobs(name_starts_with=prefix)
            else:
                blob_list = container_client.list_blobs()

            # Download the pbit files and store them in the local path
            download_pbit_files(
                blob_grouped_by_directory=get_blobs_grouped_by_dir(
                    blobs=[blob.name for blob in blob_list]
                ),
                config=config,
                client=client,
                bucket_name=container_client.container_name,
                extract_dir=config.pbitFilesExtractDir,
            )
        # Extract the datamodel schema files from pbit files and return the list of datamodel schema objects
        return get_datamodel_schema_files_from_pbit(path=config.pbitFilesExtractDir)

    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise PowerBIFileConfigException(
            f"Error fetching .pbit files from Azure: {exc}"
        )


@get_pbit_files.register
def _(config: GCSConfig):
    try:
        bucket_name, prefix = get_prefix_config(config)
        from google.cloud import storage  # pylint: disable=import-outside-toplevel

        set_google_credentials(gcp_credentials=config.securityConfig)

        client = storage.Client()
        if not bucket_name:
            buckets = client.list_buckets()
        else:
            buckets = [client.get_bucket(bucket_name)]
        for bucket in buckets:
            if prefix:
                obj_list = client.list_blobs(bucket.name, prefix=prefix)
            else:
                obj_list = client.list_blobs(bucket.name)

            download_pbit_files(
                blob_grouped_by_directory=get_blobs_grouped_by_dir(
                    blobs=[blob.name for blob in obj_list]
                ),
                config=config,
                client=client,
                bucket_name=bucket.name,
                extract_dir=config.pbitFilesExtractDir,
            )
        # Extract the datamodel schema files from pbit files and return the list of datamodel schema objects
        return get_datamodel_schema_files_from_pbit(path=config.pbitFilesExtractDir)

    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise PowerBIFileConfigException(f"Error fetching .pbit files from GCS: {exc}")


@get_pbit_files.register
def _(config: LocalConfig):
    try:
        return get_datamodel_schema_files_from_pbit(path=config.path)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Error getting pbit files from local: {exc}")
    return None


class PowerBIFileConfigException(Exception):
    """
    Raise when encountering errors while extracting pbit files
    """


class PowerBiFileClient:
    """
    File client for PowerBi
    """

    client: REST

    def __init__(self, config: PowerBIConnection):
        self.config = config

    def get_data_model_schema_mappings(self) -> Optional[List[DataModelSchema]]:
        """
        Get the data model schema mappings
        """
        return get_pbit_files(self.config.pbitFilesSource)

    def delete_tmp_files(self):
        """
        Method to remove the files after ingestion is completed
        """
        shutil.rmtree(self.config.pbitFilesSource.pbitFilesExtractDir)
