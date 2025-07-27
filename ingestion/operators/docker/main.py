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
Main ingestion entrypoint to run OM workflows
"""
import os

import yaml

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineType,
)
from metadata.generated.schema.metadataIngestion.workflow import LogLevels
from metadata.utils.logger import set_loggers_level
from metadata.workflow.data_quality import TestSuiteWorkflow
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow
from metadata.workflow.usage import UsageWorkflow

WORKFLOW_MAP = {
    PipelineType.metadata.value: MetadataWorkflow,
    PipelineType.usage.value: UsageWorkflow,
    PipelineType.lineage.value: MetadataWorkflow,
    PipelineType.profiler.value: ProfilerWorkflow,
    PipelineType.TestSuite.value: TestSuiteWorkflow,
    PipelineType.elasticSearchReindex.value: MetadataWorkflow,
    PipelineType.dbt.value: MetadataWorkflow,
}


def main():
    """
    Ingestion entrypoint. Get the right Workflow class
    and execute the ingestion.

    This image is expected to be used and run in environments
    such as Airflow's KubernetesPodOperator:

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

    KubernetesPodOperator(
        task_id="ingest",
        name="ingest",
        cmds=["python", "main.py"],
        image="openmetadata/ingestion-base:0.13.2",
        namespace='default',
        env_vars={"config": config, "pipelineType": "metadata"},
        dag=dag,
    )
    ```

    Note how we are expecting the env variables to be sent, with the `config` being the str
    representation of the ingestion YAML.

    We will also set the `pipelineRunId` value if it comes from the environment.
    """

    # DockerOperator expects an env var called config
    config = os.getenv("config")
    if not config:
        raise RuntimeError(
            "Missing environment variable `config`. This is needed to configure the Workflow."
        )

    pipeline_type = os.getenv("pipelineType")
    if not pipeline_type:
        raise RuntimeError(
            "Missing environment variable `pipelineType`. This is needed to load the Workflow class."
        )

    pipeline_run_id = os.getenv("pipelineRunId")

    workflow_class = WORKFLOW_MAP.get(pipeline_type)
    if workflow_class is None:
        raise ValueError(f"Missing workflow_class loaded from {pipeline_type}")

    # Load the config string representation
    workflow_config = yaml.safe_load(config)
    if pipeline_run_id:
        workflow_config["pipelineRunId"] = pipeline_run_id

    logger_level = workflow_config.get("workflowConfig", {}).get("loggerLevel")
    set_loggers_level(logger_level or LogLevels.INFO.value)

    workflow = workflow_class.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


if __name__ == "__main__":
    main()
