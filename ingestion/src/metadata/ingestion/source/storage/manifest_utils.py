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
Base class for ingesting Object Storage services
"""
import json
import traceback
from typing import Optional

from metadata.generated.schema.metadataIngestion.storage.containerMetadataConfig import (
    StorageContainerConfig,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


OPENMETADATA_TEMPLATE_FILE_NAME = "openmetadata.json"
S3_CLIENT_ROOT_RESPONSE = "Contents"


def _load_metadata_file_s3(
    bucket_name: str, client
) -> Optional[StorageContainerConfig]:
    """
    Load the metadata template file from the root of the bucket, if it exists
    """
    if _is_metadata_file_present(bucket_name=bucket_name, client=client):
        try:
            logger.info(
                f"Found metadata template file at - s3://{bucket_name}/{OPENMETADATA_TEMPLATE_FILE_NAME}"
            )
            response_object = client.get_object(
                Bucket=bucket_name, Key=OPENMETADATA_TEMPLATE_FILE_NAME
            )
            content = json.load(response_object["Body"])
            metadata_config = StorageContainerConfig.parse_obj(content)
            return metadata_config
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed loading metadata file s3://{bucket_name}/{OPENMETADATA_TEMPLATE_FILE_NAME}-{exc}"
            )
    return None


def prefix_exits(bucket_name: str, prefix: str, client) -> bool:
    """
    Checks if a given prefix exists in a bucket
    """
    try:
        res = client.list_objects_v2(Bucket=bucket_name, Prefix=prefix, MaxKeys=1)
        return S3_CLIENT_ROOT_RESPONSE in res
    except Exception:
        logger.debug(traceback.format_exc())
        logger.warning(
            f"Failed when trying to check if S3 prefix {prefix} exists in bucket {bucket_name}"
        )
        return False


def _is_metadata_file_present(bucket_name: str, client):
    return prefix_exits(
        bucket_name=bucket_name, prefix=OPENMETADATA_TEMPLATE_FILE_NAME, client=client
    )
