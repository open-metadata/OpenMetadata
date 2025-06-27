import uuid
from datetime import datetime
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    StatusType,
    TestConnectionResult,
    TestConnectionStepResult,
)
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.ometa.ometa_api import OpenMetadata


@pytest.fixture
def mock_service_connection():
    return MagicMock()


@pytest.fixture
def mock_metadata():
    return MagicMock(spec=OpenMetadata)


@pytest.fixture
def mock_workflow():
    return AutomationWorkflow(
        id=str(uuid.uuid4()),
        name="test-workflow",
        workflowType="TEST_CONNECTION",
        request={},
    )  # type: ignore


@pytest.fixture
def test_connection(mock_service_connection):
    """Fixture providing a concrete implementation of BaseConnection for testing"""

    class TestConnection(BaseConnection):
        """Concrete implementation of BaseConnection for testing"""

        def _get_client(self):
            return MagicMock()

        def test_connection(
            self, metadata, automation_workflow=None, timeout_seconds=None
        ):
            return TestConnectionResult(
                status=StatusType.Successful,
                steps=[
                    TestConnectionStepResult(
                        name="test_step",
                        mandatory=True,
                        passed=True,
                        message="Test step passed successfully",
                        errorLog=None,
                    )
                ],
                lastUpdatedAt=Timestamp(int(datetime.now().timestamp() * 1000)),
            )

        def get_connection_dict(self):
            return {}

    return TestConnection(mock_service_connection)


class TestBaseConnection:
    """Test suite for BaseConnection class"""

    def test_service_connection_property(
        self, test_connection, mock_service_connection
    ):
        """Test that service_connection property is properly set"""
        assert test_connection.service_connection == mock_service_connection

    def test_test_connection_implementation(
        self, test_connection, mock_metadata, mock_workflow
    ):
        """Test that test_connection implementation works correctly"""
        result = test_connection.test_connection(
            metadata=mock_metadata,
            automation_workflow=mock_workflow,
            timeout_seconds=30,
        )

        assert isinstance(result, TestConnectionResult)
        assert result.status == StatusType.Successful
        assert len(result.steps) == 1
        assert result.steps[0].name == "test_step"
        assert result.steps[0].mandatory is True
        assert result.steps[0].passed is True
        assert result.steps[0].message == "Test step passed successfully"
        assert result.steps[0].errorLog is None

    def test_get_client_implementation(self, test_connection):
        """Test that get_client implementation works correctly"""
        mock_client = MagicMock()

        class TestConnectionWithMockClient(BaseConnection):
            def _get_client(self):
                return mock_client

            def test_connection(
                self, metadata, automation_workflow=None, timeout_seconds=None
            ):
                return TestConnectionResult(
                    status=StatusType.Successful,
                    steps=[
                        TestConnectionStepResult(
                            name="test_step",
                            mandatory=True,
                            passed=True,
                            message="Test step passed successfully",
                            errorLog=None,
                        )
                    ],
                    lastUpdatedAt=Timestamp(int(datetime.now().timestamp() * 1000)),
                )

            def get_connection_dict(self):
                return {}

        connection = TestConnectionWithMockClient(test_connection.service_connection)
        client = connection.client
        assert client == mock_client
