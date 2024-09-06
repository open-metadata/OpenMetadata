#  Copyright 2024 Collate
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
from typing import Optional

import requests
from requests.models import Response

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.apiService.restConnection import (
    RESTConnection,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class SchemaURLError(Exception):
    """
    Class to indicate schema url is invalid
    """


def get_connection(connection: RESTConnection) -> Response:
    """
    Create connection
    """
    return requests.get(connection.openAPISchemaURL)


def test_connection(
    metadata: OpenMetadata,
    client: Response,
    service_connection: RESTConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def custom_url_exec():
        if client.status_code == 200:
            return []
        raise SchemaURLError(
            f"Failed to get access to provided schema url. Please check with url and its permissions"
        )

    test_fn = {"CheckURL": custom_url_exec}

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
