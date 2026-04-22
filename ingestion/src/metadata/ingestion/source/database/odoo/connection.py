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
Source connection handler for Odoo.
"""
from typing import Optional

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.odooConnection import (
    OdooConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.odoo.client import OdooClient
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_connection(connection: OdooConnection) -> OdooClient:
    """
    Create and return an authenticated OdooClient.

    Authentication (uid retrieval) happens inside OdooClient.__init__, so
    any network or credential failure surfaces here, before ingestion begins.
    """
    return OdooClient(connection)


def test_connection(
    metadata: OpenMetadata,
    client: OdooClient,
    service_connection: OdooConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test the Odoo connection.

    Executes two ordered checks so the UI surfaces granular failure reasons:
      - CheckAccess  → verifies the uid is valid and the object endpoint responds
      - GetModels    → verifies we can actually read metadata from ir.model

    Called both during manual "Test Connection" in the UI and as part of the
    Automation Workflow pipeline.
    """
    test_fn = {
        "CheckAccess": client.test_api,
        "GetModels": client.list_models,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
