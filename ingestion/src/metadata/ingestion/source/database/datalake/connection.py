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
Source connection handler
"""
from typing import Optional

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection as DatalakeConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.datalake.clients.azure_blob import (
    DatalakeAzureBlobClient,
)
from metadata.ingestion.source.database.datalake.clients.base import DatalakeBaseClient
from metadata.ingestion.source.database.datalake.clients.gcs import DatalakeGcsClient
from metadata.ingestion.source.database.datalake.clients.s3 import DatalakeS3Client
from metadata.utils.constants import THREE_MIN


class DatalakeConnection(BaseConnection[DatalakeConnectionConfig, DatalakeBaseClient]):
    def _get_client(self) -> DatalakeBaseClient:
        """
        Return the appropriate Datalake client based on configSource.
        """
        connection = self.service_connection

        if isinstance(connection.configSource, S3Config):
            return DatalakeS3Client.from_config(connection.configSource)
        elif isinstance(connection.configSource, GCSConfig):
            return DatalakeGcsClient.from_config(connection.configSource)
        elif isinstance(connection.configSource, AzureConfig):
            return DatalakeAzureBlobClient.from_config(connection.configSource)
        else:
            msg = f"Config not implemented for type {type(connection.configSource)}: {connection.configSource}"
            raise NotImplementedError(msg)

    def get_connection_dict(self) -> dict:
        """
        Return the connection dictionary for this service.
        """
        raise NotImplementedError("get_connection_dict is not implemented for Datalake")

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,
        timeout_seconds: Optional[int] = THREE_MIN,
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        test_fn = {
            "ListBuckets": self.client.get_test_list_buckets_fn(
                self.service_connection.bucketName
            ),
        }

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=self.service_connection.type.value
            if self.service_connection.type
            else "Datalake",
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
