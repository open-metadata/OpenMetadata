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
    IometeConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import (
    test_connection_db_schema_sources,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


def get_connection(connection: IometeConnection) -> Engine:
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

    url = URL.create(
        "iomete",
        username=connection.username,
        password=connection.password.get_secret_value()
        if connection.password
        else None,
        host=host,
        port=port,
        database=connection.catalog if connection.catalog else None,
        query=query,
    )
    return sqlalchemy.create_engine(url)


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: IometeConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    return test_connection_db_schema_sources(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
