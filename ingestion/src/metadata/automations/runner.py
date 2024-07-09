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
Run the Automation Workflow
"""
from functools import singledispatch
from typing import Any

from metadata.generated.schema.entity.automations.testServiceConnection import (
    TestServiceConnectionRequest,
)
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.utils.ssl_manager import SSLManager, check_ssl_and_init


def execute(encrypted_automation_workflow: AutomationWorkflow) -> Any:
    """
    Execute the automation workflow.
    The implementation depends on the request body type
    """

    # This will already instantiate the Secrets Manager
    metadata = OpenMetadata(
        config=encrypted_automation_workflow.openMetadataServerConnection
    )

    automation_workflow = metadata.get_by_name(
        entity=AutomationWorkflow, fqn=encrypted_automation_workflow.name.root
    )

    return run_workflow(automation_workflow.request, automation_workflow, metadata)


@singledispatch
def run_workflow(request: Any, *_, **__) -> Any:
    """
    Main entrypoint to execute the automation workflow
    """
    raise NotImplementedError(f"Workflow runner not implemented for {type(request)}")


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

    connection = get_connection(request.connection.config)

    # Find the test_connection function in each <source>/connection.py file
    test_connection_fn = get_test_connection_fn(request.connection.config)
    test_connection_fn(
        metadata, connection, request.connection.config, automation_workflow
    )

    if ssl_manager:
        ssl_manager.cleanup_temp_files()
