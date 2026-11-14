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

"""Metadata-source SAS connection wrapper."""

from metadata.generated.schema.entity.services.connections.metadata.sasConnection import (
    SASConnection as SASConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.metadata.sas.client import SASClient
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SASConnection(BaseConnection[SASConnectionConfig, SASClient]):
    """Compatibility wrapper for the SAS metadata source entry point."""

    def _get_client(self) -> SASClient:
        connection = self.service_connection
        return SASClient(connection)

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow=None,
        timeout_seconds: int | None = THREE_MIN,
    ):
        client = self.client
        service_connection = self.service_connection
        test_fn = {"CheckAccess": client.check_connection}
        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )