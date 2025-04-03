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
Module that handles the legacy WorkflowType until deprecation
"""
from enum import Enum
from typing import Optional

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineType,
)
from metadata.utils.deprecation import deprecated


@deprecated(
    message="Use 'PipelineType' in 'metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline'",
    release="1.6",
)
class WorkflowType(Enum):
    """
    Workflow type enums based on the `metadata` CLI commands
    """

    INGEST = "ingest"
    PROFILE = "profile"
    TEST = "test"
    LINEAGE = "lineage"
    USAGE = "usage"
    INSIGHT = "insight"
    APP = "application"


# TODO: Delete this method after the removal of WorkflowType in release 1.6
# Remember to remove it where it is being used
def workflow_type_to_pipeline_type(
    workflow_type: WorkflowType, source_type_name: Optional[str]
) -> PipelineType:
    """Helper Function to Map between the Deprecated WorkflowType to PipelineType."""

    def _fix_ingest_type() -> PipelineType:
        """Helper Function to Map between the Deprecated WorkflowType.INGESTION and the
        correct PipelineType."""
        if source_type_name:
            if source_type_name.endswith("lineage"):
                return PipelineType.lineage
            if source_type_name.endswith("usage"):
                return PipelineType.usage
        return PipelineType.metadata

    map_ = {
        WorkflowType.INGEST: _fix_ingest_type(),
        WorkflowType.PROFILE: PipelineType.profiler,
        WorkflowType.TEST: PipelineType.TestSuite,
        WorkflowType.LINEAGE: PipelineType.lineage,
        WorkflowType.USAGE: PipelineType.usage,
        WorkflowType.INSIGHT: PipelineType.dataInsight,
        WorkflowType.APP: PipelineType.application,
    }

    return map_.get(workflow_type, PipelineType.metadata)
