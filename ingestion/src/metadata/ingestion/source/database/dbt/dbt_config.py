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
Hosts the singledispatch to get DBT files
"""
import json
import os
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
    DBT_SOURCES_FILE_NAME,
)
from metadata.ingestion.source.database.dbt.models import DbtFiles
from metadata.readers.file.config_source_factory import get_reader
from metadata.utils.credentials import set_google_credentials
from metadata.utils.helpers import clean_uri
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
        manifest_path = config.dbtManifestFilePath
        if not os.path.exists(manifest_path):
            raise DBTConfigException(
                f"Manifest file not found at '{manifest_path}'. "
                "Please verify the file path is correct."
            )
        if not os.access(manifest_path, os.R_OK):
            raise DBTConfigException(
                f"Cannot read manifest file at '{manifest_path}'. "
                "Please check file permissions."
            )

        blob_grouped_by_directory = defaultdict(list)

        subdirectory = os.path.dirname(manifest_path)
        blob_grouped_by_directory[subdirectory] = [
            manifest_path,
            config.dbtCatalogFilePath,
            config.dbtRunResultsFilePath,
            config.dbtSourcesFilePath,
        ]
        yield from download_dbt_files(
            blob_grouped_by_directory=blob_grouped_by_directory,
            config=config,
            client=None,
            bucket_name=None,
        )
    except DBTConfigException:
        raise
    except json.JSONDecodeError as exc:
        raise DBTConfigException(
            f"Manifest file at '{config.dbtManifestFilePath}' is not valid JSON. "
            "Please verify the file contents."
        ) from exc
    except PermissionError as exc:
        raise DBTConfigException(
            f"Permission denied accessing '{config.dbtManifestFilePath}'. "
            "Please check file permissions."
        ) from exc
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise DBTConfigException(f"Error fetching dbt files from local: {exc}")


@get_dbt_details.register
def _(config: DbtHttpConfig):
    try:
        manifest_url = config.dbtManifestHttpPath
        logger.debug(f"Requesting [dbtManifestHttpPath] to: {manifest_url}")

        try:
            dbt_manifest = requests.get(manifest_url, timeout=30)
            dbt_manifest.raise_for_status()
        except requests.exceptions.Timeout as exc:
            raise DBTConfigException(
                f"Connection timeout while fetching manifest from '{manifest_url}'. "
                "Please verify the URL is accessible."
            ) from exc
        except requests.exceptions.ConnectionError as exc:
            raise DBTConfigException(
                f"Unable to connect to '{manifest_url}'. "
                "Please verify the URL is correct and accessible."
            ) from exc
        except requests.exceptions.HTTPError as exc:
            if exc.response.status_code == 404:
                raise DBTConfigException(
                    f"Manifest file not found at '{manifest_url}'. "
                    "Please verify the URL is correct."
                ) from exc
            if exc.response.status_code in (401, 403):
                raise DBTConfigException(
                    f"Access denied to '{manifest_url}'. "
                    "Please check authentication credentials if required."
                ) from exc
            raise DBTConfigException(
                f"HTTP error {exc.response.status_code} fetching manifest from '{manifest_url}'."
            ) from exc

        try:
            manifest_json = dbt_manifest.json()
        except json.JSONDecodeError as exc:
            raise DBTConfigException(
                f"Response from '{manifest_url}' is not valid JSON. "
                "Please verify the URL returns a valid dbt manifest."
            ) from exc

        dbt_run_results = None
        if config.dbtRunResultsHttpPath:
            logger.debug(
                f"Requesting [dbtRunResultsHttpPath] to: {config.dbtRunResultsHttpPath}"
            )
            try:
                run_results_resp = requests.get(
                    config.dbtRunResultsHttpPath, timeout=30
                )
                run_results_resp.raise_for_status()
                dbt_run_results = run_results_resp.json()
            except Exception as exc:
                logger.warning(
                    f"Could not fetch run_results from '{config.dbtRunResultsHttpPath}': {exc}"
                )

        dbt_catalog = None
        if config.dbtCatalogHttpPath:
            logger.debug(
                f"Requesting [dbtCatalogHttpPath] to: {config.dbtCatalogHttpPath}"
            )
            try:
                catalog_resp = requests.get(config.dbtCatalogHttpPath, timeout=30)
                catalog_resp.raise_for_status()
                dbt_catalog = catalog_resp.json()
            except Exception as exc:
                logger.warning(
                    f"Could not fetch catalog from '{config.dbtCatalogHttpPath}': {exc}"
                )

        dbt_sources = None
        if config.dbtSourcesHttpPath:
            logger.debug(
                f"Requesting [dbtSourcesHttpPath] to: {config.dbtSourcesHttpPath}"
            )
            try:
                sources_resp = requests.get(config.dbtSourcesHttpPath, timeout=30)
                sources_resp.raise_for_status()
                dbt_sources = sources_resp.json()
            except Exception as exc:
                logger.warning(
                    f"Could not fetch sources from '{config.dbtSourcesHttpPath}': {exc}"
                )

        yield DbtFiles(
            dbt_catalog=dbt_catalog,
            dbt_manifest=manifest_json,
            dbt_run_results=[dbt_run_results] if dbt_run_results else None,
            dbt_sources=dbt_sources,
        )
    except DBTConfigException:
        raise
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
            base_url=clean_uri(config.dbtCloudUrl),
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
        params_data = {
            "order_by": "-finished_at",
            "limit": "1",
            "status__in": "[10,20]",
        }
        if project_id:
            params_data["project_id"] = project_id

        if job_id:
            params_data["job_definition_id"] = job_id

        try:
            response = client.get(f"/accounts/{account_id}/runs", data=params_data)
        except Exception as exc:
            error_msg = str(exc).lower()
            if "401" in error_msg or "unauthorized" in error_msg:
                raise DBTConfigException(
                    "Invalid dbt Cloud auth token. Please verify your token has "
                    "'Account Viewer' permissions and is not expired."
                ) from exc
            if "404" in error_msg:
                raise DBTConfigException(
                    f"dbt Cloud account ID '{account_id}' not found. "
                    "Please verify the account ID is correct."
                ) from exc
            if "connection" in error_msg or "timeout" in error_msg:
                raise DBTConfigException(
                    f"Unable to connect to dbt Cloud at '{config.dbtCloudUrl}'. "
                    "Please verify the URL is correct and accessible."
                ) from exc
            raise DBTConfigException(f"Error connecting to dbt Cloud: {exc}") from exc

        if not response or not response.get("data"):
            filter_info = []
            if project_id:
                filter_info.append(f"project ID '{project_id}'")
            if job_id:
                filter_info.append(f"job ID '{job_id}'")

            if filter_info:
                raise DBTConfigException(
                    f"No completed dbt runs found for {' and '.join(filter_info)}. "
                    "Please verify these IDs exist and have completed runs."
                )
            raise DBTConfigException(
                f"No completed dbt runs found for account '{account_id}'. "
                "Please ensure at least one job has completed successfully."
            )
        runs_data = response.get("data")
        if runs_data:
            last_run = runs_data[0]
            run_id = last_run["id"]
            logger.info(
                f"Retrieved last completed run [{str(run_id)}]: "
                f"Finished {str(last_run['finished_at_humanized'])} (duration: {str(last_run['duration_humanized'])})"
            )
            try:
                logger.debug("Requesting [dbt_catalog]")
                dbt_catalog = client.get(
                    f"/accounts/{account_id}/runs/{run_id}/artifacts/{DBT_CATALOG_FILE_NAME}"
                )
            except Exception as exc:
                logger.warning(
                    f"dbt catalog file not found for run {run_id}, skipping catalog: {exc}"
                )
                logger.debug(traceback.format_exc())
            try:
                logger.debug("Requesting [dbt_manifest]")
                dbt_manifest = client.get(
                    f"/accounts/{account_id}/runs/{run_id}/artifacts/{DBT_MANIFEST_FILE_NAME}"
                )
            except Exception as exc:
                raise DBTConfigException(
                    f"Manifest artifact not found for run {run_id}. "
                    "Please ensure the dbt job generates artifacts."
                ) from exc
            try:
                logger.debug("Requesting [dbt_run_results]")
                dbt_run_results = client.get(
                    f"/accounts/{account_id}/runs/{run_id}/artifacts/{DBT_RUN_RESULTS_FILE_NAME}.json"
                )
            except Exception as exc:
                logger.warning(
                    f"dbt run_results file not found for run {run_id}, skipping dbt tests: {exc}"
                )
                logger.debug(traceback.format_exc())
        if not dbt_manifest:
            raise DBTConfigException(
                "Manifest file not found in dbt Cloud. "
                "Please ensure your dbt job generates artifacts."
            )

        yield DbtFiles(
            dbt_catalog=dbt_catalog,
            dbt_manifest=dbt_manifest,
            dbt_run_results=[dbt_run_results] if dbt_run_results else None,
        )
    except DBTConfigException as exc:
        raise exc
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise DBTConfigException(f"Error fetching dbt files from dbt Cloud: {exc}")


def get_blobs_grouped_by_dir(blobs: List[str]) -> Dict[str, List[str]]:
    """
    Method to group the objs by the dir
    """
    blob_grouped_by_directory = defaultdict(list)
    for blob in blobs:
        subdirectory = os.path.dirname(blob)
        blob_file_name = os.path.basename(blob)
        # We'll be processing multiple run_result files from a single dir
        # Grouping them together to process them in a single go
        if (
            DBT_MANIFEST_FILE_NAME == blob_file_name.lower()
            or DBT_CATALOG_FILE_NAME == blob_file_name.lower()
            or DBT_RUN_RESULTS_FILE_NAME in blob_file_name.lower()
            or DBT_SOURCES_FILE_NAME == blob_file_name.lower()
        ):
            blob_grouped_by_directory[subdirectory].append(blob)
    return blob_grouped_by_directory


# pylint: disable=too-many-locals, too-many-branches
def download_dbt_files(
    blob_grouped_by_directory: Dict, config, client, bucket_name: Optional[str]
) -> Iterable[DbtFiles]:
    """
    Method to download the files from sources
    """
    found_manifest = False
    errors = []

    for (  # pylint: disable=too-many-nested-blocks
        key,
        blobs,
    ) in blob_grouped_by_directory.items():
        dbt_catalog = None
        dbt_manifest = None
        dbt_sources = None
        dbt_run_results = []
        kwargs = {}
        if bucket_name:
            kwargs = {"bucket_name": bucket_name}
        try:
            for blob in blobs:
                if blob:
                    reader = get_reader(config_source=config, client=client)
                    blob_file_name = os.path.basename(blob)
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
                    if DBT_SOURCES_FILE_NAME == blob_file_name.lower():
                        logger.debug(f"{DBT_SOURCES_FILE_NAME} found in {key}")
                        dbt_sources = reader.read(path=blob, **kwargs)
            if not dbt_manifest:
                raise DBTConfigException(f"Manifest file not found at: {key}")
            found_manifest = True
            yield DbtFiles(
                dbt_catalog=json.loads(dbt_catalog) if dbt_catalog else None,
                dbt_manifest=json.loads(dbt_manifest),
                dbt_run_results=dbt_run_results if dbt_run_results else None,
                dbt_sources=json.loads(dbt_sources) if dbt_sources else None,
            )
        except DBTConfigException as exc:
            logger.warning(exc)
            errors.append(str(exc))

    if not found_manifest:
        error_details = "; ".join(errors) if errors else "No dbt artifacts found"
        raise DBTConfigException(f"No valid dbt manifest.json found. {error_details}")


@get_dbt_details.register
def _(config: DbtS3Config):
    try:
        bucket_name, prefix = get_dbt_prefix_config(config)

        try:
            client = AWSClient(config.dbtSecurityConfig).get_client(service_name="s3")
        except Exception as exc:
            error_msg = str(exc).lower()
            if "credentials" in error_msg or "accessdenied" in error_msg:
                raise DBTConfigException(
                    "AWS authentication failed. Please verify your AWS Access Key ID "
                    "and Secret Access Key are correct."
                ) from exc
            raise DBTConfigException(
                f"Failed to initialize AWS S3 client: {exc}"
            ) from exc

        if not bucket_name:
            try:
                buckets = client.list_buckets()["Buckets"]
            except Exception as exc:
                error_msg = str(exc).lower()
                if "accessdenied" in error_msg or "forbidden" in error_msg:
                    raise DBTConfigException(
                        "Access denied when listing S3 buckets. "
                        "Please check your IAM permissions."
                    ) from exc
                raise DBTConfigException(f"Failed to list S3 buckets: {exc}") from exc
        else:
            buckets = [{"Name": bucket_name}]

        for bucket in buckets:
            current_bucket = bucket["Name"]
            kwargs = {"Bucket": current_bucket}
            if prefix:
                kwargs["Prefix"] = prefix if prefix.endswith("/") else f"{prefix}/"

            try:
                s3_objects = list(list_s3_objects(client, **kwargs))
            except Exception as exc:
                error_msg = str(exc).lower()
                if "nosuchbucket" in error_msg:
                    raise DBTConfigException(
                        f"S3 bucket '{current_bucket}' not found. "
                        "Please verify the bucket name is correct."
                    ) from exc
                if "accessdenied" in error_msg or "forbidden" in error_msg:
                    raise DBTConfigException(
                        f"Access denied to S3 bucket '{current_bucket}'. "
                        "Please check your IAM permissions."
                    ) from exc
                raise DBTConfigException(
                    f"Failed to list objects in S3 bucket '{current_bucket}': {exc}"
                ) from exc

            blob_grouped = get_blobs_grouped_by_dir(
                blobs=[key["Key"] for key in s3_objects]
            )

            if not blob_grouped:
                prefix_path = prefix or ""
                logger.warning(
                    f"No dbt artifacts found in s3://{current_bucket}/{prefix_path}. "
                    "Please verify the path contains dbt manifest.json files."
                )

            yield from download_dbt_files(
                blob_grouped_by_directory=blob_grouped,
                config=config,
                client=client,
                bucket_name=current_bucket,
            )

    except DBTConfigException:
        raise
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise DBTConfigException(f"Error fetching dbt files from S3: {exc}")


@get_dbt_details.register
def _(config: DbtGcsConfig):
    try:
        bucket_name, prefix = get_dbt_prefix_config(config)
        # pylint: disable=import-outside-toplevel
        from google.auth.exceptions import DefaultCredentialsError, GoogleAuthError
        from google.cloud import storage

        try:
            set_google_credentials(
                gcp_credentials=config.dbtSecurityConfig, single_project=True
            )
        except (ValueError, GoogleAuthError) as cred_exc:
            logger.error(
                f"Failed to set Google Cloud credentials: {str(cred_exc)}. "
                "Please ensure your credentials are properly formatted and valid."
            )
            raise DBTConfigException(
                "Invalid Google Cloud credentials. Please check the format and validity of your credentials."
            ) from cred_exc

        try:
            client = storage.Client()
        except DefaultCredentialsError as client_exc:
            logger.error(
                f"Failed to create Google Cloud Storage client: {str(client_exc)}. "
                "Please ensure you have valid credentials configured."
            )
            raise DBTConfigException(
                "Failed to initialize Google Cloud Storage client. Please verify your credentials."
            ) from client_exc

        if not bucket_name:
            try:
                buckets = client.list_buckets()
            except Exception as bucket_exc:
                logger.error(f"Failed to list GCS buckets: {str(bucket_exc)}")
                raise DBTConfigException(
                    "Unable to list GCS buckets. Please check your permissions and credentials."
                ) from bucket_exc
        else:
            try:
                buckets = [client.get_bucket(bucket_name)]
            except Exception as bucket_exc:
                logger.error(
                    f"Failed to access GCS bucket {bucket_name}: {str(bucket_exc)}"
                )
                raise DBTConfigException(
                    f"Unable to access GCS bucket {bucket_name}."
                    "Please verify the bucket exists and you have proper permissions."
                ) from bucket_exc

        for bucket in buckets:
            try:
                obj_list = list(
                    client.list_blobs(bucket.name, prefix=prefix if prefix else None)
                )

                blob_grouped = get_blobs_grouped_by_dir(
                    blobs=[blob.name for blob in obj_list]
                )

                if not blob_grouped:
                    prefix_path = prefix or ""
                    logger.warning(
                        f"No dbt artifacts found in gs://{bucket.name}/{prefix_path}. "
                        "Please verify the path contains dbt manifest.json files."
                    )

                yield from download_dbt_files(
                    blob_grouped_by_directory=blob_grouped,
                    config=config,
                    client=client,
                    bucket_name=bucket.name,
                )
            except DBTConfigException:
                raise
            except Exception as blob_exc:
                logger.error(
                    f"Failed to process blobs in bucket {bucket.name}: {str(blob_exc)}"
                )
                logger.debug(traceback.format_exc())

    except DBTConfigException:
        raise
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise DBTConfigException(f"Error fetching dbt files from GCS: {exc}")


@get_dbt_details.register
def _(config: DbtAzureConfig):
    try:
        bucket_name, prefix = get_dbt_prefix_config(config)
        # pylint: disable=import-outside-toplevel
        from azure.core.exceptions import AzureError, ClientAuthenticationError

        try:
            client = AzureClient(config.dbtSecurityConfig).create_blob_client()
        except ClientAuthenticationError as auth_exc:
            logger.error(
                f"Failed to authenticate with Azure: {str(auth_exc)}. "
                "Please check your Azure credentials and permissions."
            )
            raise DBTConfigException(
                "Azure authentication failed. Please verify your credentials and permissions."
            ) from auth_exc
        except AzureError as azure_exc:
            logger.error(f"Failed to create Azure client: {str(azure_exc)}")
            raise DBTConfigException(
                "Failed to initialize Azure client. Please check your Azure configuration."
            ) from azure_exc

        if not bucket_name:
            try:
                container_dicts = list(client.list_containers())
            except Exception as exc:
                error_msg = str(exc).lower()
                if "authorization" in error_msg or "forbidden" in error_msg:
                    raise DBTConfigException(
                        "Access denied when listing Azure containers. "
                        "Please check your permissions."
                    ) from exc
                raise DBTConfigException(
                    f"Failed to list Azure containers: {exc}"
                ) from exc
            containers = [
                client.get_container_client(container["name"])
                for container in container_dicts
            ]
        else:
            try:
                container_client = client.get_container_client(bucket_name)
                # Verify container exists by attempting to get properties
                container_client.get_container_properties()
            except Exception as exc:
                error_msg = str(exc).lower()
                if "not found" in error_msg or "does not exist" in error_msg:
                    raise DBTConfigException(
                        f"Azure container '{bucket_name}' not found. "
                        "Please verify the container name is correct."
                    ) from exc
                if "authorization" in error_msg or "forbidden" in error_msg:
                    raise DBTConfigException(
                        f"Access denied to Azure container '{bucket_name}'. "
                        "Please check your permissions."
                    ) from exc
                raise DBTConfigException(
                    f"Failed to access Azure container '{bucket_name}': {exc}"
                ) from exc
            containers = [container_client]

        for container_client in containers:
            container_name = container_client.container_name
            try:
                if prefix:
                    blob_list = list(
                        container_client.list_blobs(name_starts_with=prefix)
                    )
                else:
                    blob_list = list(container_client.list_blobs())

                blob_grouped = get_blobs_grouped_by_dir(
                    blobs=[blob.name for blob in blob_list]
                )

                if not blob_grouped:
                    prefix_path = prefix or ""
                    logger.warning(
                        f"No dbt artifacts found in Azure container '{container_name}/{prefix_path}'. "
                        "Please verify the path contains dbt manifest.json files."
                    )

                yield from download_dbt_files(
                    blob_grouped_by_directory=blob_grouped,
                    config=config,
                    client=client,
                    bucket_name=container_name,
                )
            except DBTConfigException:
                raise
            except Exception as exc:
                logger.error(
                    f"Failed to process blobs in container {container_name}: {str(exc)}"
                )
                logger.debug(traceback.format_exc())

    except DBTConfigException:
        raise
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
