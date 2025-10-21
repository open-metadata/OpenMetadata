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

"""Unit tests for WorkflowConfigBuilder"""
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuitePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import LogLevels
from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.data_quality.workflow_config_builder import WorkflowConfigBuilder


@pytest.fixture
def mock_ometa_client(mock_table, mock_service):
    """Mock OpenMetadata client"""
    client = MagicMock()
    client.config = OpenMetadataConnection.model_construct(
        hostPort="http://localhost:8585/api"
    )
    client.get_by_name.return_value = mock_table
    client.get_by_id.return_value = mock_service
    return client


@pytest.fixture
def mock_ometa_client_without_entities():
    """Mock OpenMetadata client"""
    client = MagicMock()
    client.config = OpenMetadataConnection.model_construct(
        hostPort="http://localhost:8585/api"
    )
    return client


@pytest.fixture
def mock_table():
    """Mock table entity"""
    return Table.model_construct(
        id=uuid4(),
        name=EntityName("test_table"),
        fullyQualifiedName=FullyQualifiedEntityName("MySQL.default.test_db.test_table"),
        description=Markdown("Test table"),
        columns=[
            Column.model_construct(
                name=EntityName("id"),
                dataType=DataType.INT,
            ),
            Column.model_construct(
                name=EntityName("email"),
                dataType=DataType.VARCHAR,
            ),
        ],
        serviceType=DatabaseServiceType.Mysql,
        service=EntityReference.model_construct(
            id=uuid4(),
            name="MySQL",
            type="databaseService",
        ),
        database=EntityReference.model_construct(
            id=uuid4(),
            name="test_db",
            type="database",
        ),
    )


@pytest.fixture
def mock_service(mock_table):
    """Mock database service"""
    mysql_conn = MysqlConnection.model_construct(
        type="Mysql",
        username="test_user",
        hostPort="localhost:3306",
    )
    connection = DatabaseConnection.model_construct(config=mysql_conn)

    return DatabaseService.model_construct(
        id=mock_table.service.id,
        name="MySQL",
        connection=connection,
    )


@pytest.fixture
def test_definition_1():
    """Mock test case definition 1"""
    return TestCaseDefinition(
        name="test_column_count",
        testDefinitionName="tableColumnCountToBeBetween",
        parameterValues=[
            TestCaseParameterValue(name="minColValue", value="5"),
            TestCaseParameterValue(name="maxColValue", value="10"),
        ],
    )


@pytest.fixture
def test_definition_2():
    """Mock test case definition 2"""
    return TestCaseDefinition(
        name="test_row_count",
        testDefinitionName="tableRowCountToBeBetween",
        parameterValues=[
            TestCaseParameterValue(name="minValue", value="100"),
            TestCaseParameterValue(name="maxValue", value="1000"),
        ],
    )


def test_builder_initialization(mock_ometa_client):
    """Test that builder accepts OMeta client"""
    builder = WorkflowConfigBuilder(client=mock_ometa_client)

    assert builder.client == mock_ometa_client
    assert builder.table is None
    assert builder.service_connection is None
    assert builder.test_definitions == []
    assert builder.force_test_update is True
    assert builder.log_level == LogLevels.INFO
    assert builder.raise_on_error is False
    assert builder.success_threshold == 90
    assert builder.enable_streamable_logs is False


def test_with_table_fetches_table_and_service(
    mock_ometa_client, mock_table, mock_service
):
    """Test that with_table() fetches table and service connection"""
    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    result = builder.with_table("MySQL.default.test_db.test_table")

    assert result is builder
    assert builder.table == mock_table
    assert builder.service_connection == mock_service.connection
    mock_ometa_client.get_by_name.assert_called_once()
    mock_ometa_client.get_by_id.assert_called_once()


def test_add_test_definition_single(mock_ometa_client, test_definition_1):
    """Test adding a single test definition"""
    builder = WorkflowConfigBuilder(client=mock_ometa_client)

    result = builder.add_test_definition(test_definition_1)

    assert result is builder
    assert len(builder.test_definitions) == 1
    assert builder.test_definitions[0] == test_definition_1


def test_add_test_definitions_multiple(
    mock_ometa_client, test_definition_1, test_definition_2
):
    """Test adding multiple test definitions"""
    builder = WorkflowConfigBuilder(client=mock_ometa_client)

    builder.add_test_definitions([test_definition_1, test_definition_2])

    assert len(builder.test_definitions) == 2
    assert builder.test_definitions[0] == test_definition_1
    assert builder.test_definitions[1] == test_definition_2


