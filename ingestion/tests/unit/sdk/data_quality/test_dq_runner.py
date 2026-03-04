"""
Unit tests for DQ as Code TestRunner
"""

from tempfile import NamedTemporaryFile
from typing import Generator
from unittest.mock import MagicMock, Mock, create_autospec, patch
from uuid import uuid4

import pytest

from metadata.data_quality.api.models import TestCaseResultResponse
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
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.tests.testDefinition import TestDefinition
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    TestCaseEntityName,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.client import APIError
from metadata.sdk import OpenMetadata
from metadata.sdk.data_quality import (
    ColumnValuesToBeNotNull,
    TableColumnCountToBeBetween,
    TestRunner,
)


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
def mock_connection():
    """Mock database connection"""
    return MysqlConnection.model_construct(
        type="Mysql",
        username="test_user",
        hostPort="localhost:3306",
    )


@pytest.fixture
def mock_service(mock_connection):
    """Mock database service"""
    return DatabaseService.model_construct(
        id=uuid4(),
        name=EntityName("MySQL"),
        serviceType="Mysql",
        connection=DatabaseConnection(config=mock_connection),
    )


@pytest.fixture
def mock_client(mock_table, mock_service):
    """Mock OMeta client"""
    mock = MagicMock()
    mock.config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        securityConfig=OpenMetadataJWTClientConfig(jwtToken="the-jwt-token"),
    )
    mock.get_by_name.side_effect = (mock_table,)
    mock.get_by_id.side_effect = (mock_service,)
    return mock


@pytest.fixture
def mock_test_definition():
    """Mock test definition"""
    return TestDefinition.model_construct(
        id=uuid4(),
        name=TestCaseEntityName(root="tableColumnCountToBeBetween"),
        fullyQualifiedName=FullyQualifiedEntityName(root="tableColumnCountToBeBetween"),
    )


@pytest.fixture
def mock_metadata(mock_client) -> MagicMock:
    """Mock metadata"""
    metadata = create_autospec(OpenMetadata, instance=True)
    metadata.ometa = mock_client
    return metadata


@pytest.fixture
def mock_get_client(mock_metadata) -> Generator[MagicMock, None, None]:
    """Mock get client"""
    with patch("metadata.sdk.data_quality.runner.get_client") as get_client_mock:
        get_client_mock.return_value = mock_metadata
        yield get_client_mock


def test_test_definition_creation():
    """Test that test definitions are created correctly"""
    test_def = TableColumnCountToBeBetween(min_count=10, max_count=20)
    assert test_def.test_definition_name == "tableColumnCountToBeBetween"
    assert len(test_def.parameters) == 2
    assert test_def.parameters[0].name == "minColValue"
    assert test_def.parameters[0].value == "10"


def test_test_definition_with_column():
    """Test column-level test definition"""
    test_def = ColumnValuesToBeNotNull(column="email")
    assert test_def.column_name == "email"
    assert test_def.test_definition_name == "columnValuesToBeNotNull"


def test_test_definition_fluent_api():
    """Test fluent API for test definitions"""
    test_def = (
        TableColumnCountToBeBetween(min_count=5)
        .with_name("custom_test_name")
        .with_description("Custom test description")
        .with_compute_row_count(True)
    )
    assert test_def.name == "custom_test_name"
    assert test_def.description == "Custom test description"
    assert test_def.compute_passed_failed_row_count is True


def test_runner_initialization(mock_get_client):
    """Test TestRunner initialization"""

    runner = TestRunner.for_table("MySQL.default.test_db.test_table")

    assert runner.table_fqn == "MySQL.default.test_db.test_table"
    assert runner.config_builder.table is not None
    assert runner.config_builder.service_connection is not None


@pytest.mark.parametrize(
    "mock_table, expected_error_message",
    (
        (
            APIError(
                {"message": "Not Found"},
                Mock(
                    response=Mock(status_code=404),
                ),
            ),
            "not found in OpenMetadata",
        ),
        (
            APIError(
                {"message": "Not Found"},
                Mock(
                    response=Mock(status_code=401),
                ),
            ),
            "Request was unauthorized or it couldn't be authenticated.",
        ),
        (
            APIError(
                {"message": "Not Found"},
                Mock(
                    response=Mock(status_code=403),
                ),
            ),
            "Request was unauthorized or it couldn't be authenticated.",
        ),
    ),
)
def test_runner_table_not_found(mock_get_client, expected_error_message: str):
    with pytest.raises(ValueError, match=expected_error_message):
        TestRunner.for_table("NonExistent.table.fqn")


def test_add_test(mock_get_client):
    """Test adding tests to runner"""
    runner = TestRunner.for_table("MySQL.default.test_db.test_table")
    runner.add_test(TableColumnCountToBeBetween(min_count=10))

    assert len(runner.test_definitions) == 1


@patch("metadata.sdk.data_quality.runner.TestSuiteWorkflow")
@patch("metadata.sdk.data_quality.runner.WorkflowConfigBuilder")
def test_run_without_tests(mock_builder_class, mock_workflow_class, mock_get_client):
    """Test error when running without tests"""
    runner = TestRunner.for_table("MySQL.default.test_db.test_table")

    assert runner.run() is not None


