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
Entrypoint to send exit handler information when a pipeline fails
"""
import logging
import os
from datetime import datetime

import yaml

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
    PipelineStatus,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

SUCCESS_STATES = {"Succeeded"}


def main():
    """
    Exit Handler entrypoint

    ```
    config = '''
        source:
          type: ...
          serviceName: ...
          serviceConnection:
            ...
          sourceConfig:
            ...
        sink:
          ...
        workflowConfig:
          ...
    '''

    The goal of this script is to be executed as a failure callback/exit handler
    when a Workflow processing fails. There are situations where the failure
    cannot be directly controlled in the Workflow class.

    We don't want to initialize the full workflow as it might be failing
    on the `__init__` call as well. We'll manually prepare the status sending
    logic.

    In this callback we just care about:
    - instantiating the ometa client
    - getting the IngestionPipeline FQN
    - if exists, update with `Failed` status
    """

    config = os.getenv("config")
    if not config:
        raise RuntimeError(
            "Missing environment variable `config`. This is needed to configure the Workflow."
        )

    pipeline_run_id = os.getenv("pipelineRunId")
    raw_pipeline_status = os.getenv("pipelineStatus")

    raw_workflow_config = yaml.safe_load(config)
    raw_workflow_config["pipelineRunId"] = pipeline_run_id

    workflow_config = OpenMetadataWorkflowConfig.model_validate(raw_workflow_config)
    metadata = OpenMetadata(
        config=workflow_config.workflowConfig.openMetadataServerConfig
    )

    if workflow_config.ingestionPipelineFQN and pipeline_run_id and raw_pipeline_status:
        logging.info(
            f"Sending status to Ingestion Pipeline {workflow_config.ingestionPipelineFQN}"
        )

        pipeline_status = metadata.get_pipeline_status(
            workflow_config.ingestionPipelineFQN,
            str(workflow_config.pipelineRunId.root),
        )

        # Maybe the workflow was not even initialized
        if not pipeline_status:
            pipeline_status = PipelineStatus(
                runId=str(workflow_config.pipelineRunId.root),
                startDate=datetime.now().timestamp() * 1000,
                timestamp=datetime.now().timestamp() * 1000,
            )

        pipeline_status.endDate = datetime.now().timestamp() * 1000
        pipeline_status.pipelineState = (
            PipelineState.failed
            if raw_pipeline_status not in SUCCESS_STATES
            else PipelineState.success
        )

        metadata.create_or_update_pipeline_status(
            workflow_config.ingestionPipelineFQN, pipeline_status
        )

    else:
        logging.info(
            "Missing ingestionPipelineFQN, pipelineRunId or pipelineStatus. We won't update the status."
        )


if __name__ == "__main__":
    main()
