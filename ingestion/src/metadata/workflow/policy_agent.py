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
Policy Agent Workflow Definition
"""

from metadata.config.common import WorkflowExecutionError
from metadata.ingestion.api.steps import Source
from metadata.utils.logger import ingestion_logger
from metadata.workflow.ingestion import IngestionWorkflow

logger = ingestion_logger()


class PolicyAgentWorkflow(IngestionWorkflow):
    """
    Policy Agent ingestion workflow implementation.
    Applies access grants against the source system.
    """

    def set_steps(self):
        self.source = self._get_source()
        # The Policy Agent has no downstream steps; the source applies the grants directly.
        self.steps = ()

    def _get_source(self) -> Source:
        source_type = self.config.source.type.lower()
        if not self.config.source.serviceName:
            raise WorkflowExecutionError("ServiceName is required field for executing the Policy Agent Workflow.")

        source_class = self.import_source_class()
        source: Source = source_class.create(self.config.source.model_dump(), self.metadata)
        logger.debug(f"Source type:{source_type},{source_class} configured")
        source.prepare()
        logger.debug(f"Source type:{source_type},{source_class} prepared")

        return source
