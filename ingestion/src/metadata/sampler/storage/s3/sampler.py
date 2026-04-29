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
S3 sampler implementation
"""
import secrets
from typing import Optional

from metadata.generated.schema.entity.services.connections.storage.s3Connection import (
    S3Connection,
)
from metadata.ingestion.source.storage.s3.connection import get_connection
from metadata.readers.models import S3Config
from metadata.sampler.storage.sampler import StorageSampler
from metadata.utils.logger import sampler_logger

logger = sampler_logger()

S3_CLIENT_ROOT_RESPONSE = "Contents"


class S3Sampler(StorageSampler):
    """
    Sampler for S3 storage service
    """

    service_connection_config: S3Connection

    def get_client(self):
        """Get S3 client from connection"""
        s3_client = get_connection(self.service_connection_config)
        return s3_client.s3_client

    def _get_bucket_name(self) -> str:
        """Extract bucket name from container FQN"""
        fqn_parts = self.entity.fullyQualifiedName.root.split(".")
        if len(fqn_parts) >= 2:
            return fqn_parts[1]
        return fqn_parts[0]

    def _get_config_source(self):
        """Get S3 config source"""
        return S3Config(securityConfig=self.service_connection_config.awsConfig)

    def _is_valid_sample_file(self, key: str) -> bool:
        """
        Check if an S3 key is a valid candidate for sampling.

        Filters out:
        - Directories (keys ending with /)
        - Delta Lake metadata (_delta_log/)
        - Success markers (_SUCCESS)
        """
        if not key:
            return False
        return (
            not key.endswith("/")
            and "/_delta_log/" not in key
            and not key.endswith("/_SUCCESS")
        )

    def _filter_candidate_keys(self, response: dict) -> list[str]:
        """Extract and filter candidate keys from S3 list_objects_v2 response"""
        return [
            entry["Key"]
            for entry in response.get(S3_CLIENT_ROOT_RESPONSE, [])
            if entry
            and entry.get("Key")
            and self._is_valid_sample_file(entry.get("Key"))
        ]

    def _get_sample_file_path(self) -> Optional[str]:
        """Get a sample file path from the container"""
        bucket_name = self._get_bucket_name()
        prefix = self.entity.prefix

        if not prefix:
            logger.warning(
                f"Container {self.entity.fullyQualifiedName.root} has no prefix"
            )
            return None

        prefix_without_leading_slash = prefix.lstrip("/")

        try:
            response = self.client.list_objects_v2(
                Bucket=bucket_name, Prefix=prefix_without_leading_slash
            )

            if S3_CLIENT_ROOT_RESPONSE not in response:
                logger.warning(
                    f"No objects found in S3 bucket {bucket_name} with prefix {prefix_without_leading_slash}"
                )
                return None

            candidate_keys = self._filter_candidate_keys(response)

            if candidate_keys:
                result_key = secrets.choice(candidate_keys)
                logger.info(
                    f"File {result_key} picked for sampling from container {self.entity.fullyQualifiedName.root}"
                )
                return result_key

            logger.warning(
                f"No valid files found in S3 bucket {bucket_name} with prefix {prefix_without_leading_slash}"
            )
            return None

        except Exception as exc:
            logger.warning(
                f"Error listing objects in S3 bucket {bucket_name} with prefix {prefix_without_leading_slash}: {exc}"
            )
            return None
