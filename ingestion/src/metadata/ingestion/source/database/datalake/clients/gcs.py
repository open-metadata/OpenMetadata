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
Datalake GCS Client
"""
import os
from copy import deepcopy
from functools import partial
from typing import Callable, Iterable, List, Optional

from google.cloud import storage

from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
    MultipleProjectId,
    SingleProjectId,
)
from metadata.ingestion.source.database.datalake.clients.base import DatalakeBaseClient
from metadata.utils.credentials import GOOGLE_CREDENTIALS, set_google_credentials


class DatalakeGcsClient(DatalakeBaseClient):
    def __init__(
        self,
        client: storage.Client,
        temp_credentials_file_path_list: List[str],
    ):
        super().__init__(client=client)
        self._temp_credentials_file_path_list = temp_credentials_file_path_list

    @property
    def project(self):
        return self._client.project

    @staticmethod
    def get_gcs_client(config: GCSConfig) -> storage.Client:
        gcs_config = deepcopy(config)

        if hasattr(config.securityConfig, "gcpConfig") and isinstance(
            config.securityConfig.gcpConfig.projectId, MultipleProjectId
        ):
            gcs_config.securityConfig.gcpConfig.projectId = (
                SingleProjectId.model_validate(
                    gcs_config.securityConfig.gcpConfig.projectId.root[0]
                )
            )

        if not gcs_config.securityConfig:
            raise RuntimeError("GCSConfig securityConfig can't be None.")

        set_google_credentials(gcp_credentials=gcs_config.securityConfig)
        return storage.Client()

    def update_temp_credentials_file_path_list(self):
        credentials = os.environ.get(GOOGLE_CREDENTIALS)

        if credentials:
            self._temp_credentials_file_path_list.append(credentials)

    @classmethod
    def from_config(cls, config: GCSConfig) -> "DatalakeGcsClient":
        gcs_client = cls.get_gcs_client(config)

        client = cls(client=gcs_client, temp_credentials_file_path_list=[])
        client.update_temp_credentials_file_path_list()

        return client

    def get_database_names(self, service_connection):
        project_id_list = (
            service_connection.configSource.securityConfig.gcpConfig.projectId.root
        )

        if not isinstance(project_id_list, list):
            project_id_list = [project_id_list]

        for project_id in project_id_list:
            yield project_id

    def update_client_database(self, config: GCSConfig, database_name: str):
        gcs_config = deepcopy(config)

        if hasattr(gcs_config.securityConfig, "gcpConfig"):
            gcs_config.securityConfig.gcpConfig.projectId = (
                SingleProjectId.model_validate(database_name)
            )

        self._client = self.get_gcs_client(gcs_config)
        self.update_temp_credentials_file_path_list()

    def get_database_schema_names(self, bucket_name: Optional[str]) -> Iterable[str]:
        if bucket_name:
            yield bucket_name
        else:
            for bucket in self._client.list_buckets():
                yield bucket.name

    def get_table_names(self, bucket_name: str, prefix: Optional[str]) -> Iterable[str]:
        bucket = self._client.get_bucket(bucket_name)

        for key in bucket.list_blobs(prefix=prefix):
            yield key.name

    def close(self, service_connection):
        os.environ.pop("GOOGLE_CLOUD_PROJECT", "")

        if (
            isinstance(service_connection, GcpCredentialsValues)
            and GOOGLE_CREDENTIALS in os.environ
        ):
            del os.environ[GOOGLE_CREDENTIALS]
            for temp_file_path in self._temp_credentials_file_path_list:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)

    def get_test_list_buckets_fn(self, bucket_name: Optional[str]) -> Callable:

        if bucket_name:
            fn = partial(self._client.get_bucket, bucket_name)
        else:
            fn = self._client.list_buckets

        os.environ.pop("GOOGLE_CLOUD_PROJECT", "")
        if GOOGLE_CREDENTIALS in os.environ:
            os.remove(os.environ[GOOGLE_CREDENTIALS])
            del os.environ[GOOGLE_CREDENTIALS]

        return fn
