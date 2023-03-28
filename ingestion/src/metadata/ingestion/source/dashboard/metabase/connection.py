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
import json
from typing import Any, Dict, Optional

import requests

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.dashboard.metabaseConnection import (
    MetabaseConnection,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def get_connection(connection: MetabaseConnection) -> Dict[str, Any]:
    """
    Create connection
    """
    try:
        params = {}
        params["username"] = connection.username
        params["password"] = connection.password.get_secret_value()

        headers = {"Content-Type": "application/json", "Accept": "*/*"}

        resp = requests.post(  # pylint: disable=missing-timeout
            connection.hostPort + "/api/session/",
            data=json.dumps(params),
            headers=headers,
        )

        session_id = resp.json()["id"]
        metabase_session = {"X-Metabase-Session": session_id}
        conn = {"connection": connection, "metabase_session": metabase_session}
        return conn

    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


def test_connection(
    metadata: OpenMetadata,
    client,
    service_connection: MetabaseConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def custom_executor():
        result = requests.get(  # pylint: disable=missing-timeout
            client["connection"].hostPort + "/api/dashboard",
            headers=client["metabase_session"],
        )

        return list(result)

    test_fn = {"GetDashboards": custom_executor}

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_fqn=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
