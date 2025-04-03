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
Run the Automation Workflow for OpenMetadata
"""

from metadata.automations.execute_runner import run_workflow
from metadata.generated.schema.entity.automations.testServiceConnection import (
    TestServiceConnectionRequest,
)
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.ingestion.connections.test_connections import (
    raise_test_connection_exception,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.utils.ssl_manager import SSLManager, check_ssl_and_init


@run_workflow.register
def _(
    request: TestServiceConnectionRequest,
    automation_workflow: AutomationWorkflow,
    metadata: OpenMetadata,
):
    """
    Run the test connection
    """
    ssl_manager = None
    ssl_manager: SSLManager = check_ssl_and_init(request.connection.config)
    if ssl_manager:
        request.connection.config = ssl_manager.setup_ssl(request.connection.config)

    # Find the test_connection function in each <source>/connection.py file
    test_connection_fn = get_test_connection_fn(request.connection.config)

    try:
        connection = get_connection(request.connection.config)
        if hasattr(request.connection.config, "hostPort"):
            host_port_str = str(request.connection.config.hostPort or "")
            if "localhost" in host_port_str:
                result = test_connection_fn(
                    metadata, connection, request.connection.config
                )
                raise_test_connection_exception(result)

        test_connection_fn(
            metadata, connection, request.connection.config, automation_workflow
        )
    except Exception as error:
        host_port_str = str(getattr(request.connection.config, "hostPort", None) or "")
        if not host_port_str or "localhost" not in host_port_str:
            raise error

        host_port_type = type(request.connection.config.hostPort)
        docker_host_port_str = host_port_str.replace(
            "localhost", "host.docker.internal"
        )
        request.connection.config.hostPort = host_port_type(docker_host_port_str)

        connection = get_connection(request.connection.config)
        test_connection_fn(
            metadata, connection, request.connection.config, automation_workflow
        )

    if ssl_manager:
        ssl_manager.cleanup_temp_files()
