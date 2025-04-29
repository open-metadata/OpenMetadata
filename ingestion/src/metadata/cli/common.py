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
Handle workflow execution
"""
from typing import Any, Dict

from metadata.workflow.base import BaseWorkflow


def execute_workflow(workflow: BaseWorkflow, config_dict: Dict[str, Any]) -> None:
    """Execute the workflow and raise if needed"""
    workflow.execute()
    workflow.print_status()
    workflow.stop()
    if config_dict.get("workflowConfig", {}).get("raiseOnError", True):
        workflow.raise_from_status()