def test_add_test_definitions_chaining(
    mock_ometa_client, test_definition_1, test_definition_2
):
    """Test that add_test_definitions supports method chaining"""
    builder = WorkflowConfigBuilder(client=mock_ometa_client)

    builder.add_test_definitions([test_definition_1]).add_test_definitions(
        [test_definition_2]
    )

    assert len(builder.test_definitions) == 2


def test_build_creates_valid_config(
    mock_ometa_client, mock_table, mock_service, test_definition_1, test_definition_2
):
    """Test that build creates a complete and valid workflow configuration"""
    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.add_test_definitions([test_definition_1, test_definition_2])

    config = builder.build()

    assert config is not None
    assert config.source is not None
    assert config.processor is not None
    assert config.sink is not None
    assert config.workflowConfig is not None


def test_build_source_configuration(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that source configuration is correctly set"""
    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.add_test_definitions([test_definition_1])

    config = builder.build()

    assert config.source.type == mock_table.serviceType.value
    assert config.source.serviceName == mock_table.service.name
    assert config.source.serviceConnection is not None
    assert config.source.serviceConnection.root == mock_service.connection


def test_build_source_config_contains_test_suite_pipeline(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that source config contains TestSuitePipeline with correct FQN"""
    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.add_test_definitions([test_definition_1])

    config = builder.build()

    assert config.source.sourceConfig is not None
    assert isinstance(config.source.sourceConfig.config, TestSuitePipeline)
    assert config.source.sourceConfig.config.type.value == "TestSuite"
    assert (
        config.source.sourceConfig.config.entityFullyQualifiedName.root
        == mock_table.fullyQualifiedName.root
    )


def test_build_includes_test_definitions_in_processor(
    mock_ometa_client, mock_table, mock_service, test_definition_1, test_definition_2
):
    """Test that processor config includes all test definitions"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.add_test_definitions([test_definition_1, test_definition_2])

    config = builder.build()

    assert config.processor.type == "orm-test-runner"
    assert config.processor.config is not None
    assert "testCases" in config.processor.config.root
    assert len(config.processor.config.root["testCases"]) == 2


def test_build_processor_config_structure(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that processor config has correct structure"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.add_test_definitions([test_definition_1])

    config = builder.build()

    test_cases = config.processor.config.root["testCases"]
    assert test_cases[0]["name"] == "test_column_count"
    assert test_cases[0]["testDefinitionName"] == "tableColumnCountToBeBetween"
    assert len(test_cases[0]["parameterValues"]) == 2


def test_build_sets_correct_source_type(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that source type matches table service type"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.add_test_definitions([test_definition_1])

    config = builder.build()

    assert config.source.type == "Mysql"
    assert config.source.type == mock_table.serviceType.value


def test_build_sink_configuration(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that sink configuration is correctly set"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.add_test_definitions([test_definition_1])

    config = builder.build()

    assert config.sink.type == "metadata-rest"


def test_build_workflow_config_settings(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that workflow config has correct logger and server settings"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.add_test_definitions([test_definition_1])

    config = builder.build()

    assert config.workflowConfig.loggerLevel.value == "INFO"
    assert config.workflowConfig.openMetadataServerConfig == mock_ometa_client.config


def test_build_with_no_test_definitions(mock_ometa_client, mock_table, mock_service):
    """Test that build handles empty test list correctly"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")

    config = builder.build()

    assert config is not None
    assert config.processor.config is not None
    assert config.processor.config.root["testCases"] == []


