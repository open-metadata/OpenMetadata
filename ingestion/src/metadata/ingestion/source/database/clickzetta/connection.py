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
ClickZetta source connection handler.
"""

from typing import Optional

from sqlalchemy.engine import URL, Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.clickzettaConnection import (
    ClickzettaConnection as ClickzettaConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    test_connection_db_schema_sources,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.clickzetta.url import (
    build_clickzetta_url,
)
from metadata.utils.constants import THREE_MIN


def get_clickzetta_connection_url(
    connection: ClickzettaConnectionConfig,
) -> URL:
    password = connection.authType.password
    if password is None:
        raise ValueError("ClickZetta password is required")

    return build_clickzetta_url(
        host_port=connection.hostPort,
        username=connection.username,
        password=password.get_secret_value(),
        workspace=connection.databaseName,
        virtual_cluster=connection.virtualCluster,
        database_schema=connection.databaseSchema,
        protocol=connection.protocol.value if connection.protocol else "https",
        connection_options=get_connection_options_dict(connection),
    )


class ClickzettaConnection(BaseConnection[ClickzettaConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        connection = self.service_connection
        engine = create_generic_db_connection(
            connection=connection,
            get_connection_url_fn=get_clickzetta_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )
        self._on_close(engine.dispose)
        return engine

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
