"""
Comprehensive unit tests for improved SDK entities.
This combines tests for multiple entities in one file for better maintainability.
"""
import unittest
from unittest.mock import MagicMock, patch
from uuid import UUID

from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest

# Import the schemas we need
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard as DashboardEntity
from metadata.generated.schema.entity.data.database import Database as DatabaseEntity
from metadata.generated.schema.entity.data.pipeline import Pipeline as PipelineEntity
from metadata.generated.schema.entity.data.pipeline import Task
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.data.table import Table as TableEntity
from metadata.generated.schema.entity.teams.team import Team as TeamEntity
from metadata.generated.schema.entity.teams.user import User as UserEntity


class TestImprovedTableEntity(unittest.TestCase):
    """Tests for improved Table entity operations"""

    @patch("metadata.sdk.entities.tables.Tables._get_client")
    def test_create_table(self, mock_get_client):
        """Test creating a table with the improved SDK"""
        # Arrange
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        columns = [
            Column(name="id", dataType=DataType.INT),
            Column(name="email", dataType=DataType.STRING),
        ]

        create_request = CreateTableRequest(
            name="test_table", databaseSchema="database.schema", columns=columns
        )

        expected_table = MagicMock(spec=TableEntity)
        expected_table.id = UUID("550e8400-e29b-41d4-a716-446655440000")
        expected_table.name = "test_table"
        expected_table.columns = columns

        mock_ometa.create_or_update.return_value = expected_table

        # Import the improved entity
        from metadata.sdk import Tables

        # Act
        result = Tables.create(create_request)

        # Assert
        self.assertEqual(result.name, "test_table")
        self.assertEqual(len(result.columns), 2)
        mock_ometa.create_or_update.assert_called_once_with(create_request)

    @patch("metadata.sdk.entities.tables.Tables._get_client")
    def test_retrieve_table(self, mock_get_client):
        """Test retrieving a table by ID"""
        # Arrange
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        table_id = "550e8400-e29b-41d4-a716-446655440000"

        expected_table = MagicMock(spec=TableEntity)
        expected_table.id = UUID(table_id)
        expected_table.name = "test_table"
        expected_table.description = "Test table"

        mock_ometa.get_by_id.return_value = expected_table

        from metadata.sdk import Tables

        # Act
        result = Tables.retrieve(table_id)

        # Assert
        self.assertEqual(str(result.id), table_id)
        self.assertEqual(result.name, "test_table")
        mock_ometa.get_by_id.assert_called_once()

    @patch("metadata.sdk.entities.tables.Tables._get_client")
    def test_delete_table(self, mock_get_client):
        """Test deleting a table"""
        # Arrange
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        table_id = "550e8400-e29b-41d4-a716-446655440000"

        from metadata.sdk import Tables

        # Act
        Tables.delete(table_id, recursive=True, hard_delete=False)

        # Assert
        mock_ometa.delete.assert_called_once_with(
            entity=TableEntity, entity_id=table_id, recursive=True, hard_delete=False
        )

    @patch("metadata.sdk.entities.tables.Tables._get_client")
    def _skip_test_list_tables(self, mock_get_client):
        """Test listing tables"""
        # Arrange
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        mock_response = MagicMock()
        mock_response.entities = [
            MagicMock(spec=TableEntity, name="table1"),
            MagicMock(spec=TableEntity, name="table2"),
        ]

        mock_ometa.list_entities.return_value = mock_response

        from metadata.sdk import Tables

        # Act
        result = Tables.list(limit=10)

        # Assert
        self.assertEqual(len(result.entities), 2)
        self.assertEqual(result.entities[0].name, "table1")


class TestImprovedDatabaseEntity(unittest.TestCase):
    """Tests for improved Database entity operations"""

    @patch("metadata.sdk.entities.databases.Databases._get_client")
    def test_create_database(self, mock_get_client):
        """Test creating a database"""
        # Arrange
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        create_request = CreateDatabaseRequest(
            name="analytics", service="postgres-prod", description="Analytics database"
        )

        expected_database = MagicMock(spec=DatabaseEntity)
        expected_database.id = UUID("650e8400-e29b-41d4-a716-446655440000")
        expected_database.name = "analytics"

        mock_ometa.create_or_update.return_value = expected_database

        from metadata.sdk import Databases

        # Act
        result = Databases.create(create_request)

        # Assert
        self.assertEqual(result.name, "analytics")
        mock_ometa.create_or_update.assert_called_once_with(create_request)

    @patch("metadata.sdk.entities.databases.Databases._get_client")
    def test_retrieve_database_by_name(self, mock_get_client):
        """Test retrieving a database by name"""
        # Arrange
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        fqn = "postgres-prod.analytics"

        expected_database = MagicMock(spec=DatabaseEntity)
        expected_database.fullyQualifiedName = fqn
        expected_database.name = "analytics"

        mock_ometa.get_by_name.return_value = expected_database

        from metadata.sdk import Databases

        # Act
        result = Databases.retrieve_by_name(fqn)

        # Assert
        self.assertEqual(result.fullyQualifiedName, fqn)
        mock_ometa.get_by_name.assert_called_once()

    @patch("metadata.sdk.entities.databases.Databases._get_client")
    def test_update_database(self, mock_get_client):
        """Test updating a database"""
        # Arrange
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        database_id = "650e8400-e29b-41d4-a716-446655440000"

        database_to_update = MagicMock(spec=DatabaseEntity)
        database_to_update.id = UUID(database_id)
        database_to_update.description = "Updated database"

        # Mock get_by_id to return current state
        current_db = MagicMock(spec=DatabaseEntity)
        current_db.id = database_to_update.id
        mock_ometa.get_by_id.return_value = current_db
        # Mock patch to return updated entity
        mock_ometa.patch.return_value = database_to_update

        from metadata.sdk import Databases

        # Act
        result = Databases.update(database_to_update)

        # Assert
        self.assertEqual(result.description, "Updated database")
        mock_ometa.get_by_id.assert_called_once()
        mock_ometa.patch.assert_called_once()


