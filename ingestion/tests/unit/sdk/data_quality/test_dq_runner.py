"""
Unit tests for DQ as Code TestRunner
"""
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.data_quality import (
    ColumnValuesToBeNotNull,
    TableColumnCountToBeBetween,
    TestRunner,
)


@pytest.fixture
def mock_metadata():
    """Mock OpenMetadata SDK wrapper"""
    mock = MagicMock()
    mock.ometa = MagicMock()
    mock.ometa.config = MagicMock()
    return mock


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
        serviceType="Mysql",
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
        connection=mock_connection,
    )


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


@patch("metadata.sdk.data_quality.runner.get_client")
def test_runner_initialization(
    mock_get_client, mock_metadata, mock_table, mock_service
):
    """Test TestRunner initialization"""
    mock_get_client.return_value = mock_metadata
    mock_metadata.ometa.get_by_name.return_value = mock_table
    mock_metadata.ometa.get_by_id.return_value = mock_service

    runner = TestRunner.for_table("MySQL.default.test_db.test_table")

    assert runner.table_fqn == "MySQL.default.test_db.test_table"
    assert runner.table_entity is not None
    assert runner.service_connection is not None


@patch("metadata.sdk.data_quality.runner.get_client")
def test_runner_table_not_found(mock_get_client, mock_metadata):
    """Test error when table is not found"""
    mock_get_client.return_value = mock_metadata
    mock_metadata.ometa.get_by_name.return_value = None

    with pytest.raises(ValueError, match="not found in OpenMetadata"):
        TestRunner.for_table("NonExistent.table.fqn")


@patch("metadata.sdk.data_quality.runner.get_client")
def test_add_test(mock_get_client, mock_metadata, mock_table, mock_service):
    """Test adding tests to runner"""
    mock_get_client.return_value = mock_metadata
    mock_metadata.ometa.get_by_name.return_value = mock_table
    mock_metadata.ometa.get_by_id.return_value = mock_service

    runner = TestRunner.for_table("MySQL.default.test_db.test_table")
    runner.add_test(TableColumnCountToBeBetween(min_count=10))

    assert len(runner.test_definitions) == 1


@patch("metadata.sdk.data_quality.runner.get_client")
def test_run_without_tests(mock_get_client, mock_metadata, mock_table, mock_service):
    """Test error when running without tests"""
    mock_get_client.return_value = mock_metadata
    mock_metadata.ometa.get_by_name.return_value = mock_table
    mock_metadata.ometa.get_by_id.return_value = mock_service

    runner = TestRunner.for_table("MySQL.default.test_db.test_table")

    with pytest.raises(ValueError, match="No tests added"):
        runner.run()


@patch("metadata.sdk.data_quality.runner.get_client")
def test_build_test_case(mock_get_client, mock_metadata, mock_table, mock_service):
    """Test building TestCase from TestDefinition"""
    mock_get_client.return_value = mock_metadata
    mock_metadata.ometa.get_by_name.return_value = mock_table
    mock_metadata.ometa.get_by_id.return_value = mock_service

    runner = TestRunner.for_table("MySQL.default.test_db.test_table")
    test_def = TableColumnCountToBeBetween(min_count=10)
    test_def.name = "custom_test"

    test_case = runner._build_test_case(test_def)

    assert test_case.name.root == "custom_test"
    assert test_case.testDefinition.fullyQualifiedName == "tableColumnCountToBeBetween"
    assert len(test_case.parameterValues) == 1


@patch("metadata.sdk.data_quality.runner.get_client")
def test_for_service_alias(mock_get_client, mock_metadata, mock_table, mock_service):
    """Test that for_service is an alias for for_table"""
    mock_get_client.return_value = mock_metadata
    mock_metadata.ometa.get_by_name.return_value = mock_table
    mock_metadata.ometa.get_by_id.return_value = mock_service

    runner = TestRunner.for_service("MySQL.default.test_db.test_table")

    assert runner.table_fqn == "MySQL.default.test_db.test_table"
