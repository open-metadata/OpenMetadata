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
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class WorkflowNotFound:
    """Sentinel returned by `execute` when the workflow no longer exists."""

    def __repr__(self) -> str:
        return "WORKFLOW_NOT_FOUND"


WORKFLOW_NOT_FOUND = WorkflowNotFound()


@singledispatch
def run_workflow(request: Any, *_, **__) -> Any:
    """
    Main entrypoint to execute the automation workflow
    """
    raise NotImplementedError(f"Workflow runner not implemented for {type(request)}")


def execute(encrypted_automation_workflow: AutomationWorkflow) -> Any:
    """
    Execute the automation workflow.
    The implementation depends on the request body type.

    Returns `WORKFLOW_NOT_FOUND` when the workflow was hard-deleted before the
    runner fetched it. The live handler's own return value (often `None`) is
    passed through unchanged, so callers can tell "gone" from "done".
    """
    # Import all the functions defined for run_workflow
    import metadata.automations.extended_runner  # pylint: disable=import-outside-toplevel
    import metadata.automations.runner  # pylint: disable=import-outside-toplevel

    # This will already instantiate the Secrets Manager
    metadata = OpenMetadata(config=encrypted_automation_workflow.openMetadataServerConnection)

    automation_workflow = metadata.get_by_name(entity=AutomationWorkflow, fqn=encrypted_automation_workflow.name.root)

    if automation_workflow is None:
        # The workflow may have been hard-deleted while its Kubernetes Job was
        # still waiting for a Pod (e.g. a ResourceQuota delay). get_by_name then
        # returns None. Terminate cleanly instead of raising AttributeError on
        # ``.request``, which the Job would retry as a transient failure.
        logger.warning(
            f"Automation workflow [{encrypted_automation_workflow.name.root}] no longer "
            "exists. Skipping execution (it may have been deleted before the runner started)."
        )
        return WORKFLOW_NOT_FOUND

    ingestion_runner = getattr(automation_workflow.request, "ingestionRunner", None)
    if ingestion_runner:
        logger.info(f"Executing automation [{automation_workflow.name.root}] in Runner [{ingestion_runner}]")

    return run_workflow(automation_workflow.request, automation_workflow, metadata)
