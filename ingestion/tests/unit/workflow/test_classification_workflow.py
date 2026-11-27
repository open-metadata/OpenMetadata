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
"""Classification availability must fail the workflow after sampling drains."""

import json
from copy import deepcopy
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest

from metadata.cli.common import execute_workflow
from metadata.config.common import WorkflowExecutionError
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import OpenMetadataConnection
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import PipelineState
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    DatabaseServiceAutoClassificationPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import Source as SourceConfigModel
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Sink, Source
from metadata.pii.base_processor import AutoClassificationProcessor, UnavailableClassificationProcessor
from metadata.pii.model_loading import ClassificationModelLoadError
from metadata.sampler.models import SamplerResponse
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.workflow_status_mixin import WorkflowResultStatus

config = OpenMetadataWorkflowConfig(
    source=SourceConfigModel(
        type="postgres",
        serviceName="test",
        sourceConfig=SourceConfig(config=DatabaseServiceAutoClassificationPipeline()),
    ),
    workflowConfig=WorkflowConfig(
        openMetadataServerConfig=OpenMetadataConnection(
            hostPort="http://localhost:8585/api", authProvider="openmetadata", securityConfig={"jwtToken": "test-token"}
        )
    ),
)


def sample_record():
    return SamplerResponse(
        entity=Table(
            id=uuid4(),
            name="table",
            fullyQualifiedName="svc.db.schema.table",
            columns=[Column(name="email", dataType=DataType.STRING, fullyQualifiedName="svc.db.schema.table.email")],
        )
    )


class SampleSource(Source):
    count = 5

    def _iter(self):
        for _ in range(self.count):
            yield Either(right=sample_record())

    def prepare(self):
        pass

    def test_connection(self):
        pass

    def close(self):
        pass

    @classmethod
    def create(cls, config_dict, metadata):
        return cls()


class RecordingSink(Sink):
    def __init__(self):
        super().__init__()
        self.received = []

    def _run(self, record):
        self.received.append(record)
        return Either(right=record)

    def close(self):
        pass

    @classmethod
    def create(cls, config_dict, metadata):
        return cls()


class UnavailableWorkflow(AutoClassificationWorkflow):
    def set_steps(self):
        self.source = SampleSource()
        processor = UnavailableClassificationProcessor(
            self.config,
            self.metadata,
            ClassificationModelLoadError("en_core_web_md", "en", "en", "local_load"),
        )
        self.steps = (processor, RecordingSink())


@pytest.mark.parametrize("threshold", [0, 80, 100])
@pytest.mark.parametrize("count", [0, 5, 150])
@pytest.mark.parametrize("raise_on_error", [True, False])
def test_unavailable_model_drains_then_fails_status_and_cli(tmp_path, threshold, count, raise_on_error):
    workflow_config = deepcopy(config)
    workflow_config.source.sourceConfig.config = DatabaseServiceAutoClassificationPipeline()
    workflow = UnavailableWorkflow(config=workflow_config)
    workflow.workflow_config.successThreshold = threshold
    assert workflow.workflow_config.successThreshold == threshold
    workflow.source.count = count
    status_file = tmp_path / "status.json"
    with patch.object(workflow, "set_ingestion_pipeline_status") as persist:
        if raise_on_error:
            with pytest.raises(WorkflowExecutionError):
                execute_workflow(workflow, {}, status_file)
        else:
            execute_workflow(workflow, {"workflowConfig": {"raiseOnError": False}}, status_file)

    assert len(workflow.steps[-1].received) == count
    assert all(record.column_tags == [] for record in workflow.steps[-1].received)
    assert persist.call_args.args[0] is PipelineState.failed
    assert json.loads(status_file.read_text())["success"] is False
    assert len(workflow.get_failures()) == 1
    assert workflow.result_status() is WorkflowResultStatus.FAILURE


@pytest.mark.parametrize("legacy", [True, False])
def test_factory_only_recovers_typed_model_errors(legacy):
    from metadata.pii import processor_factory

    workflow_config = deepcopy(config)
    workflow_config.source.sourceConfig.config = DatabaseServiceAutoClassificationPipeline()
    if legacy:
        from metadata.generated.schema.metadataIngestion.workflow import Processor

        workflow_config.processor = Processor(type="pii-processor", config={})
    owner, name = (processor_factory.PIIProcessor, "create") if legacy else (processor_factory, "TagProcessor")
    for error in [
        ClassificationModelLoadError("en_core_web_md", "en", "en", "local_load"),
        ValueError("bad config"),
        MemoryError(),
    ]:
        with patch.object(owner, name, side_effect=error):
            if isinstance(error, ClassificationModelLoadError):
                processor = processor_factory.create_pii_processor(Mock(), workflow_config)
                assert processor.model_load_failure is error
                assert len(processor.status.failures) == 1
            else:
                error_type = type(error)
                metadata = Mock()
                with pytest.raises(error_type):
                    processor_factory.create_pii_processor(metadata, workflow_config)


class HealthyClassificationProcessor(AutoClassificationProcessor):
    def create_column_tag_labels(self, column, sample_data):
        return []


class WiredWorkflow(AutoClassificationWorkflow):
    def test_connection(self):
        pass

    def _get_source_class(self):
        return SampleSource

    def _get_sink(self):
        return RecordingSink()

    def _get_sampler_processor(self):
        return RecordingSink()

    def _get_pii_processor(self):
        assert self.config.source.sourceConfig.config.enableAutoClassification
        return HealthyClassificationProcessor(self.config, self.metadata)


@pytest.mark.parametrize("enabled", [True, False])
@pytest.mark.parametrize("service", ["database", "storage", "messaging"])
def test_healthy_and_disabled_classification_preserve_service_workflow_wiring(tmp_path, enabled, service):
    from metadata.generated.schema.metadataIngestion.messagingServiceAutoClassificationPipeline import (
        MessagingServiceAutoClassificationPipeline,
    )
    from metadata.generated.schema.metadataIngestion.storageServiceAutoClassificationPipeline import (
        StorageServiceAutoClassificationPipeline,
    )

    source_configs = {
        "database": DatabaseServiceAutoClassificationPipeline,
        "storage": StorageServiceAutoClassificationPipeline,
        "messaging": MessagingServiceAutoClassificationPipeline,
    }
    workflow_config = deepcopy(config)
    workflow_config.source.sourceConfig.config = source_configs[service](enableAutoClassification=enabled)
    workflow = WiredWorkflow(config=workflow_config)
    status_file = tmp_path / "status.json"
    execute_workflow(workflow, {}, status_file)
    assert len(workflow.steps) == (3 if enabled else 2)
    assert len(workflow.steps[-1].received) == 5
    assert not workflow.get_failures()
    assert workflow.result_status() is WorkflowResultStatus.SUCCESS
    assert json.loads(status_file.read_text())["success"] is True
