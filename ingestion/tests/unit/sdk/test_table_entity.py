"""
Comprehensive unit tests for Table entity with full mock coverage.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, ConstraintType, DataType
from metadata.generated.schema.entity.data.table import Table as TableEntity
from metadata.generated.schema.entity.data.table import TableConstraint, TableType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.sdk import Tables


class TestTableEntity(unittest.TestCase):
    """Comprehensive tests for Table entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()

        # Set default client directly
        Tables.set_default_client(self.mock_ometa)

        # Test data
        self.table_id = "550e8400-e29b-41d4-a716-446655440000"
        self.table_fqn = "service.database.schema.test_table"

        # Sample columns for table
        self.columns = [
            Column(name="id", dataType=DataType.INT, description="Primary key"),
            Column(
                name="email",
                dataType=DataType.VARCHAR,
                dataLength=255,
                description="User email",
            ),
            Column(
                name="created_at",
                dataType=DataType.TIMESTAMP,
                description="Creation timestamp",
            ),
        ]

    def test_create_table(self):
        """Test creating a table"""
        # Arrange
        create_request = CreateTableRequest(
            name="test_table",
            databaseSchema="database.schema",
            columns=self.columns,
            description="Test table for unit tests",
            tableType=TableType.Regular,
        )

        expected_table = MagicMock(spec=TableEntity)
        expected_table.id = UUID(self.table_id)
        expected_table.name = "test_table"
        expected_table.fullyQualifiedName = self.table_fqn
        expected_table.columns = self.columns
        expected_table.tableType = TableType.Regular

        self.mock_ometa.create_or_update.return_value = expected_table

        # Act
        result = Tables.create(create_request)

        # Assert
        self.assertEqual(result.id, expected_table.id)
        self.assertEqual(result.name, "test_table")
        self.assertEqual(result.fullyQualifiedName, self.table_fqn)
        self.assertEqual(len(result.columns), 3)
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_table_by_id(self):
        """Test retrieving a table by ID"""
        # Arrange
        expected_table = MagicMock(spec=TableEntity)
        expected_table.id = UUID(self.table_id)
        expected_table.name = "test_table"
        expected_table.description = "Retrieved table"
        expected_table.columns = self.columns

        self.mock_ometa.get_by_id.return_value = expected_table

        # Act
        result = Tables.retrieve(self.table_id)

        # Assert
        self.assertEqual(result.id, expected_table.id)
        self.assertEqual(result.description, "Retrieved table")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=TableEntity, entity_id=self.table_id, fields=None
        )

    def _skip_test_retrieve_table_with_fields(self):
        """Test retrieving a table with specific fields"""
        # Arrange
        fields = ["owner", "tags", "columns", "joins", "sampleData"]

        # Create owner reference
        owner = EntityReference(
            id=UUID("750e8400-e29b-41d4-a716-446655440000"),
            type="user",
            name="john.doe",
        )

        # Create tags
        tags = [
            TagLabel(tagFQN="PII.Sensitive", labelType="Manual"),
            TagLabel(tagFQN="Tier.Tier1", labelType="Manual"),
        ]

        expected_table = MagicMock(spec=TableEntity)
        expected_table.id = UUID(self.table_id)
        expected_table.name = "test_table"
        expected_table.owner = owner
        expected_table.tags = tags
        expected_table.columns = self.columns

        self.mock_ometa.get_by_id.return_value = expected_table

        # Act
        result = Tables.retrieve(self.table_id, fields=fields)

        # Assert
        self.assertIsNotNone(result.owner)
        self.assertEqual(result.owner.name, "john.doe")
        self.assertEqual(len(result.tags), 2)
        self.assertEqual(result.tags[0].tagFQN, "PII.Sensitive")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=TableEntity, entity_id=self.table_id, fields=fields
        )

    def test_retrieve_table_by_name(self):
        """Test retrieving a table by fully qualified name"""
        # Arrange
        expected_table = MagicMock(spec=TableEntity)
        expected_table.id = UUID(self.table_id)
        expected_table.name = "test_table"
        expected_table.fullyQualifiedName = self.table_fqn
        expected_table.columns = self.columns

        self.mock_ometa.get_by_name.return_value = expected_table

        # Act
        result = Tables.retrieve_by_name(self.table_fqn)

        # Assert
        self.assertEqual(result.fullyQualifiedName, self.table_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=TableEntity, fqn=self.table_fqn, fields=None
        )

    def test_update_table(self):
        """Test updating a table (PUT operation)"""
        # Arrange
        table_to_update = MagicMock(spec=TableEntity)
        table_to_update.id = UUID(self.table_id)
        table_to_update.name = "test_table"
        table_to_update.description = "Updated description"
        table_to_update.columns = self.columns

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

        # Assert
        self.assertEqual(result.description, "Updated description")
        self.assertEqual(str(table_to_update.id), self.table_id)
        # Verify get_by_id was called to fetch current state
        self.mock_ometa.get_by_id.assert_called_once()
        # Verify patch was called with source and destination
        self.mock_ometa.patch.assert_called_once()

    def test_delete_table(self):
        """Test deleting a table"""
        # Act
        Tables.delete(self.table_id, recursive=True, hard_delete=False)

        # Assert
        self.mock_ometa.delete.assert_called_once_with(
            entity=TableEntity,
            entity_id=self.table_id,
            recursive=True,
            hard_delete=False,
        )

    def test_delete_table_hard(self):
        """Test hard deleting a table"""
        # Act
        Tables.delete(self.table_id, recursive=False, hard_delete=True)

        # Assert
        self.mock_ometa.delete.assert_called_once_with(
            entity=TableEntity,
            entity_id=self.table_id,
            recursive=False,
            hard_delete=True,
        )

    def test_table_with_constraints(self):
        """Test table with constraints"""
        # Arrange
        constraints = [
            TableConstraint(constraintType=ConstraintType.PRIMARY_KEY, columns=["id"]),
            TableConstraint(constraintType=ConstraintType.UNIQUE, columns=["email"]),
        ]

        create_request = CreateTableRequest(
            name="constrained_table",
            databaseSchema="database.schema",
            columns=self.columns,
            tableConstraints=constraints,
        )

        expected_table = MagicMock(spec=TableEntity)
        expected_table.id = UUID(self.table_id)
        expected_table.name = "constrained_table"
        expected_table.tableConstraints = constraints
        expected_table.columns = self.columns

        self.mock_ometa.create_or_update.return_value = expected_table

        # Act
        result = Tables.create(create_request)

        # Assert
        self.assertEqual(len(result.tableConstraints), 2)
        self.assertEqual(
            result.tableConstraints[0].constraintType, ConstraintType.PRIMARY_KEY
        )
        self.assertEqual(
            result.tableConstraints[1].constraintType, ConstraintType.UNIQUE
        )

    def test_table_with_joins(self):
        """Test retrieving table with join information"""
        # Arrange
        join_info = MagicMock()
        join_info.startDate = "2024-01-01"
        join_info.dayCount = 30
        join_info.columnJoins = []

        expected_table = MagicMock(spec=TableEntity)
        expected_table.id = UUID(self.table_id)
        expected_table.name = "test_table"
        expected_table.joins = join_info
        expected_table.columns = self.columns

        self.mock_ometa.get_by_id.return_value = expected_table

        # Act
        result = Tables.retrieve(self.table_id, fields=["joins"])

        # Assert
        self.assertIsNotNone(result.joins)
        self.assertEqual(result.joins.dayCount, 30)

    def test_export_table_csv(self):
        """Test exporting table metadata to CSV"""
        # Arrange
        csv_data = "id,name,description,columns\n123,test_table,Test,3"
        self.mock_ometa.export_csv.return_value = csv_data

        # Act
        exporter = result = Tables.export_csv("table_export")
        result = exporter.execute()

        # Assert
        self.assertEqual(result, csv_data)
        self.mock_ometa.export_csv.assert_called_once_with(
            entity=TableEntity, name="table_export"
        )

    def test_import_table_csv(self):
        # Mock CSV import
        self.mock_ometa.import_csv.return_value = {
            "created": 1,
            "updated": 0,
            "errors": [],
        }
        """Test importing table metadata from CSV"""
        # Arrange
        csv_data = "id,name\n123,test_table"

        # Act
        importer = Tables.import_csv("table_import")
        importer.csv_data = csv_data
        importer.dry_run = False
        result = importer.execute()

        # Assert
        self.assertEqual(result["created"], 1)
        self.mock_ometa.import_csv.assert_called_once_with(
            entity=TableEntity, name="table_import", csv_data=csv_data, dry_run=False
        )

    def test_error_handling_not_found(self):
        """Test error handling when table not found"""
        # Arrange
        self.mock_ometa.get_by_id.side_effect = Exception("Table not found")

        # Act & Assert
        with self.assertRaises(Exception) as context:
            Tables.retrieve("non-existent-id")

        self.assertIn("Table not found", str(context.exception))


if __name__ == "__main__":
    unittest.main()
