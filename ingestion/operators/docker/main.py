import os

import yaml

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineType,
)
from metadata.ingestion.api.workflow import Workflow
from metadata.orm_profiler.api.workflow import ProfilerWorkflow
from metadata.test_suite.api.workflow import TestSuiteWorkflow

WORKFLOW_MAP = {
    PipelineType.metadata.value: Workflow,
    PipelineType.usage.value: Workflow,
    PipelineType.lineage.value: Workflow,
    PipelineType.profiler.value: ProfilerWorkflow,
    PipelineType.TestSuite.value: TestSuiteWorkflow,
}


def main():
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