def test_build_uses_table_fqn_in_source_config(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that table FQN is correctly propagated to source config"""
    expected_fqn = "MySQL.default.test_db.test_table"
    assert mock_table.fullyQualifiedName.root == expected_fqn

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table(expected_fqn)
    builder.add_test_definitions([test_definition_1])

    config = builder.build()

    source_config = config.source.sourceConfig.config
    assert isinstance(source_config, TestSuitePipeline)
    assert source_config.entityFullyQualifiedName.root == expected_fqn


def test_with_force_test_update(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that force_test_update flag is correctly set"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.with_force_test_update(True)
    builder.add_test_definitions([test_definition_1])

    config = builder.build()

    assert config.processor.config.root["forceUpdate"] is True


def test_with_force_test_update_chaining(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that with_force_test_update supports method chaining"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)

    result = (
        builder.with_table("MySQL.default.test_db.test_table")
        .with_force_test_update(True)
        .add_test_definitions([test_definition_1])
    )

    assert result is builder
    assert builder.force_test_update is True


def test_build_preserves_table_service_name(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that table service name is preserved in config"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.add_test_definitions([test_definition_1])

    config = builder.build()

    assert config.source.serviceName == "MySQL"
    assert config.source.serviceName == mock_table.service.name


def test_build_multiple_times_produces_same_config(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that calling build multiple times produces equivalent configs"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.add_test_definitions([test_definition_1])

    config1 = builder.build()
    config2 = builder.build()

    assert config1.source.type == config2.source.type
    assert config1.processor.type == config2.processor.type
    assert config1.sink.type == config2.sink.type
    assert len(config1.processor.config.root["testCases"]) == len(
        config2.processor.config.root["testCases"]
    )


def test_with_log_level(mock_ometa_client, mock_table, mock_service, test_definition_1):
    """Test that log level can be configured"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.with_log_level(LogLevels.DEBUG)
    builder.add_test_definitions([test_definition_1])

    config = builder.build()

    assert config.workflowConfig.loggerLevel == LogLevels.DEBUG


def test_with_log_level_chaining(mock_ometa_client):
    """Test that with_log_level supports method chaining"""
    builder = WorkflowConfigBuilder(client=mock_ometa_client)

    result = builder.with_log_level(LogLevels.WARN)

    assert result is builder
    assert builder.log_level == LogLevels.WARN


def test_with_raise_on_error(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that raise_on_error flag is correctly set"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.with_raise_on_error(True)
    builder.add_test_definitions([test_definition_1])

    config = builder.build()

    assert config.workflowConfig.raiseOnError is True


def test_with_raise_on_error_chaining(mock_ometa_client):
    """Test that with_raise_on_error supports method chaining"""
    builder = WorkflowConfigBuilder(client=mock_ometa_client)

    result = builder.with_raise_on_error(True)

    assert result is builder
    assert builder.raise_on_error is True


def test_with_success_threshold(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that success threshold is correctly set"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.with_success_threshold(75)
    builder.add_test_definitions([test_definition_1])

    config = builder.build()

    assert config.workflowConfig.successThreshold == 75


def test_with_success_threshold_chaining(mock_ometa_client):
    """Test that with_success_threshold supports method chaining"""
    builder = WorkflowConfigBuilder(client=mock_ometa_client)

    result = builder.with_success_threshold(80)

    assert result is builder
    assert builder.success_threshold == 80


def test_with_enable_streamable_logs(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that enable_streamable_logs flag is correctly set"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.with_enable_streamable_logs(True)
    builder.add_test_definitions([test_definition_1])

    config = builder.build()

    assert config.enableStreamableLogs is True


def test_with_enable_streamable_logs_chaining(mock_ometa_client):
    """Test that with_enable_streamable_logs supports method chaining"""
    builder = WorkflowConfigBuilder(client=mock_ometa_client)

    result = builder.with_enable_streamable_logs(True)

    assert result is builder
    assert builder.enable_streamable_logs is True


def test_builder_full_configuration_chain(
    mock_ometa_client, mock_table, mock_service, test_definition_1, test_definition_2
):
    """Test that all builder methods can be chained together"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)

    result = (
        builder.with_table("MySQL.default.test_db.test_table")
        .with_log_level(LogLevels.DEBUG)
        .with_raise_on_error(True)
        .with_success_threshold(85)
        .with_enable_streamable_logs(True)
        .with_force_test_update(True)
        .add_test_definitions([test_definition_1, test_definition_2])
    )

    assert result is builder

    config = builder.build()

    assert config.workflowConfig.loggerLevel == LogLevels.DEBUG
    assert config.workflowConfig.raiseOnError is True
    assert config.workflowConfig.successThreshold == 85
    assert config.enableStreamableLogs is True
    assert config.processor.config.root["forceUpdate"] is True
    assert len(config.processor.config.root["testCases"]) == 2


def test_default_workflow_config_values(
    mock_ometa_client, mock_table, mock_service, test_definition_1
):
    """Test that default workflow config values are applied when not overridden"""

    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.with_table("MySQL.default.test_db.test_table")
    builder.add_test_definitions([test_definition_1])

    config = builder.build()

    assert config.workflowConfig.loggerLevel == LogLevels.INFO
    assert config.workflowConfig.raiseOnError is False
    assert config.workflowConfig.successThreshold == 90
    assert config.enableStreamableLogs is False
    assert config.processor.config.root["forceUpdate"] is True


def test_build_without_table_raises_assertion(mock_ometa_client, test_definition_1):
    """Test that building without calling with_table() raises assertion"""
    builder = WorkflowConfigBuilder(client=mock_ometa_client)
    builder.add_test_definitions([test_definition_1])

    with pytest.raises(AssertionError, match="Table entity not provided"):
        builder.build()