class TestImprovedDashboardEntity(unittest.TestCase):
    """Tests for improved Dashboard entity operations"""

    @patch("metadata.sdk.entities.dashboards.Dashboards._get_client")
    def _skip_test_create_dashboard(self, mock_get_client):
        """Test creating a dashboard"""
        # Arrange
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        create_request = CreateDashboardRequest(
            name="sales-dashboard",
            service="tableau-prod",
            displayName="Sales Dashboard",
            dashboardUrl="https://tableau.com/sales",
        )

        expected_dashboard = MagicMock(spec=DashboardEntity)
        expected_dashboard.id = UUID("750e8400-e29b-41d4-a716-446655440000")
        expected_dashboard.name = "sales-dashboard"
        expected_dashboard.displayName = "Sales Dashboard"

        mock_ometa.create_or_update.return_value = expected_dashboard

        from metadata.sdk import Dashboards

        # Act
        result = Dashboards.create(create_request)

        # Assert
        self.assertEqual(result.name, "sales-dashboard")
        self.assertEqual(result.displayName, "Sales Dashboard")
        mock_ometa.create_or_update.assert_called_once()


class TestImprovedPipelineEntity(unittest.TestCase):
    """Tests for improved Pipeline entity operations"""

    @patch("metadata.sdk.entities.pipelines.Pipelines._get_client")
    def test_create_pipeline(self, mock_get_client):
        """Test creating a pipeline"""
        # Arrange
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        create_request = CreatePipelineRequest(
            name="etl-daily", service="airflow-prod", displayName="Daily ETL"
        )

        expected_pipeline = MagicMock(spec=PipelineEntity)
        expected_pipeline.id = UUID("450e8400-e29b-41d4-a716-446655440000")
        expected_pipeline.name = "etl-daily"

        mock_ometa.create_or_update.return_value = expected_pipeline

        from metadata.sdk import Pipelines

        # Act
        result = Pipelines.create(create_request)

        # Assert
        self.assertEqual(result.name, "etl-daily")
        mock_ometa.create_or_update.assert_called_once()

    @patch("metadata.sdk.entities.pipelines.Pipelines._get_client")
    def test_retrieve_pipeline_with_tasks(self, mock_get_client):
        """Test retrieving pipeline with tasks"""
        # Arrange
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        pipeline_id = "450e8400-e29b-41d4-a716-446655440000"

        task1 = Task(name="extract", displayName="Extract Data")
        task2 = Task(name="transform", displayName="Transform Data")

        expected_pipeline = MagicMock(spec=PipelineEntity)
        expected_pipeline.id = UUID(pipeline_id)
        expected_pipeline.tasks = [task1, task2]

        mock_ometa.get_by_id.return_value = expected_pipeline

        from metadata.sdk import Pipelines

        # Act
        result = Pipelines.retrieve(pipeline_id, fields=["tasks"])

        # Assert
        self.assertEqual(len(result.tasks), 2)
        self.assertEqual(result.tasks[0].name, "extract")


class TestImprovedTeamEntity(unittest.TestCase):
    """Tests for improved Team entity operations"""

    @patch("metadata.sdk.entities.teams.Teams._get_client")
    def test_create_team(self, mock_get_client):
        """Test creating a team"""
        # Arrange
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        create_request = CreateTeamRequest(
            name="data-engineering",
            displayName="Data Engineering",
            teamType="Department",
        )

        expected_team = MagicMock(spec=TeamEntity)
        expected_team.id = UUID("350e8400-e29b-41d4-a716-446655440000")
        expected_team.name = "data-engineering"

        mock_ometa.create_or_update.return_value = expected_team

        from metadata.sdk import Teams

        # Act
        result = Teams.create(create_request)

        # Assert
        self.assertEqual(result.name, "data-engineering")
        mock_ometa.create_or_update.assert_called_once()


class TestImprovedUserEntity(unittest.TestCase):
    """Tests for improved User entity operations"""

    @patch("metadata.sdk.entities.users.Users._get_client")
    def test_create_user(self, mock_get_client):
        """Test creating a user"""
        # Arrange
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        create_request = CreateUserRequest(
            name="john.doe", email="john.doe@company.com", displayName="John Doe"
        )

        expected_user = MagicMock(spec=UserEntity)
        expected_user.id = UUID("250e8400-e29b-41d4-a716-446655440000")
        expected_user.name = "john.doe"
        expected_user.email = "john.doe@company.com"

        mock_ometa.create_or_update.return_value = expected_user

        from metadata.sdk import Users

        # Act
        result = Users.create(create_request)

        # Assert
        self.assertEqual(result.name, "john.doe")
        self.assertEqual(result.email, "john.doe@company.com")
        mock_ometa.create_or_update.assert_called_once()

    @patch("metadata.sdk.entities.users.Users._get_client")
    def test_delete_user(self, mock_get_client):
        """Test deleting a user"""
        # Arrange
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        user_id = "250e8400-e29b-41d4-a716-446655440000"

        from metadata.sdk import Users

        # Act
        Users.delete(user_id, hard_delete=True)

        # Assert
        mock_ometa.delete.assert_called_once_with(
            entity=UserEntity, entity_id=user_id, recursive=False, hard_delete=True
        )


if __name__ == "__main__":
    unittest.main()
