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
GCS sampler implementation
"""
import secrets
from typing import Optional, Tuple

from google.cloud.exceptions import NotFound

from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.entity.services.connections.storage.gcsConnection import (
    GcsConnection,
)
from metadata.ingestion.source.storage.gcs.connection import get_connection
from metadata.sampler.storage.sampler import StorageSampler
from metadata.utils.logger import sampler_logger

logger = sampler_logger()


class GCSSampler(StorageSampler):
    """
    Sampler for GCS storage service
    """

    service_connection_config: GcsConnection

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._project_id = None
        self._gcs_client = None

    def get_client(self):
        """Get GCS client from connection"""
        gcs_clients = get_connection(self.service_connection_config)
        return gcs_clients.storage_client

    def _get_bucket_and_project(self) -> Tuple[str, Optional[str]]:
        """
        Extract bucket name from container FQN and find the project ID
        Returns: (bucket_name, project_id)
        """
        fqn_parts = self.entity.fullyQualifiedName.root.split(".")
        bucket_name = fqn_parts[1] if len(fqn_parts) >= 2 else fqn_parts[0]

        if self._project_id:
            return bucket_name, self._project_id

        for project_id, client in self.client.clients.items():
            try:
                client.get_bucket(bucket_name)
                self._project_id = project_id
                self._gcs_client = client
                return bucket_name, project_id
            except NotFound:
                continue

        logger.warning(
            f"Bucket {bucket_name} not found in any GCS project for container {self.entity.fullyQualifiedName.root}"
        )
        return bucket_name, None

    def _get_bucket_name(self) -> str:
        """Extract bucket name from container FQN"""
        bucket_name, _ = self._get_bucket_and_project()
        return bucket_name

    def _get_config_source(self):
        """Get GCS config source"""
        return GCSConfig(securityConfig=self.service_connection_config.credentials)

    def _filter_candidate_blobs(self, blobs, file_format: str) -> list[str]:
        """
        Extract and filter candidate blob names from GCS list_blobs response.

        Filters blobs that match the specified file format.
        """
        return [entry.name for entry in blobs if entry.name.endswith(file_format)]

    def _get_sample_file_path(self) -> Optional[str]:
        """Get a sample file path from the container"""
        bucket_name, project_id = self._get_bucket_and_project()

        if not project_id:
            logger.warning(
                f"Could not find project for bucket {bucket_name} in container {self.entity.fullyQualifiedName.root}"
            )
            return None

        prefix = self.entity.prefix
        if not prefix:
            logger.warning(
                f"Container {self.entity.fullyQualifiedName.root} has no prefix"
            )
            return None

        prefix_without_leading_slash = prefix.lstrip("/")
        file_format = self._get_file_format()
        if not file_format:
            return None

        try:
            gcs_client = self._gcs_client or self.client.clients[project_id]
            response = gcs_client.list_blobs(
                bucket_name, prefix=prefix_without_leading_slash, max_results=1000
            )

            candidate_keys = self._filter_candidate_blobs(response, file_format.value)

            if candidate_keys:
                result_key = secrets.choice(candidate_keys)
                logger.info(
                    f"File {result_key} picked for sampling from container {self.entity.fullyQualifiedName.root}"
                )
                return result_key

            logger.warning(
                f"No valid files found in GCS bucket {bucket_name} with prefix {prefix_without_leading_slash}"
            )
            return None

        except Exception as exc:
            logger.warning(
                f"Error listing blobs in GCS bucket {bucket_name} with prefix {prefix_without_leading_slash}: {exc}"
            )
            return None
