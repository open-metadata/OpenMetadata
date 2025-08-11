#  Copyright 2024 Collate
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
from typing import Optional

import requests
from requests.models import Response

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.api.restConnection import (
    RestConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


class SchemaURLError(Exception):
    """
    Class to indicate schema url is invalid
    """


class InvalidOpenAPISchemaError(Exception):
    """
    Class to indicate openapi schema is invalid
    """


def get_connection(connection: RestConnection) -> Response:
    """
    Create connection
    """
    if connection.token:
        headers = {"Authorization": f"Bearer {connection.token.get_secret_value()}"}
        return requests.get(connection.openAPISchemaURL, headers=headers)
    return requests.get(connection.openAPISchemaURL)


def test_connection(
    metadata: OpenMetadata,
    client: Response,
    service_connection: RestConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def custom_url_exec():
        if client.status_code == 200:
            return []
        raise SchemaURLError(
            "Failed to connect to the JSON schema url. Please check the url and credentials. Status Code was: "
            + str(client.status_code)
        )

    def custom_schema_exec():
        try:
            if client.json() is not None and client.json().get("openapi") is not None:
                return []

            raise InvalidOpenAPISchemaError(
                "Provided schema is not valid OpenAPI JSON schema"
            )
        except:
            raise InvalidOpenAPISchemaError(
                "Provided schema is not valid OpenAPI JSON schema"
            )

    test_fn = {"CheckURL": custom_url_exec, "CheckSchema": custom_schema_exec}

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
