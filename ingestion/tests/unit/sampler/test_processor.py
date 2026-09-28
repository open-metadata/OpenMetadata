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

"""Tests for sampler processor execution and status handling."""

import uuid
from unittest.mock import MagicMock, Mock, patch

import pytest

from metadata.generated.schema.entity.data.container import Container, ContainerDataModel
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType, Table, TableData
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.storageServiceAutoClassificationPipeline import (
    StorageServiceAutoClassificationPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Processor,
    Sink,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.api.models import ProfilerProcessorConfig
from metadata.profiler.source.model import ProfilerSourceAndEntity
from metadata.profiler.source.profiler_source_interface import ProfilerSourceInterface
from metadata.sampler.processor import SamplerProcessor


@pytest.fixture
def container_entity():
    """Create a test Container entity"""
    return Container(
        id=uuid.uuid4(),
        name="test_container",
        fullyQualifiedName=FullyQualifiedEntityName(root="s3_service.test_container"),
        service=EntityReference(
            id=Uuid(root=uuid.uuid4()),
            type="storageService",
            name="s3_service",
            fullyQualifiedName="s3_service",
        ),
        dataModel=ContainerDataModel(
            columns=[
                Column(name="id", dataType=DataType.INT),
                Column(name="name", dataType=DataType.STRING),
                Column(name="email", dataType=DataType.STRING),
            ]
        ),
    )


@pytest.fixture
def table_entity():
    """Create a test Table entity for comparison"""
    return Table(
        id=uuid.uuid4(),
        name="test_table",
        fullyQualifiedName=FullyQualifiedEntityName("mysql.db.test_table"),
        columns=[
            Column(name="id", dataType=DataType.INT),
            Column(name="name", dataType=DataType.STRING),
        ],
    )


@pytest.fixture
def workflow_config():
    """Create test workflow configuration"""
    config = OpenMetadataWorkflowConfig(
        source=Source(
            type="s3",
            serviceName="s3_service",
            sourceConfig=SourceConfig(
                config=StorageServiceAutoClassificationPipeline(storeSampleData=True, sampleDataCount=50),
            ),
        ),
        processor=Processor(type="orm-profiler", config={}),
        sink=Sink(type="metadata-rest", config={}),
        workflowConfig=WorkflowConfig(
            openMetadataServerConfig=OpenMetadataConnection(
                hostPort="localhost:8585/api",
            )
        ),
    )
    # Mock the serviceConnection structure
    config.source.serviceConnection = Mock()
    config.source.serviceConnection.root = Mock()
    config.source.serviceConnection.root.config = {}
    return config


@pytest.fixture
def profiler_record(table_entity):
    return ProfilerSourceAndEntity(
        profiler_source=MagicMock(spec=ProfilerSourceInterface),
        entity=table_entity,
    )


@pytest.fixture
def sampler_processor_factory(monkeypatch, workflow_config, profiler_record):
    def create(
        error: RuntimeError | None = None,
        is_skippable: bool = False,
        *,
        has_columns: bool = True,
        has_sampler_context: bool = True,
        sample_data: TableData | None = None,
    ):
        adapter = MagicMock()
        adapter.get_columns.return_value = profiler_record.entity.columns if has_columns else []
        adapter.build_sampler_kwargs.return_value = {} if has_sampler_context else None
        sampler = MagicMock()
        if error is not None:
            sampler.generate_sample_data.side_effect = error
        else:
            sampler.generate_sample_data.return_value = sample_data or TableData(
                columns=[ColumnName(root="id")], rows=[["1"]]
            )
        sampler_class = MagicMock()
        sampler_class.create.return_value = sampler
        sampler_class.is_skippable_sampling_error.return_value = is_skippable
        monkeypatch.setattr("metadata.sampler.processor.adapter_for", lambda entity: adapter)
        monkeypatch.setattr("metadata.sampler.processor.import_sampler_class", lambda *args, **kwargs: sampler_class)

        metadata = MagicMock()
        metadata.get_profiler_config_settings.return_value = None
        processor = SamplerProcessor(
            config=workflow_config,
            metadata=metadata,
            profiler_config_class=ProfilerProcessorConfig,
        )
        return processor, profiler_record, profiler_record.entity, sampler_class

    return create


def test_skippable_sampling_error_adds_one_warning_without_a_failure(sampler_processor_factory):
    processor, record, table, _ = sampler_processor_factory(
        RuntimeError("[UC_DEPENDENCY_DOES_NOT_EXIST] missing view dependency"),
        is_skippable=True,
    )
    entity_fqn = table.fullyQualifiedName.root

    response = processor.run(record)

    assert response is None
    assert processor.status.failures == []
    assert processor.status.records == []
    assert len(processor.status.warnings) == 1
    warning = processor.status.warnings[0]
    assert list(warning) == [entity_fqn]
    assert warning[entity_fqn].startswith("Skipping sample collection")
    assert "UC_DEPENDENCY_DOES_NOT_EXIST" in warning[entity_fqn]


def test_unrecognized_sampling_error_remains_a_failure(sampler_processor_factory):
    processor, record, table, _ = sampler_processor_factory(
        RuntimeError("boom"),
        is_skippable=False,
    )
    entity_fqn = table.fullyQualifiedName.root

    response = processor.run(record)

    assert response is None
    assert not any(
        warning.get(entity_fqn, "").startswith("Skipping sample collection") for warning in processor.status.warnings
    )
    assert len(processor.status.failures) == 1
    failure = processor.status.failures[0]
    assert failure.name == entity_fqn
    assert "boom" in failure.error
    assert "RuntimeError" in failure.stackTrace


def test_sampler_processor_skips_entities_without_columns(sampler_processor_factory):
    processor, record, _, sampler_class = sampler_processor_factory(has_columns=False)

    response = processor.run(record)

    assert response is None
    assert processor.status.failures == []
    assert processor.status.records == []
    sampler_class.create.assert_not_called()


def test_sampler_processor_reports_missing_sampler_context(sampler_processor_factory):
    processor, record, table, sampler_class = sampler_processor_factory(has_sampler_context=False)

    response = processor.run(record)

    assert response is None
    assert processor.status.records == []
    assert len(processor.status.failures) == 1
    failure = processor.status.failures[0]
    assert failure.name == table.fullyQualifiedName.root
    assert "Could not build sampler context" in failure.error
    sampler_class.create.assert_not_called()


def test_sampler_processor_public_run_returns_and_scans_sample_data(sampler_processor_factory):
    expected_data = TableData(columns=[ColumnName(root="id")], rows=[["sample"]])
    processor, record, table, _ = sampler_processor_factory(sample_data=expected_data)

    response = processor.run(record)

    assert response is not None
    assert response.entity == table
    assert response.sample_data.data == expected_data
    assert processor.status.warnings == []
    assert processor.status.failures == []
    assert processor.status.records == ["SamplerResponse [test_table]"]


@patch("metadata.sampler.processor.import_sampler_class")
def test_sampler_processor_handles_container(mock_import_sampler, container_entity, workflow_config):
    """Test that SamplerProcessor can handle Container entities"""

    mock_sampler_class = MagicMock()
    mock_sampler_instance = MagicMock()
    mock_sampler_instance.generate_sample_data.return_value = TableData(
        columns=[
            ColumnName(root="id"),
            ColumnName(root="name"),
            ColumnName(root="email"),
        ],
        rows=[
            ["1", "Alice", "alice@example.com"],
            ["2", "Bob", "bob@example.com"],
        ],
    )
    mock_sampler_class.create.return_value = mock_sampler_instance
    mock_import_sampler.return_value = mock_sampler_class

    metadata_mock = MagicMock()
    metadata_mock.get_profiler_config_settings.return_value = None

    processor = SamplerProcessor(
        config=workflow_config,
        metadata=metadata_mock,
    )

    profiler_source = MagicMock()
    record = ProfilerSourceAndEntity.model_construct(profiler_source=profiler_source, entity=container_entity)

    result = processor._run(record)

    assert result.right is not None
    assert result.left is None
    assert result.right.entity == container_entity
    assert result.right.sample_data is not None
    assert result.right.sample_data.store is True


@patch("metadata.sampler.processor.import_sampler_class")
def test_sampler_processor_handles_table(mock_import_sampler, table_entity, workflow_config):
    """Test that SamplerProcessor still handles Table entities correctly"""

    mock_sampler_class = MagicMock()
    mock_sampler_instance = MagicMock()
    mock_sampler_instance.generate_sample_data.return_value = TableData(
        columns=[
            ColumnName(root="id"),
            ColumnName(root="name"),
        ],
        rows=[
            ["1", "Alice"],
            ["2", "Bob"],
        ],
    )
    mock_sampler_class.create.return_value = mock_sampler_instance
    mock_import_sampler.return_value = mock_sampler_class

    metadata_mock = MagicMock()
    metadata_mock.get_profiler_config_settings.return_value = None

    with patch("metadata.utils.profiler_utils.get_context_entities") as mock_get_context:
        mock_database_entity = MagicMock()
        mock_get_context.return_value = (None, mock_database_entity, None)

        with patch("metadata.sampler.entity_adapters.build_database_service_conn_config") as mock_build_conn:
            mock_build_conn.return_value = {}

            with patch("metadata.sampler.entity_adapters.get_profile_sample_config") as mock_sample_cfg:
                from metadata.sampler.models import SampleConfig

                mock_sample_cfg.return_value = SampleConfig()

                with patch("metadata.sampler.entity_adapters.get_sample_data_count_config") as mock_count:
                    mock_count.return_value = 50

                    processor = SamplerProcessor(
                        config=workflow_config,
                        metadata=metadata_mock,
                    )

                    profiler_source = MagicMock()
                    record = ProfilerSourceAndEntity.model_construct(
                        profiler_source=profiler_source, entity=table_entity
                    )

                    result = processor._run(record)

                    assert result.right is not None
                    assert result.left is None
                    assert result.right.entity == table_entity


def test_sampler_processor_container_no_context_entities_needed(container_entity, workflow_config):
    """Test that container sampling doesn't require database/schema context"""

    with patch("metadata.sampler.processor.import_sampler_class") as mock_import:
        mock_sampler_class = MagicMock()
        mock_sampler_instance = MagicMock()
        mock_sampler_instance.generate_sample_data.return_value = TableData(columns=[], rows=[])
        mock_sampler_class.create.return_value = mock_sampler_instance
        mock_import.return_value = mock_sampler_class

        metadata_mock = MagicMock()
        metadata_mock.get_profiler_config_settings.return_value = None

        processor = SamplerProcessor(
            config=workflow_config,
            metadata=metadata_mock,
        )

        profiler_source = MagicMock()
        record = ProfilerSourceAndEntity.model_construct(profiler_source=profiler_source, entity=container_entity)

        processor._run(record)

        call_args = mock_sampler_class.create.call_args
        assert "schema_entity" not in call_args.kwargs
        assert "database_entity" not in call_args.kwargs
        assert call_args.kwargs["entity"] == container_entity


def test_sampler_processor_unsupported_entity_type(workflow_config):
    """Test that processor rejects unsupported entity types"""

    unsupported_entity = MagicMock()
    unsupported_entity.fullyQualifiedName.root = "unsupported.entity"

    with patch("metadata.sampler.processor.import_sampler_class"):
        metadata_mock = MagicMock()
        metadata_mock.get_profiler_config_settings.return_value = None

        processor = SamplerProcessor(
            config=workflow_config,
            metadata=metadata_mock,
        )

        profiler_source = MagicMock()
        record = ProfilerSourceAndEntity.model_construct(profiler_source=profiler_source, entity=unsupported_entity)

        result = processor._run(record)

        assert result.left is not None
        assert result.right is None
        assert "Unsupported entity type" in result.left.error


def test_sample_data_store_flag_respected(container_entity, workflow_config):
    """Test that storeSampleData flag is properly passed to SampleData"""

    workflow_config.source.sourceConfig.config.storeSampleData = False

    with patch("metadata.sampler.processor.import_sampler_class") as mock_import:
        mock_sampler_class = MagicMock()
        mock_sampler_instance = MagicMock()
        mock_sampler_instance.generate_sample_data.return_value = TableData(columns=[], rows=[])
        mock_sampler_class.create.return_value = mock_sampler_instance
        mock_import.return_value = mock_sampler_class

        metadata_mock = MagicMock()
        metadata_mock.get_profiler_config_settings.return_value = None

        processor = SamplerProcessor(
            config=workflow_config,
            metadata=metadata_mock,
        )

        profiler_source = MagicMock()
        record = ProfilerSourceAndEntity.model_construct(profiler_source=profiler_source, entity=container_entity)

        result = processor._run(record)

        assert result.right.sample_data.store is False