@patch("metadata.sdk.data_quality.runner.TestSuiteWorkflow")
@patch("metadata.sdk.data_quality.runner.WorkflowConfigBuilder")
def test_run_executes_workflow(
    mock_builder_class, mock_workflow_class, mock_get_client
):
    """Test that run() creates and executes workflow"""
    mock_config = MagicMock(spec=OpenMetadataWorkflowConfig)
    mock_config.model_dump.return_value = {"test": "config"}

    mock_builder = MagicMock()
    mock_builder.build.return_value = mock_config
    mock_builder_class.return_value = mock_builder

    mock_processor = MagicMock()
    mock_workflow = MagicMock()
    mock_workflow.steps = (mock_processor,)
    mock_workflow_class.create.return_value = mock_workflow

    runner = TestRunner.for_table("MySQL.default.test_db.test_table")
    runner.add_test(TableColumnCountToBeBetween(min_count=10))

    runner.run()

    mock_workflow_class.create.assert_called_once()
    mock_workflow.execute.assert_called_once()


@patch("metadata.sdk.data_quality.runner.TestSuiteWorkflow")
def test_run_uses_config_builder(mock_workflow_class, mock_get_client):
    """Test that run() uses WorkflowConfigBuilder correctly"""
    mock_config = MagicMock(spec=OpenMetadataWorkflowConfig)
    mock_config.model_dump.return_value = {"test": "config"}

    mock_processor = MagicMock()
    mock_workflow = MagicMock()
    mock_workflow.steps = (mock_processor,)
    mock_workflow_class.create.return_value = mock_workflow

    runner = TestRunner.for_table("MySQL.default.test_db.test_table")
    test_def = TableColumnCountToBeBetween(min_count=10, max_count=20)
    runner.add_test(test_def)

    with patch.object(runner.config_builder, "build", return_value=mock_config):
        runner.run()

    assert len(runner.config_builder.test_definitions) == 1
    mock_workflow_class.create.assert_called_once_with({"test": "config"})
    mock_workflow.execute.assert_called_once()


@patch("metadata.sdk.data_quality.runner.TestSuiteWorkflow")
@patch("metadata.sdk.data_quality.runner.WorkflowConfigBuilder")
@patch("metadata.sdk.data_quality.runner.ResultCapturingProcessor")
def test_run_captures_results_from_processor(
    mock_capturer_class, mock_builder_class, mock_workflow_class, mock_get_client
):
    """Test that run() captures results from ResultCapturingProcessor"""
    mock_config = MagicMock(spec=OpenMetadataWorkflowConfig)
    mock_config.model_dump.return_value = {"test": "config"}

    mock_builder = MagicMock()
    mock_builder.build.return_value = mock_config
    mock_builder_class.return_value = mock_builder

    mock_result = MagicMock(spec=TestCaseResultResponse)
    mock_capturer = MagicMock()
    mock_capturer.get_results.return_value = [mock_result]
    mock_capturer_class.return_value = mock_capturer

    mock_processor = MagicMock()
    mock_workflow = MagicMock()
    mock_workflow.steps = (mock_processor,)
    mock_workflow_class.create.return_value = mock_workflow

    runner = TestRunner.for_table("MySQL.default.test_db.test_table")
    runner.add_test(TableColumnCountToBeBetween(min_count=10))

    results = runner.run()

    mock_capturer_class.assert_called_once_with(mock_processor)
    mock_capturer.get_results.assert_called_once()
    assert len(results) == 1
    assert results[0] == mock_result


@pytest.fixture
def workflow_yaml() -> str:
    """Return test workflow yaml"""
    return """
source:
  type: TestSuite
  serviceName: MySQL
  sourceConfig:
    config:
      type: TestSuite
      entityFullyQualifiedName: MySQL.default.test_db.test_table
processor:
  type: orm-test-runner
  config:
    testCases:
      - name: test_column_count
        testDefinitionName: tableColumnCountToBeBetween
        parameterValues:
          - name: minColValue
            value: "5"
          - name: maxColValue
            value: "10"
workflowConfig:
  loggerLevel: INFO
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: basic
"""


def test_from_yaml_string(mock_get_client, workflow_yaml):
    """Test creating TestRunner from YAML string"""

    runner = TestRunner.from_yaml(yaml_string=workflow_yaml)

    assert runner.table_fqn == "MySQL.default.test_db.test_table"
    assert len(runner.test_definitions) == 1
    assert runner.test_definitions[0].name == "test_column_count"


def test_from_yaml_file(mock_get_client, workflow_yaml):
    """Test creating TestRunner from YAML file"""

    with NamedTemporaryFile("w") as f:
        f.write(workflow_yaml)
        f.flush()

        runner = TestRunner.from_yaml(file_path=f.file.name)

    assert runner.table_fqn == "MySQL.default.test_db.test_table"
    assert len(runner.test_definitions) == 1
    assert runner.test_definitions[0].name == "test_column_count"


def test_from_yaml_must_receive_either_file_path_or_string_value() -> None:
    """Test creating TestRunner from YAML file"""
    with pytest.raises(
        AssertionError,
        match="`TestRunner.from_yaml` expects either `yaml_string` or `file_path` to be provided.",
    ):
        TestRunner.from_yaml()


def test_to_test_case_definition():
    """Test converting BaseTest to TestCaseDefinition"""
    test_def = TableColumnCountToBeBetween(min_count=10, max_count=20)
    test_def.name = "custom_test"
    test_def.description = "Test description"

    test_case_def = test_def.to_test_case_definition()

    assert test_case_def.name == "custom_test"
    assert test_case_def.testDefinitionName == "tableColumnCountToBeBetween"
    assert test_case_def.description == "Test description"
    assert len(test_case_def.parameterValues) == 2


def test_column_test_to_test_case_definition():
    """Test converting ColumnTest to TestCaseDefinition"""
    test_def = ColumnValuesToBeNotNull(column="email")
    test_def.name = "email_not_null_test"

    test_case_def = test_def.to_test_case_definition()

    assert test_case_def.name == "email_not_null_test"
    assert test_case_def.columnName == "email"
    assert test_case_def.testDefinitionName == "columnValuesToBeNotNull"
