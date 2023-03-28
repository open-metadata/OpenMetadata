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
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.utils.supersetApiConnection import (
    SupersetAPIConnection,
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
from metadata.ingestion.source.database.mysql.connection import (
    get_connection as mysql_get_connection,
)
from metadata.ingestion.source.database.postgres.connection import (
    get_connection as pg_get_connection,
)


def get_connection(connection: SupersetConnection) -> SupersetAPIClient:
    """
    Create connection
    """
    if isinstance(connection.connection, SupersetAPIConnection):
        return SupersetAPIClient(connection)
    if isinstance(connection.connection, PostgresConnection):
        return pg_get_connection(connection=connection.connection)
    if isinstance(connection.connection, MysqlConnection):
        return mysql_get_connection(connection=connection.connection)
    return None


def test_connection(
    metadata: OpenMetadata,
    client: Union[SupersetAPIClient, Engine],
    service_connection: SupersetConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    test_fn = {}

    if isinstance(client, SupersetAPIClient):
        test_fn["CheckAccess"] = client.fetch_total_dashboards
        test_fn["GetDashboards"] = client.fetch_total_dashboards
        test_fn["GetCharts"] = client.fetch_total_charts
    else:
        test_fn["CheckAccess"] = partial(test_connection_engine_step, client)
        test_fn["GetDashboards"] = partial(test_query, client, FETCH_DASHBOARDS_TEST)
        test_fn["GetCharts"] = partial(test_query, client, FETCH_ALL_CHARTS_TEST)

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_fqn=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
