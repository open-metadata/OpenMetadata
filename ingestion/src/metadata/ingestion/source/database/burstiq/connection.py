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
Source connection handler for BurstIQ
"""

import hashlib
from collections import OrderedDict
from typing import Optional

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.burstIQConnection import (
    BurstIQConnection as BurstIQConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.burstiq.client import BurstIQClient
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

CLIENT_CACHE_SIZE = 100

_CLIENT_CACHE: "OrderedDict[str, BurstIQClient]" = OrderedDict()


class BurstIQConnection(BaseConnection[BurstIQConnectionConfig, BurstIQClient]):
    def _get_client(self) -> BurstIQClient:
        """Return a BurstIQ client, cached by a digest of the serialised config."""
        connection = self.service_connection
        key = hashlib.sha256(connection.model_dump_json().encode()).hexdigest()
        if key not in _CLIENT_CACHE:
            _CLIENT_CACHE[key] = BurstIQClient(config=connection)
            if len(_CLIENT_CACHE) > CLIENT_CACHE_SIZE:
                _CLIENT_CACHE.popitem(last=False)
        return _CLIENT_CACHE[key]

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        """Test connection to BurstIQ, as a metadata workflow or an Automation Workflow."""
        client = self.client
        service_connection = self.service_connection

        def test_authenticate():
            """Test authentication with BurstIQ credentials"""
            client.test_authenticate()

        def test_get_dictionaries():
            """Test fetching dictionaries from BurstIQ"""
            dictionaries = client.get_dictionaries(limit=1)
            if not dictionaries:
                raise ConnectionError("Failed to fetch dictionaries from BurstIQ")

        def test_get_edges():
            """Test fetching edges used for lineage"""
            edges = client.get_edges(limit=1)
            # Edges might not exist, so don't fail if empty
            logger.info(f"Found {len(edges)} edges in BurstIQ")

        test_fn = {
            "CheckAccess": test_authenticate,
            "GetDictionaries": test_get_dictionaries,
            "GetEdges": test_get_edges,
        }

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=service_connection.connectionTimeout  # pyright: ignore[reportAttributeAccessIssue]
            if hasattr(service_connection, "connectionTimeout")
            else timeout_seconds,
        )
