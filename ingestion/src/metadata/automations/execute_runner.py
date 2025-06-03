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
Run the Automation Workflow
"""
from functools import singledispatch
from typing import Any

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


@singledispatch
def run_workflow(request: Any, *_, **__) -> Any:
    """
    Main entrypoint to execute the automation workflow
    """
    raise NotImplementedError(f"Workflow runner not implemented for {type(request)}")


def execute(encrypted_automation_workflow: AutomationWorkflow) -> Any:
    """
    Execute the automation workflow.
    The implementation depends on the request body type
    """
    # Import all the functions defined for run_workflow
    import metadata.automations.extended_runner  # pylint: disable=import-outside-toplevel
    import metadata.automations.runner  # pylint: disable=import-outside-toplevel

    # This will already instantiate the Secrets Manager
    metadata = OpenMetadata(
        config=encrypted_automation_workflow.openMetadataServerConnection
    )

    automation_workflow = metadata.get_by_name(
        entity=AutomationWorkflow, fqn=encrypted_automation_workflow.name.root
    )

    return run_workflow(automation_workflow.request, automation_workflow, metadata)
