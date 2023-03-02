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
Main ingestion entrypoint to run OM workflows
"""
import os

import yaml

from metadata.data_insight.api.workflow import DataInsightWorkflow
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineType,
)
from metadata.ingestion.api.workflow import Workflow
from metadata.profiler.api.workflow import ProfilerWorkflow
from metadata.test_suite.api.workflow import TestSuiteWorkflow

WORKFLOW_MAP = {
    PipelineType.metadata.value: Workflow,
    PipelineType.usage.value: Workflow,
    PipelineType.lineage.value: Workflow,
    PipelineType.profiler.value: ProfilerWorkflow,
    PipelineType.TestSuite.value: TestSuiteWorkflow,
    PipelineType.dataInsight.value: DataInsightWorkflow,
    PipelineType.elasticSearchReindex.value: Workflow,
    PipelineType.dbt.value: Workflow,
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
    """

    # DockerOperator expects an env var called config
    config = os.environ["config"]
    pipeline_type = os.environ["pipelineType"]

    workflow_class = WORKFLOW_MAP.get(pipeline_type)
    if workflow_class is None:
        raise ValueError(f"Missing workflow_class loaded from {pipeline_type}")

    # Load the config string representation
    workflow_config = yaml.safe_load(config)
    workflow = workflow_class.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


if __name__ == "__main__":
    main()
