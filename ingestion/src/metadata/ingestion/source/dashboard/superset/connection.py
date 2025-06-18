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
from functools import partial
from typing import Optional, Union

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.dashboard.supersetConnection import (
    SupersetConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection as MysqlConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.generated.schema.entity.utils.supersetApiConnection import (
    SupersetApiConnection,
)
from metadata.ingestion.connections.test_connections import (
    test_connection_engine_step,
    test_connection_steps,
    test_query,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.superset.client import SupersetAPIClient
from metadata.ingestion.source.dashboard.superset.queries import (
    FETCH_ALL_CHARTS_TEST,
    FETCH_DASHBOARDS_TEST,
)
from metadata.ingestion.source.database.mysql.connection import MySQLConnection
from metadata.ingestion.source.database.postgres.connection import (
    get_connection as pg_get_connection,
)
from metadata.utils.constants import THREE_MIN


def get_connection(
    connection: SupersetConnection,
) -> Union[SupersetAPIClient, Engine, None]:
    """
    Create connection
    """
    if isinstance(connection.connection, SupersetApiConnection):
        return SupersetAPIClient(connection)
    if isinstance(connection.connection, PostgresConnection):
        return pg_get_connection(connection=connection.connection)
    if isinstance(connection.connection, MysqlConnectionConfig):
        return MySQLConnection(connection.connection).get_client()
    return None


def test_connection(
    metadata: OpenMetadata,
    client: Union[SupersetAPIClient, Engine],
    service_connection: SupersetConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    test_fn = {}

    if isinstance(client, SupersetAPIClient):
        test_fn["CheckAccess"] = client.get_dashboard_count
        test_fn["GetDashboards"] = client.get_dashboard_count
        test_fn["GetCharts"] = client.get_chart_count
    else:
        test_fn["CheckAccess"] = partial(test_connection_engine_step, client)
        test_fn["GetDashboards"] = partial(test_query, client, FETCH_DASHBOARDS_TEST)
        if isinstance(service_connection.connection, MysqlConnectionConfig):
            test_fn["GetCharts"] = partial(
                test_query, client, FETCH_ALL_CHARTS_TEST.replace('"', "`")
            )
        else:
            test_fn["GetCharts"] = partial(test_query, client, FETCH_ALL_CHARTS_TEST)

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
