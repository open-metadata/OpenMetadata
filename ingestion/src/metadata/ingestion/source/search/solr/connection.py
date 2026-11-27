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
Source connection handler for Solr.
"""

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.search.solrConnection import (
    SolrConnection as SolrConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.search.solr.client import SolrClient
from metadata.utils.constants import THREE_MIN
from metadata.utils.ssl_registry import get_verify_ssl_fn


class SolrConnection(BaseConnection[SolrConnectionConfig, SolrClient]):
    """Lifecycle owner for the Solr HTTP client."""

    def _get_client(self) -> SolrClient:
        connection = self.service_connection
        verify_ssl = get_verify_ssl_fn(connection.verifySSL)(connection.sslConfig)
        return SolrClient(
            base_url=str(connection.hostPort),
            username=connection.username,
            password=(connection.password.get_secret_value() if connection.password else None),
            verify_ssl=verify_ssl,
            timeout=connection.connectionTimeoutSecs or THREE_MIN,
        )

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part of a metadata
        workflow or during an Automation Workflow.
        """
        client = self.client
        service_connection = self.service_connection

        test_fn = {
            "CheckAccess": client.get_system_info,
            "GetSearchIndexes": client.list_collections,
        }

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
