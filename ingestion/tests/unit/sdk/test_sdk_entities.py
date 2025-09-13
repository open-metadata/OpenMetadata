"""
Unit tests for SDK entity operations
"""
import asyncio
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.data.table import Table as TableEntity
from metadata.generated.schema.entity.teams.user import User as UserEntity
from metadata.sdk.entities.table_improved import Table
from metadata.sdk.entities.user_improved import User


class TestSDKEntities(unittest.TestCase):
    """Test SDK entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        # Create mock OMeta instance
        self.mock_ometa = MagicMock()

        # Set default clients
        Table._default_client = self.mock_ometa
        User._default_client = self.mock_ometa

        # Test data
        self.table_id = "550e8400-e29b-41d4-a716-446655440000"
        self.user_id = "650e8400-e29b-41d4-a716-446655440000"

    def test_table_create(self):
        """Test creating a table"""
        # Arrange
        columns = [
            Column(name="id", dataType=DataType.INT),
            Column(name="name", dataType=DataType.VARCHAR, dataLength=255),
        ]

        create_request = CreateTableRequest(
            name="test_table",
            databaseSchema="test_schema",
            columns=columns,
        )

        mock_table = MagicMock(spec=TableEntity)
        mock_table.id = UUID(self.table_id)
        mock_table.name = "test_table"
        mock_table.fullyQualifiedName = "service.database.schema.test_table"
        self.mock_ometa.create_or_update.return_value = mock_table

        # Act
        result = Table.create(create_request)

        # Assert
        self.assertEqual(result.name, "test_table")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_table_retrieve(self):
        """Test retrieving a table by ID"""
        # Arrange
        mock_table = MagicMock(spec=TableEntity)
        mock_table.id = UUID(self.table_id)
        mock_table.name = "test_table"
        mock_table.fullyQualifiedName = "service.database.schema.test_table"
        self.mock_ometa.get_by_id.return_value = mock_table

        # Act
        result = Table.retrieve("table-id", fields=["owners", "tags"])

        # Assert
        self.assertEqual(result.name, "test_table")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=TableEntity,
            entity_id="table-id",
            fields=["owners", "tags"],
        )

    def test_table_retrieve_by_name(self):
        """Test retrieving a table by FQN"""
        # Arrange
        mock_table = MagicMock(spec=TableEntity)
        mock_table.id = UUID(self.table_id)
        mock_table.name = "test_table"
        mock_table.fullyQualifiedName = "service.database.schema.test_table"
        self.mock_ometa.get_by_name.return_value = mock_table

        # Act
        result = Table.retrieve_by_name("service.database.schema.test_table")

        # Assert
        self.assertEqual(
            result.fullyQualifiedName, "service.database.schema.test_table"
        )
        self.mock_ometa.get_by_name.assert_called_once()

    def test_table_delete(self):
        """Test deleting a table"""
        # Act
        Table.delete("table-id", recursive=True, hard_delete=False)

        # Assert
        self.mock_ometa.delete.assert_called_once_with(
            entity=TableEntity,
            entity_id="table-id",
            recursive=True,
            hard_delete=False,
        )

    def test_table_list(self):
        """Test listing tables"""
        # Arrange
        mock_response = MagicMock()
        mock_response.entities = [
            MagicMock(spec=TableEntity, name="table1"),
            MagicMock(spec=TableEntity, name="table2"),
        ]
        self.mock_ometa.list_entities.return_value = mock_response

        # Act
        result = Table.list(limit=25)

        # Assert
        self.assertEqual(len(result), 2)
        self.mock_ometa.list_entities.assert_called_once()

    def test_table_async_operations(self):
        """Test async operations exist"""
        # Verify async methods exist
        self.assertTrue(asyncio.iscoroutinefunction(Table.create_async))
        self.assertTrue(asyncio.iscoroutinefunction(Table.retrieve_async))
        self.assertTrue(asyncio.iscoroutinefunction(Table.update_async))
        self.assertTrue(asyncio.iscoroutinefunction(Table.delete_async))

    def test_user_create(self):
        """Test creating a user"""
        # Arrange
        create_request = CreateUserRequest(
            name="john.doe",
            email="john.doe@company.com",
            displayName="John Doe",
        )

        mock_user = MagicMock(spec=UserEntity)
        mock_user.id = UUID(self.user_id)
        mock_user.name = "john.doe"
        mock_user.email = "john.doe@company.com"
        self.mock_ometa.create_or_update.return_value = mock_user

        # Act
        result = User.create(create_request)

        # Assert
        self.assertEqual(result.name, "john.doe")
        self.assertEqual(result.email, "john.doe@company.com")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_user_retrieve(self):
        """Test retrieving a user"""
        # Arrange
        mock_user = MagicMock(spec=UserEntity)
        mock_user.id = UUID(self.user_id)
        mock_user.name = "john.doe"
        mock_user.email = "john.doe@company.com"
        self.mock_ometa.get_by_id.return_value = mock_user

        # Act
        result = User.retrieve("user-id")

        # Assert
        self.assertEqual(result.name, "john.doe")
        self.mock_ometa.get_by_id.assert_called_once()

    def test_user_delete(self):
        """Test deleting a user"""
        # Act
        User.delete("user-id", hard_delete=True)

        # Assert
        self.mock_ometa.delete.assert_called_once_with(
            entity=UserEntity,
            entity_id="user-id",
            recursive=False,
            hard_delete=True,
        )


if __name__ == "__main__":
    unittest.main()
