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
from typing import Optional

from elasticsearch8 import Elasticsearch

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.search.elasticSearchConnection import (
    ApiAuthentication,
    BasicAuthentication,
    ElasticsearchConnection,
)
from metadata.ingestion.connections.builders import init_empty_connection_arguments
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def get_connection(connection: ElasticsearchConnection) -> Elasticsearch:
    """
    Create connection
    """
    basic_auth = None
    api_key = None
    if (
        isinstance(connection.authType, BasicAuthentication)
        and connection.authType.username
    ):
        basic_auth = (
            connection.authType.username,
            connection.authType.password.get_secret_value()
            if connection.authType.password
            else None,
        )

    if isinstance(connection.authType, ApiAuthentication):
        if connection.authType.apiKeyId and connection.authType.apiKey:
            api_key = (
                connection.authType.apiKeyId,
                connection.authType.apiKey.get_secret_value(),
            )
        elif connection.authType.apiKey:
            api_key = connection.authType.apiKey.get_secret_value()

    if not connection.connectionArguments:
        connection.connectionArguments = init_empty_connection_arguments()

    return Elasticsearch(
        connection.hostPort,
        http_auth=basic_auth,
        api_key=api_key,
        ca_certs=connection.caCert,
        **connection.connectionArguments.__root__
    )


def test_connection(
    metadata: OpenMetadata,
    client: Elasticsearch,
    service_connection: ElasticsearchConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    test_fn = {
        "CheckAccess": client.info,
        "GetSearchIndexes": client.indices.get_alias,
    }

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
