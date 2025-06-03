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

import importlib
import pathlib
import sys
import uuid

import pytest
import yaml

from metadata.config.common import ConfigurationError, load_config_file
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StepSummary,
)
from metadata.workflow.metadata import MetadataWorkflow

if sys.version_info < (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


def delete_service(metadata):
    service_id = str(
        metadata.get_by_name(entity=DatabaseService, fqn="local_mysql_test").id.root
    )

    metadata.delete(
        entity=DatabaseService,
        entity_id=service_id,
        recursive=True,
        hard_delete=True,
    )


def test_get_200():
    key = "metadata.ingestion.sink.metadata_rest.MetadataRestSink"
    if key.find(".") >= 0:
        module_name, class_name = key.rsplit(".", 1)
        my_class = getattr(importlib.import_module(module_name), class_name)
        assert my_class is not None


def test_get_4xx():
    key = "metadata.ingestion.sink.MYSQL.mysqlSINK"
    with pytest.raises(ModuleNotFoundError):
        if key.find(".") >= 0:
            module_name, class_name = key.rsplit(".", 1)
            getattr(importlib.import_module(module_name), class_name)


def test_execute_200(metadata, mysql_config):
    workflow_config = yaml.safe_load(mysql_config)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.stop()

    # Service is created
    assert metadata.get_by_name(entity=DatabaseService, fqn="local_mysql_test")

    # The service has an ingestion pipeline (since it has the ingestionPipelineFQN inside and the runId)
    assert metadata.get_by_name(
        entity=IngestionPipeline, fqn=workflow_config["ingestionPipelineFQN"]
    )

    # The pipeline has the right status
    pipeline_status = metadata.get_pipeline_status(
        workflow_config["ingestionPipelineFQN"], workflow_config["pipelineRunId"]
    )

    # We have status for the source and sink
    assert len(pipeline_status.status.root) == 2
    assert isinstance(pipeline_status.status.root[0], StepSummary)

    # Rerunning with a different Run ID still generates the correct status
    new_run_id = str(uuid.uuid4())
    workflow_config["pipelineRunId"] = new_run_id

    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.stop()

    pipeline_status = metadata.get_pipeline_status(
        workflow_config["ingestionPipelineFQN"], new_run_id
    )

    # We have status for the source and sink
    assert len(pipeline_status.status.root) == 2
    assert isinstance(pipeline_status.status.root[0], StepSummary)

    delete_service(metadata)


def test_execute_4xx():
    config_file = pathlib.Path("/tmp/mysql_test123")
    with pytest.raises(ConfigurationError):
        load_config_file(config_file)


def test_fail_no_service_connection_and_overwrite():
    current_dir = pathlib.Path(__file__).resolve().parent
    config_file = current_dir.joinpath("mysql_test.yaml")
    workflow_config = load_config_file(config_file)

    del workflow_config["source"]["serviceConnection"]
    workflow_config["workflowConfig"]["openMetadataServerConfig"][
        "forceEntityOverwriting"
    ] = True

    with pytest.raises(AttributeError):
        MetadataWorkflow.create(workflow_config)
