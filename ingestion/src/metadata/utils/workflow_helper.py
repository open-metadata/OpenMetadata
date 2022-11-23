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
Modules contains helper methods for different workflows
"""
import uuid
from datetime import datetime

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
    PipelineStatus,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def set_ingestion_pipeline_status(
    state: PipelineState,
    ingestion_pipeline_fqn: str,
    pipeline_run_id: str,
    metadata: OpenMetadata,
) -> str:
    """
    Method to set the pipeline status of current ingestion pipeline
    """

    if ingestion_pipeline_fqn:
        # if ingestion pipeline fqn is not set then setting pipeline status is avoided
        pipeline_status: PipelineStatus = None

        if state in (PipelineState.queued, PipelineState.running):
            pipeline_run_id = pipeline_run_id or str(uuid.uuid4())
            pipeline_status = PipelineStatus(
                runId=pipeline_run_id,
                pipelineState=state,
                startDate=datetime.now().timestamp() * 1000,
                timestamp=datetime.now().timestamp() * 1000,
            )
        elif pipeline_run_id:
            pipeline_status = metadata.get_pipeline_status(
                ingestion_pipeline_fqn, pipeline_run_id
            )
            # if workflow is ended then update the end date in status
            pipeline_status.endDate = datetime.now().timestamp() * 1000
            pipeline_status.pipelineState = state
        metadata.create_or_update_pipeline_status(
            ingestion_pipeline_fqn, pipeline_status
        )
        return pipeline_run_id
    return None
