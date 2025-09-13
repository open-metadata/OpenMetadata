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
from metadata.sdk.entities.table_improved import Table


class TestBaseEntity(unittest.TestCase):
    """Test BaseEntity operations using Table as example"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()

        # Set the default client
        Table._default_client = self.mock_ometa

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
        result = Table.create(create_request)

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
        result = Table.retrieve(self.table_id)

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
        result = Table.retrieve(self.table_id, fields=fields)

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
        result = Table.retrieve_by_name(self.table_fqn)

        # Assert
        self.assertEqual(result.fullyQualifiedName, self.table_fqn)
        self.mock_ometa.get_by_name.assert_called_once()

    def test_update_entity(self):
        """Test updating an entity"""
        # Arrange
        table_to_update = MagicMock(spec=TableEntity)
        table_to_update.id = UUID(self.table_id)
        table_to_update.name = "updated_table"

        self.mock_ometa.create_or_update.return_value = table_to_update

        # Act
        result = Table.update(self.table_id, table_to_update)

        # Assert
        self.assertEqual(result.name, "updated_table")
        self.mock_ometa.create_or_update.assert_called_once_with(table_to_update)

    def test_patch_entity(self):
        """Test patching an entity"""
        # Arrange
        json_patch = [
            {"op": "add", "path": "/description", "value": "Test description"}
        ]
        patched_table = MagicMock(spec=TableEntity)
        patched_table.id = UUID(self.table_id)
        patched_table.description = "Test description"

        self.mock_ometa.patch.return_value = patched_table

        # Act
        result = Table.patch(self.table_id, json_patch)

        # Assert
        self.assertEqual(result.description, "Test description")
        self.mock_ometa.patch.assert_called_once()

    def test_delete_entity(self):
        """Test deleting an entity"""
        # Act
        Table.delete(self.table_id, recursive=True, hard_delete=False)

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

        self.mock_ometa.list_entities.return_value = mock_response

        # Act
        result = Table.list(limit=10)

        # Assert
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].name, "table1")

    def test_export_csv(self):
        """Test exporting entities to CSV"""
        # Arrange
        csv_data = "id,name\n123,test_table"
        self.mock_ometa.export_csv.return_value = csv_data

        # Act
        result = Table.export_csv("test_export")

        # Assert
        self.assertEqual(result, csv_data)
        self.mock_ometa.export_csv.assert_called_once()

    def test_import_csv(self):
        """Test importing entities from CSV"""
        # Arrange
        csv_data = "id,name\n123,test_table"
        import_status = "Successfully imported 1 table"
        self.mock_ometa.import_csv.return_value = import_status

        # Act
        result = Table.import_csv(csv_data, dry_run=True)

        # Assert
        self.assertEqual(result, import_status)
        self.mock_ometa.import_csv.assert_called_once()


class TestAsyncOperations(unittest.TestCase):
    """Test async operations in BaseEntity"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()
        Table._default_client = self.mock_ometa
        self.table_id = "550e8400-e29b-41d4-a716-446655440000"

    def test_create_async(self):
        """Test async create"""
        # Verify async method exists and is callable
        self.assertTrue(asyncio.iscoroutinefunction(Table.create_async))

    def test_retrieve_async(self):
        """Test async retrieve"""
        # Verify async method exists and is callable
        self.assertTrue(asyncio.iscoroutinefunction(Table.retrieve_async))

    def test_update_async(self):
        """Test async update"""
        # Verify async method exists and is callable
        self.assertTrue(asyncio.iscoroutinefunction(Table.update_async))

    def test_patch_async(self):
        """Test async patch"""
        # Verify async method exists and is callable
        self.assertTrue(asyncio.iscoroutinefunction(Table.patch_async))

    def test_delete_async(self):
        """Test async delete"""
        # Verify async method exists and is callable
        self.assertTrue(asyncio.iscoroutinefunction(Table.delete_async))


if __name__ == "__main__":
    unittest.main()
