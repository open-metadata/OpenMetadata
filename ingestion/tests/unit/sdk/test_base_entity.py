"""
Unit tests for BaseEntity class with comprehensive mocking.
"""
import asyncio
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.data.table import Table as TableEntity
from metadata.sdk import Tables


class TestBaseEntity(unittest.TestCase):
    """Test BaseEntity operations using Table as example"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()

        # Set the default client
        Tables.set_default_client(self.mock_ometa)

        # Test data
        self.table_id = "550e8400-e29b-41d4-a716-446655440000"
        self.table_fqn = "service.database.schema.test_table"

        # Sample columns
        self.columns = [
            Column(name="id", dataType=DataType.INT),
            Column(name="name", dataType=DataType.VARCHAR, dataLength=255),
        ]

    def test_create_entity(self):
        """Test creating an entity"""
        # Arrange
        create_request = CreateTableRequest(
            name="test_table",
            databaseSchema="service.database.schema",
            columns=self.columns,
        )

        expected_table = MagicMock(spec=TableEntity)
        expected_table.id = UUID(self.table_id)
        expected_table.name = "test_table"
        expected_table.fullyQualifiedName = self.table_fqn

        self.mock_ometa.create_or_update.return_value = expected_table

        # Act
        result = Tables.create(create_request)

        # Assert
        self.assertEqual(str(result.id), self.table_id)
        self.assertEqual(result.name, "test_table")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_entity(self):
        """Test retrieving an entity by ID"""
        # Arrange
        expected_table = MagicMock(spec=TableEntity)
        expected_table.id = UUID(self.table_id)
        expected_table.name = "test_table"
        expected_table.columns = self.columns

        self.mock_ometa.get_by_id.return_value = expected_table

        # Act
        result = Tables.retrieve(self.table_id)

        # Assert
        self.assertEqual(str(result.id), self.table_id)
        self.mock_ometa.get_by_id.assert_called_once()

    def test_retrieve_entity_with_fields(self):
        """Test retrieving an entity with specific fields"""
        # Arrange
        fields = ["owner", "tags", "columns"]
        expected_table = MagicMock(spec=TableEntity)
        expected_table.id = UUID(self.table_id)
        expected_table.columns = self.columns

        self.mock_ometa.get_by_id.return_value = expected_table

        # Act
        result = Tables.retrieve(self.table_id, fields=fields)

        # Assert
        self.assertIsNotNone(result.columns)
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=TableEntity, entity_id=self.table_id, fields=fields
        )

    def test_retrieve_by_name(self):
        """Test retrieving an entity by name"""
        # Arrange
        expected_table = MagicMock(spec=TableEntity)
        expected_table.id = UUID(self.table_id)
        expected_table.fullyQualifiedName = self.table_fqn

        self.mock_ometa.get_by_name.return_value = expected_table

        # Act
        result = Tables.retrieve_by_name(self.table_fqn)

        # Assert
        self.assertEqual(result.fullyQualifiedName, self.table_fqn)
        self.mock_ometa.get_by_name.assert_called_once()

    def test_update_entity(self):
        """Test updating an entity"""
        # Arrange
        table_to_update = MagicMock(spec=TableEntity)
        table_to_update.id = UUID(self.table_id)
        table_to_update.name = "updated_table"

        # Mock the get_by_id to return the current state
        current_entity = MagicMock(spec=type(table_to_update))
        current_entity.id = (
            table_to_update.id
            if hasattr(table_to_update, "id")
            else UUID(self.entity_id)
        )
        self.mock_ometa.get_by_id.return_value = current_entity

        # Mock the patch to return the updated entity
        self.mock_ometa.patch.return_value = table_to_update

        # Act
        result = Tables.update(table_to_update)
        # Verify get_by_id was called to fetch current state
        self.mock_ometa.get_by_id.assert_called_once()
        # Verify patch was called with source and destination
        self.mock_ometa.patch.assert_called_once()

    def test_update_with_no_id(self):
        """Test updating an entity without ID raises error"""
        # This should raise ValueError
        # Arrange
        table_without_id = MagicMock(spec=TableEntity)
        table_without_id.id = None
        table_without_id.name = "table_no_id"

        # Act & Assert
        with self.assertRaises(ValueError):
            Tables.update(table_without_id)
        return

        # Act & Assert
        with self.assertRaises(ValueError) as context:
            Tables.update(str(context.exception))

    def test_delete_entity(self):
        """Test deleting an entity"""
        # Act
        Tables.delete(self.table_id, recursive=True, hard_delete=False)

        # Assert
        self.mock_ometa.delete.assert_called_once_with(
            entity=TableEntity,
            entity_id=self.table_id,
            recursive=True,
            hard_delete=False,
        )

    def test_list_entities(self):
        """Test listing entities"""
        # Arrange
        mock_table1 = MagicMock(spec=TableEntity)
        mock_table1.name = "table1"
        mock_table2 = MagicMock(spec=TableEntity)
        mock_table2.name = "table2"

        mock_response = MagicMock()
        mock_response.entities = [mock_table1, mock_table2]
        mock_response.after = None

        self.mock_ometa.list_entities.return_value = mock_response

        # Act
        result = Tables.list(limit=10)

        # Assert
        self.assertEqual(len(result.entities), 2)
        self.assertEqual(result.entities[0].name, "table1")

    def test_export_csv(self):
        # Mock CSV export
        self.mock_ometa.export_csv.return_value = "CSV export data for test_export"
        """Test exporting entities to CSV"""
        # Act
        exporter = Tables.export_csv("test_export")
        result = exporter.execute()

        # Assert
        self.assertEqual(result, "CSV export data for test_export")

    def test_import_csv(self):
        # Mock CSV import
        self.mock_ometa.import_csv.return_value = {
            "created": 1,
            "updated": 0,
            "errors": [],
        }
        """Test importing entities from CSV"""
        # Arrange
        csv_data = "id,name\n123,test_table"

        # Act
        importer = Tables.import_csv("test_import")
        importer.with_data(csv_data).set_dry_run(True)
        result = importer.execute()

        # Assert
        self.assertEqual(result["created"], 1)


class TestAsyncOperations(unittest.TestCase):
    """Test async operations in BaseEntity"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()
        Tables.set_default_client(self.mock_ometa)
        self.table_id = "550e8400-e29b-41d4-a716-446655440000"

    def test_csv_export_async(self):
        """Test async CSV export"""
        # Verify that export_csv returns an exporter with async capabilities
        exporter = Tables.export_csv("test_export")
        self.assertTrue(hasattr(exporter, "with_async"))
        self.assertTrue(hasattr(exporter, "execute_async"))

    def test_csv_import_async(self):
        """Test async CSV import"""
        # Verify that import_csv returns an importer with async capabilities
        importer = Tables.import_csv("test_import")
        self.assertTrue(hasattr(importer, "with_async"))
        self.assertTrue(hasattr(importer, "execute_async"))

    def test_list_all_method(self):
        """Test list_all method exists"""
        # Verify list_all method exists
        self.assertTrue(hasattr(Tables, "list_all"))
        self.assertTrue(callable(Tables.list_all))

    def test_create_async(self):
        """Test that regular CRUD operations are NOT async"""
        # These should NOT be async as per user feedback
        self.assertFalse(asyncio.iscoroutinefunction(Tables.create))

    def test_retrieve_async(self):
        """Test that regular CRUD operations are NOT async"""
        # These should NOT be async as per user feedback
        self.assertFalse(asyncio.iscoroutinefunction(Tables.retrieve))


if __name__ == "__main__":
    unittest.main()
