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
from dataclasses import dataclass
from functools import singledispatch
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
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.datalake.clients.azure_blob import (
    DatalakeAzureBlobClient,
)
from metadata.ingestion.source.database.datalake.clients.gcs import DatalakeGcsClient
from metadata.ingestion.source.database.datalake.clients.s3 import DatalakeS3Client
from metadata.utils.constants import THREE_MIN


# Only import specific datalake dependencies if necessary
# pylint: disable=import-outside-toplevel
@dataclass
class DatalakeClient:
    def __init__(self, client, config) -> None:
        self.client = client
        self.config = config


@singledispatch
def get_datalake_client(config):
    """
    Method to retrieve datalake client from the config
    """
    if config:
        msg = f"Config not implemented for type {type(config)}: {config}"
        raise NotImplementedError(msg)


@get_datalake_client.register
def _(config: S3Config):
    return DatalakeS3Client.from_config(config)


@get_datalake_client.register
def _(config: GCSConfig):
    return DatalakeGcsClient.from_config(config)


@get_datalake_client.register
def _(config: AzureConfig):
    return DatalakeAzureBlobClient.from_config(config)


def get_connection(connection: DatalakeConnection) -> DatalakeClient:
    """
    Create connection.

    Returns an AWS, Azure or GCS Clients.
    """
    return DatalakeClient(
        client=get_datalake_client(connection.configSource),
        config=connection,
    )


def test_connection(
    metadata: OpenMetadata,
    connection: DatalakeClient,
    service_connection: DatalakeConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    test_fn = {
        "ListBuckets": connection.client.get_test_list_buckets_fn(
            connection.config.bucketName
        ),
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
