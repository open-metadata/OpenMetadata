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
Source connection handler
"""
from typing import Optional

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.pipeline.nifiConnection import (
    BasicAuthentication,
    NifiConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.nifi.client import NifiClient
from metadata.utils.constants import THREE_MIN


def get_connection(connection: NifiConnection) -> NifiClient:
    """
    Create connection
    """
    if isinstance(connection.nifiConfig, BasicAuthentication):
        return NifiClient(
            host_port=connection.hostPort,
            username=connection.nifiConfig.username,
            password=connection.nifiConfig.password.get_secret_value()
            if connection.nifiConfig.password
            else None,
            verify=connection.nifiConfig.verifySSL,
        )

    return NifiClient(
        host_port=connection.hostPort,
        ca_file_path=connection.nifiConfig.certificateAuthorityPath,
        client_cert_path=connection.nifiConfig.clientCertificatePath,
        client_key_path=connection.nifiConfig.clientkeyPath,
    )


def test_connection(
    metadata: OpenMetadata,
    client: NifiClient,
    service_connection: NifiConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def custom_executor():
        list(client.list_process_groups())

    test_fn = {"GetPipelines": custom_executor}

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
