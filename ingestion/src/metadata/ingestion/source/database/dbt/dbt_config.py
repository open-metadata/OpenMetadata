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
Hosts the singledispatch to get DBT files
"""
import json
import traceback
from collections import defaultdict
from functools import singledispatch
from typing import Dict, Iterable, List, Optional, Tuple

import requests

from metadata.clients.aws_client import AWSClient
from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.metadataIngestion.dbtconfig.dbtAzureConfig import (
    DbtAzureConfig,
)
from metadata.generated.schema.metadataIngestion.dbtconfig.dbtCloudConfig import (
    DbtCloudConfig,
)
from metadata.generated.schema.metadataIngestion.dbtconfig.dbtGCSConfig import (
    DbtGcsConfig,
)
from metadata.generated.schema.metadataIngestion.dbtconfig.dbtHttpConfig import (
    DbtHttpConfig,
)
from metadata.generated.schema.metadataIngestion.dbtconfig.dbtLocalConfig import (
    DbtLocalConfig,
)
from metadata.generated.schema.metadataIngestion.dbtconfig.dbtS3Config import (
    DbtS3Config,
)
from metadata.ingestion.source.database.dbt.constants import (
    DBT_CATALOG_FILE_NAME,
    DBT_MANIFEST_FILE_NAME,
    DBT_RUN_RESULTS_FILE_NAME,
)
from metadata.ingestion.source.database.dbt.models import DbtFiles
from metadata.readers.file.config_source_factory import get_reader
from metadata.utils.credentials import set_google_credentials
from metadata.utils.logger import ometa_logger
from metadata.utils.s3_utils import list_s3_objects

logger = ometa_logger()


class DBTConfigException(Exception):
    """
    Raise when encountering errors while extracting dbt files
    """


@singledispatch
def get_dbt_details(config):
    """
    Single dispatch method to get the DBT files from different sources
    """

    if config:
        raise NotImplementedError(
            f"Config not implemented for type {type(config)}: {config}"
        )


@get_dbt_details.register
def _(config: DbtLocalConfig):
    try:
        blob_grouped_by_directory = defaultdict(list)

        subdirectory = (
            config.dbtManifestFilePath.rsplit("/", 1)[0]
            if "/" in config.dbtManifestFilePath
            else ""
        )
        blob_grouped_by_directory[subdirectory] = [
            config.dbtManifestFilePath,
            config.dbtCatalogFilePath,
            config.dbtRunResultsFilePath,
        ]
        yield from download_dbt_files(
            blob_grouped_by_directory=blob_grouped_by_directory,
            config=config,
            client=None,
            bucket_name=None,
        )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise DBTConfigException(f"Error fetching dbt files from local: {exc}")


@get_dbt_details.register
def _(config: DbtHttpConfig):
    try:
        logger.debug(
            f"Requesting [dbtManifestHttpPath] to: {config.dbtManifestHttpPath}"
        )
        dbt_manifest = requests.get(  # pylint: disable=missing-timeout
            config.dbtManifestHttpPath
        )
        dbt_run_results = None
        if config.dbtRunResultsHttpPath:
            logger.debug(
                f"Requesting [dbtRunResultsHttpPath] to: {config.dbtRunResultsHttpPath}"
            )
            dbt_run_results = requests.get(  # pylint: disable=missing-timeout
                config.dbtRunResultsHttpPath
            )

        dbt_catalog = None
        if config.dbtCatalogHttpPath:
            logger.debug(
                f"Requesting [dbtCatalogHttpPath] to: {config.dbtCatalogHttpPath}"
            )
            dbt_catalog = requests.get(  # pylint: disable=missing-timeout
                config.dbtCatalogHttpPath
            )
        if not dbt_manifest:
            raise DBTConfigException("Manifest file not found in file server")
        yield DbtFiles(
            dbt_catalog=dbt_catalog.json() if dbt_catalog else None,
            dbt_manifest=dbt_manifest.json(),
            dbt_run_results=[dbt_run_results.json()] if dbt_run_results else None,
        )
    except DBTConfigException as exc:
        raise exc
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise DBTConfigException(f"Error fetching dbt files from file server: {exc}")


@get_dbt_details.register
def _(config: DbtCloudConfig):  # pylint: disable=too-many-locals
    dbt_catalog = None
    dbt_manifest = None
    dbt_run_results = None
    try:
        from metadata.ingestion.ometa.client import (  # pylint: disable=import-outside-toplevel
            REST,
            ClientConfig,
        )

        expiry = 0
        auth_token = config.dbtCloudAuthToken.get_secret_value(), expiry
        client_config = ClientConfig(
            base_url=str(config.dbtCloudUrl),
            api_version="api/v2",
            auth_token=lambda: auth_token,
            auth_header="Authorization",
            allow_redirects=True,
        )
        client = REST(client_config)
        account_id = config.dbtCloudAccountId
        project_id = config.dbtCloudProjectId
        job_id = config.dbtCloudJobId
        logger.debug(
            "Requesting [dbt_catalog], [dbt_manifest] and [dbt_run_results] data"
        )
        params_data = {"order_by": "-finished_at", "limit": "1", "status": "10"}
        if project_id:
            params_data["project_id"] = project_id

        if job_id:
            params_data["job_definition_id"] = job_id

        response = client.get(f"/accounts/{account_id}/runs", data=params_data)
        if not response or not response.get("data"):
            raise DBTConfigException(
                "Unable to get the dbt job runs information.\n"
                "Please check if the auth token is correct and has the necessary scopes to fetch dbt runs"
            )
        runs_data = response.get("data")
        if runs_data:
            last_run = runs_data[0]
            run_id = last_run["id"]
            logger.info(
                f"Retrieved last successful run [{str(run_id)}]: "
                f"Finished {str(last_run['finished_at_humanized'])} (duration: {str(last_run['duration_humanized'])})"
            )
            try:
                logger.debug("Requesting [dbt_catalog]")
                dbt_catalog = client.get(
                    f"/accounts/{account_id}/runs/{run_id}/artifacts/{DBT_CATALOG_FILE_NAME}"
                )
            except Exception as exc:
                logger.debug(
                    f"dbt catalog file not found, skipping the catalog file: {exc}"
                )
                logger.debug(traceback.format_exc())
            logger.debug("Requesting [dbt_manifest]")
            dbt_manifest = client.get(
                f"/accounts/{account_id}/runs/{run_id}/artifacts/{DBT_MANIFEST_FILE_NAME}"
            )
            try:
                logger.debug("Requesting [dbt_run_results]")
                dbt_run_results = client.get(
                    f"/accounts/{account_id}/runs/{run_id}/artifacts/{DBT_RUN_RESULTS_FILE_NAME}.json"
                )
            except Exception as exc:
                logger.debug(
                    f"dbt run_results file not found, skipping dbt tests: {exc}"
                )
                logger.debug(traceback.format_exc())
        if not dbt_manifest:
            raise DBTConfigException("Manifest file not found in DBT Cloud")

        yield DbtFiles(
            dbt_catalog=dbt_catalog,
            dbt_manifest=dbt_manifest,
            dbt_run_results=[dbt_run_results] if dbt_run_results else None,
        )
    except DBTConfigException as exc:
        raise exc
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise DBTConfigException(f"Error fetching dbt files from DBT Cloud: {exc}")


def get_blobs_grouped_by_dir(blobs: List[str]) -> Dict[str, List[str]]:
    """
    Method to group the objs by the dir
    """
    blob_grouped_by_directory = defaultdict(list)
    for blob in blobs:
        subdirectory = blob.rsplit("/", 1)[0] if "/" in blob else ""
        blob_file_name = blob.rsplit("/", 1)[1] if "/" in blob else blob
        # We'll be processing multiple run_result files from a single dir
        # Grouping them together to process them in a single go
        if (
            DBT_MANIFEST_FILE_NAME == blob_file_name.lower()
            or DBT_CATALOG_FILE_NAME == blob_file_name.lower()
            or DBT_RUN_RESULTS_FILE_NAME in blob_file_name.lower()
        ):
            blob_grouped_by_directory[subdirectory].append(blob)
    return blob_grouped_by_directory


def download_dbt_files(
    blob_grouped_by_directory: Dict, config, client, bucket_name: Optional[str]
) -> Iterable[DbtFiles]:
    """
    Method to download the files from sources
    """
    for (  # pylint: disable=too-many-nested-blocks
        key,
        blobs,
    ) in blob_grouped_by_directory.items():
        dbt_catalog = None
        dbt_manifest = None
        dbt_run_results = []
        kwargs = {}
        if bucket_name:
            kwargs = {"bucket_name": bucket_name}
        try:
            for blob in blobs:
                if blob:
                    reader = get_reader(config_source=config, client=client)
                    blob_file_name = blob.rsplit("/", 1)[1] if "/" in blob else blob
                    if DBT_MANIFEST_FILE_NAME == blob_file_name.lower():
                        logger.debug(f"{DBT_MANIFEST_FILE_NAME} found in {key}")
                        dbt_manifest = reader.read(path=blob, **kwargs)
                    if DBT_CATALOG_FILE_NAME == blob_file_name.lower():
                        try:
                            logger.debug(f"{DBT_CATALOG_FILE_NAME} found in {key}")
                            dbt_catalog = reader.read(path=blob, **kwargs)
                        except Exception as exc:
                            logger.warning(
                                f"{DBT_CATALOG_FILE_NAME} not found in {key}: {exc}"
                            )
                    if DBT_RUN_RESULTS_FILE_NAME in blob_file_name.lower():
                        try:
                            logger.debug(f"{blob_file_name} found in {key}")
                            dbt_run_result = reader.read(path=blob, **kwargs)
                            if dbt_run_result:
                                dbt_run_results.append(json.loads(dbt_run_result))
                        except Exception as exc:
                            logger.warning(
                                f"{DBT_RUN_RESULTS_FILE_NAME} not found in {key}: {exc}"
                            )
            if not dbt_manifest:
                raise DBTConfigException(f"Manifest file not found at: {key}")
            yield DbtFiles(
                dbt_catalog=json.loads(dbt_catalog) if dbt_catalog else None,
                dbt_manifest=json.loads(dbt_manifest),
                dbt_run_results=dbt_run_results if dbt_run_results else None,
            )
        except DBTConfigException as exc:
            logger.warning(exc)


@get_dbt_details.register
def _(config: DbtS3Config):
    try:
        bucket_name, prefix = get_dbt_prefix_config(config)

        client = AWSClient(config.dbtSecurityConfig).get_client(service_name="s3")

        if not bucket_name:
            buckets = client.list_buckets()["Buckets"]
        else:
            buckets = [{"Name": bucket_name}]
        for bucket in buckets:
            kwargs = {"Bucket": bucket["Name"]}
            if prefix:
                kwargs["Prefix"] = prefix if prefix.endswith("/") else f"{prefix}/"

            yield from download_dbt_files(
                blob_grouped_by_directory=get_blobs_grouped_by_dir(
                    blobs=[key["Key"] for key in list_s3_objects(client, **kwargs)]
                ),
                config=config,
                client=client,
                bucket_name=bucket["Name"],
            )

    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise DBTConfigException(f"Error fetching dbt files from s3: {exc}")


@get_dbt_details.register
def _(config: DbtGcsConfig):
    try:
        bucket_name, prefix = get_dbt_prefix_config(config)
        from google.cloud import storage  # pylint: disable=import-outside-toplevel

        set_google_credentials(gcp_credentials=config.dbtSecurityConfig)

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

            yield from download_dbt_files(
                blob_grouped_by_directory=get_blobs_grouped_by_dir(
                    blobs=[blob.name for blob in obj_list]
                ),
                config=config,
                client=client,
                bucket_name=bucket.name,
            )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise DBTConfigException(f"Error fetching dbt files from gcs: {exc}")


@get_dbt_details.register
def _(config: DbtAzureConfig):
    try:
        bucket_name, prefix = get_dbt_prefix_config(config)

        client = AzureClient(config.dbtSecurityConfig).create_blob_client()

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

            yield from download_dbt_files(
                blob_grouped_by_directory=get_blobs_grouped_by_dir(
                    blobs=[blob.name for blob in blob_list]
                ),
                config=config,
                client=client,
                bucket_name=container_client.container_name,
            )

    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise DBTConfigException(f"Error fetching dbt files from Azure: {exc}")


def get_dbt_prefix_config(config) -> Tuple[Optional[str], Optional[str]]:
    """
    Return (bucket, prefix) tuple
    """
    if config.dbtPrefixConfig:
        return (
            config.dbtPrefixConfig.dbtBucketName,
            config.dbtPrefixConfig.dbtObjectPrefix,
        )
    return None, None
