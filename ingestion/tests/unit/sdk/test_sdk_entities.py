"""
Unit tests for SDK entity operations
"""
import unittest
from unittest.mock import MagicMock, patch

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.table import Table as TableEntity
from metadata.generated.schema.entity.teams.user import User as UserEntity
from metadata.sdk import OpenMetadata, OpenMetadataConfig
from metadata.sdk.entities import Table, User


class TestSDKEntities(unittest.TestCase):
    """Test SDK entity operations"""

    @patch("metadata.sdk.client.OMeta")
    def setUp(self, mock_ometa_class):
        """Set up test fixtures"""
        # Create mock OMeta instance
        self.mock_ometa = MagicMock()
        mock_ometa_class.return_value = self.mock_ometa
        
        self.config = OpenMetadataConfig(
            server_url="http://localhost:8585",
            jwt_token="test-token",
        )
        self.client = OpenMetadata(self.config)
        
        # Set default clients
        Table.set_default_client(self.client)
        User.set_default_client(self.client)

    def test_table_create(self):
        """Test creating a table"""
        create_request = CreateTableRequest(
            name="test_table",
            databaseSchema="test_schema",
            columns=[],
        )
        
        mock_table = MagicMock(spec=TableEntity)
        mock_table.id = "550e8400-e29b-41d4-a716-446655440000"
        mock_table.name = "test_table"
        mock_table.fullyQualifiedName = "service.database.schema.test_table"
        self.mock_ometa.create_or_update.return_value = mock_table
        
        result = Table.create(create_request)
        
        self.assertEqual(result.name, "test_table")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_table_retrieve(self):
        """Test retrieving a table by ID"""
        mock_table = MagicMock(spec=TableEntity)
        mock_table.id = "550e8400-e29b-41d4-a716-446655440000"
        mock_table.name = "test_table"
        mock_table.fullyQualifiedName = "service.database.schema.test_table"
        self.mock_ometa.get_by_id.return_value = mock_table
        
        result = Table.retrieve("table-id", fields=["owners", "tags"])
        
        self.assertEqual(result.name, "test_table")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=TableEntity,
            entity_id="table-id",
            fields=["owners", "tags"],
        )

    def test_table_retrieve_by_name(self):
        """Test retrieving a table by FQN"""
        mock_table = MagicMock(spec=TableEntity)
        mock_table.id = "550e8400-e29b-41d4-a716-446655440000"
        mock_table.name = "test_table"
        mock_table.fullyQualifiedName = "service.database.schema.test_table"
        self.mock_ometa.get_by_name.return_value = mock_table
        
        result = Table.retrieve_by_name("service.database.schema.test_table")
        
        self.assertEqual(result.name, "test_table")
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=TableEntity,
            fqn="service.database.schema.test_table",
            fields=None,
        )

    def test_table_delete(self):
        """Test deleting a table"""
        Table.delete("table-id", recursive=True, hard_delete=True)
        
        self.mock_ometa.delete.assert_called_once_with(
            entity=TableEntity,
            entity_id="table-id",
            recursive=True,
            hard_delete=True,
        )

    def test_table_list(self):
        """Test listing tables"""
        from metadata.sdk.entities.table import TableListParams
        
        params = TableListParams.builder() \
            .limit(50) \
            .database("test_db") \
            .fields(["owners", "tags"]) \
            .build()
        
        collection = Table.list(params)
        
        self.assertEqual(collection.params.limit, 50)
        self.assertEqual(collection.params.database, "test_db")

    def test_user_create(self):
        """Test creating a user"""
        create_request = CreateUserRequest(
            name="test_user",
            email="test@example.com",
        )
        
        mock_user = MagicMock(spec=UserEntity)
        mock_user.id = "550e8400-e29b-41d4-a716-446655440001"
        mock_user.name = "test_user"
        mock_user.email = "test@example.com"
        self.mock_ometa.create_or_update.return_value = mock_user
        
        result = User.create(create_request)
        
        self.assertEqual(result.name, "test_user")
        self.assertEqual(result.email, "test@example.com")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_user_retrieve(self):
        """Test retrieving a user"""
        mock_user = MagicMock(spec=UserEntity)
        mock_user.id = "550e8400-e29b-41d4-a716-446655440001"
        mock_user.name = "test_user"
        mock_user.email = "test@example.com"
        self.mock_ometa.get_by_id.return_value = mock_user
        
        result = User.retrieve("user-id")
        
        self.assertEqual(result.name, "test_user")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=UserEntity,
            entity_id="user-id",
            fields=None,
        )

    def test_user_delete(self):
        """Test deleting a user"""
        User.delete("user-id")
        
        self.mock_ometa.delete.assert_called_once_with(
            entity=UserEntity,
            entity_id="user-id",
            recursive=False,
            hard_delete=False,
        )

    def test_table_async_operations(self):
        """Test async table operations"""
        import asyncio
        
        # Mock responses
        mock_table = MagicMock(spec=TableEntity)
        self.mock_ometa.create_or_update.return_value = mock_table
        self.mock_ometa.get_by_id.return_value = mock_table
        self.mock_ometa.delete.return_value = None
        
        # Verify the methods exist and are callable
        self.assertTrue(asyncio.iscoroutinefunction(Table.create_async))
        self.assertTrue(asyncio.iscoroutinefunction(Table.retrieve_async))
        self.assertTrue(asyncio.iscoroutinefunction(Table.delete_async))


if __name__ == "__main__":
    unittest.main()