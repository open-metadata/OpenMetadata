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
import urllib.request
from functools import singledispatch

from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DbtGCSConfig,
    DbtHttpConfig,
    DbtLocalConfig,
    DbtS3Config,
)
from metadata.ingestion.ometa.utils import ometa_logger
from metadata.utils.credentials import set_google_credentials

logger = ometa_logger()

DBT_CATALOG_FILE_NAME = "catalog.json"
DBT_MANIFEST_FILE_NAME = "manifest.json"


@singledispatch
def get_dbt_details(config):
    try:
        raise NotImplemented(
            f"Config not implemented for type {type(config)}: {config}"
        )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.debug(f"Error fetching dbt files from gcs {repr(exc)}")
    return None


@get_dbt_details.register
def _(config: DbtLocalConfig):
    try:
        if config.dbtCatalogFilePath is not None:
            with open(config.dbtCatalogFilePath, "r", encoding="utf-8") as catalog:
                dbt_catalog = catalog.read()
        if config.dbtManifestFilePath is not None:
            with open(config.dbtManifestFilePath, "r", encoding="utf-8") as manifest:
                dbt_manifest = manifest.read()
        return json.loads(dbt_catalog), json.loads(dbt_manifest)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.debug(f"Error fetching dbt files from local {repr(exc)}")
    return None


@get_dbt_details.register
def _(config: DbtHttpConfig):
    try:
        catalog_file = urllib.request.urlopen(config.dbtCatalogHttpPath)
        manifest_file = urllib.request.urlopen(config.dbtManifestHttpPath)
        dbt_catalog = catalog_file.read().decode()
        dbt_manifest = manifest_file.read().decode()
        return json.loads(dbt_catalog), json.loads(dbt_manifest)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.debug(f"Error fetching dbt files from file server {repr(exc)}")
    return None


@get_dbt_details.register
def _(config: DbtS3Config):
    try:
        from metadata.utils.aws_client import AWSClient

        aws_client = AWSClient(config.dbtSecurityConfig).get_resource("s3")
        buckets = aws_client.buckets.all()
        for bucket in buckets:
            for bucket_object in bucket.objects.all():
                if DBT_MANIFEST_FILE_NAME in bucket_object.key:
                    dbt_manifest = bucket_object.get()["Body"].read().decode()
                if DBT_CATALOG_FILE_NAME in bucket_object.key:
                    dbt_catalog = bucket_object.get()["Body"].read().decode()
        return json.loads(dbt_catalog), json.loads(dbt_manifest)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.debug(f"Error fetching dbt files from s3 {repr(exc)}")
    return None


@get_dbt_details.register
def _(config: DbtGCSConfig):
    try:
        from google.cloud import storage

        set_google_credentials(gcs_credentials=config.dbtSecurityConfig)
        client = storage.Client()
        for bucket in client.list_buckets():
            for blob in client.list_blobs(bucket.name):
                if DBT_MANIFEST_FILE_NAME in blob.name:
                    dbt_manifest = blob.download_as_string().decode()
                if DBT_CATALOG_FILE_NAME in blob.name:
                    dbt_catalog = blob.download_as_string().decode()
        return json.loads(dbt_catalog), json.loads(dbt_manifest)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.debug(f"Error fetching dbt files from gcs {repr(exc)}")
    return None
