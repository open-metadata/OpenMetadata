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
IOMETE source connection handler.
Uses the iomete-sqlalchemy dialect which is
registered automatically via its setuptools entry point.
"""

from typing import Optional

import sqlalchemy
from sqlalchemy.engine import URL, Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.iometeConnection import (
    IometeConnection as IometeConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    test_connection_db_schema_sources,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


class IometeConnection(BaseConnection[IometeConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        """
        Return the SQLAlchemy Engine for IOMETE.
        """
        return sqlalchemy.create_engine(self.get_connection_url(self.service_connection))

    @staticmethod
    def get_connection_url(connection: IometeConnectionConfig) -> URL:
        host_port = connection.hostPort
        if ":" in host_port:
            host, port_str = host_port.rsplit(":", 1)
            if not port_str.isdigit():
                raise ValueError(f"Invalid port '{port_str}' in hostPort '{host_port}'")
            port = int(port_str)
        else:
            host = host_port
            port = 443

        query = {}
        if connection.cluster:
            query["cluster"] = connection.cluster
        if connection.dataPlane:
            query["data_plane"] = connection.dataPlane

        return URL.create(
            "iomete",
            username=connection.username,
            password=connection.password.get_secret_value() if connection.password else None,
            host=host,
            port=port,
            database=connection.catalog if connection.catalog else None,
            query=query,
        )

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        return test_connection_db_schema_sources(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
