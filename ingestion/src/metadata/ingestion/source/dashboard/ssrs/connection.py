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
from metadata.generated.schema.entity.services.connections.dashboard.ssrsConnection import (
    SsrsConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.ssrs.client import SsrsClient
from metadata.utils.constants import THREE_MIN
from metadata.utils.ssl_registry import get_verify_ssl_fn


def get_connection(connection: SsrsConnection) -> SsrsClient:
    verify_ssl = None
    if connection.verifySSL:
        verify_ssl_fn = get_verify_ssl_fn(connection.verifySSL)
        verify_ssl = verify_ssl_fn(connection.sslConfig)
    return SsrsClient(connection, verify_ssl=verify_ssl)


def test_connection(
    metadata: OpenMetadata,
    client: SsrsClient,
    service_connection: SsrsConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    test_fn = {
        "CheckAccess": client.test_access,
        "GetDashboards": client.get_reports,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
