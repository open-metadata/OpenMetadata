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
from typing import Optional

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.dashboard.supersetConnection import (
    SupersetConnection,
)
from metadata.ingestion.connections.test_connections import (
    test_connection_engine_step,
    test_connection_steps,
    test_query,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.preset.client import PresetAPIClient
from metadata.ingestion.source.dashboard.superset.queries import (
    FETCH_ALL_CHARTS_TEST,
    FETCH_DASHBOARDS_TEST,
)


def get_connection(connection: SupersetConnection) -> PresetAPIClient:
    """
    Create connection
    """
    if isinstance(connection.connection, PresetAPIClient):
        return PresetAPIClient(connection)
    return None


def test_connection(
    metadata: OpenMetadata,
    client: PresetAPIClient,
    service_connection: SupersetConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    test_fn = {}

    if isinstance(client, PresetAPIClient):
        test_fn["CheckAccess"] = client.get_dashboard_count
        test_fn["GetDashboards"] = client.get_dashboard_count
        test_fn["GetCharts"] = client.get_chart_count
    else:
        test_fn["CheckAccess"] = partial(test_connection_engine_step, client)
        test_fn["GetDashboards"] = partial(test_query, client, FETCH_DASHBOARDS_TEST)
        test_fn["GetCharts"] = partial(test_query, client, FETCH_ALL_CHARTS_TEST)

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
