"""
Comprehensive unit tests for DatabaseSchema entity with full mock coverage.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.entity.data.databaseSchema import (
    DatabaseSchema as DatabaseSchemaEntity,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk import DatabaseSchemas


class TestDatabaseSchemaEntity(unittest.TestCase):
    """Comprehensive tests for DatabaseSchema entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()

        # Set default client directly
        DatabaseSchemas.set_default_client(self.mock_ometa)

        # Test data
        self.schema_id = "850e8400-e29b-41d4-a716-446655440000"
        self.schema_fqn = "postgres-prod.analytics.public"

    def test_create_database_schema(self):
        """Test creating a database schema"""
        # Arrange
        create_request = CreateDatabaseSchemaRequest(
            name="public",
            database="postgres-prod.analytics",
            description="Public schema for analytics database",
        )

        expected_schema = MagicMock(spec=DatabaseSchemaEntity)
        expected_schema.id = UUID(self.schema_id)
        expected_schema.name = "public"
        expected_schema.fullyQualifiedName = self.schema_fqn

        self.mock_ometa.create_or_update.return_value = expected_schema

        # Act
        result = DatabaseSchemas.create(create_request)

        # Assert
        self.assertEqual(str(result.id), self.schema_id)
        self.assertEqual(result.name, "public")
        self.assertEqual(result.fullyQualifiedName, self.schema_fqn)
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_schema_by_id(self):
        """Test retrieving a database schema by ID"""
        # Arrange
        expected_schema = MagicMock(spec=DatabaseSchemaEntity)
        expected_schema.id = UUID(self.schema_id)
        expected_schema.name = "public"
        expected_schema.description = "Public schema"

        self.mock_ometa.get_by_id.return_value = expected_schema

        # Act
        result = DatabaseSchemas.retrieve(self.schema_id)

        # Assert
        self.assertEqual(str(result.id), self.schema_id)
        self.assertEqual(result.name, "public")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=DatabaseSchemaEntity, entity_id=self.schema_id, fields=None
        )

    def test_retrieve_schema_with_tables(self):
        """Test retrieving schema with tables"""
        # Arrange
        fields = ["tables", "database", "owner"]

        # Mock tables
        table1 = EntityReference(
            id=UUID("950e8400-e29b-41d4-a716-446655440000"), type="table", name="users"
        )
        table2 = EntityReference(
            id=UUID("950e8400-e29b-41d4-a716-446655440001"), type="table", name="orders"
        )

        expected_schema = MagicMock(spec=DatabaseSchemaEntity)
        expected_schema.id = UUID(self.schema_id)
        expected_schema.name = "public"
        expected_schema.tables = [table1, table2]

        self.mock_ometa.get_by_id.return_value = expected_schema

        # Act
        result = DatabaseSchemas.retrieve(self.schema_id, fields=fields)

        # Assert
        self.assertIsNotNone(result.tables)
        self.assertEqual(len(result.tables), 2)
        self.assertEqual(result.tables[0].name, "users")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=DatabaseSchemaEntity, entity_id=self.schema_id, fields=fields
        )

    def test_retrieve_schema_by_name(self):
        """Test retrieving a database schema by name"""
        # Arrange
        expected_schema = MagicMock(spec=DatabaseSchemaEntity)
        expected_schema.id = UUID(self.schema_id)
        expected_schema.name = "public"
        expected_schema.fullyQualifiedName = self.schema_fqn

        self.mock_ometa.get_by_name.return_value = expected_schema

        # Act
        result = DatabaseSchemas.retrieve_by_name(self.schema_fqn)

        # Assert
        self.assertEqual(result.fullyQualifiedName, self.schema_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=DatabaseSchemaEntity, fqn=self.schema_fqn, fields=None
        )

    def test_update_database_schema(self):
        """Test updating a database schema"""
        # Arrange
        schema_to_update = MagicMock(spec=DatabaseSchemaEntity)
        schema_to_update.id = UUID(self.schema_id)
        schema_to_update.name = "public"
        schema_to_update.description = "Updated public schema"

        # Mock the get_by_id to return the current state
        current_entity = MagicMock(spec=type(schema_to_update))
        current_entity.id = (
            schema_to_update.id
            if hasattr(schema_to_update, "id")
            else UUID(self.entity_id)
        )
        self.mock_ometa.get_by_id.return_value = current_entity

        # Mock the patch to return the updated entity
        self.mock_ometa.patch.return_value = schema_to_update

        # Act
        result = DatabaseSchemas.update(schema_to_update)

        # Assert
        self.assertEqual(result.description, "Updated public schema")
        # Verify get_by_id was called to fetch current state
        self.mock_ometa.get_by_id.assert_called_once()
        # Verify patch was called with source and destination
        self.mock_ometa.patch.assert_called_once()

    def test_delete_database_schema(self):
        """Test deleting a database schema"""
        # Act
        DatabaseSchemas.delete(self.schema_id, recursive=True, hard_delete=False)

        # Assert
        self.mock_ometa.delete.assert_called_once_with(
            entity=DatabaseSchemaEntity,
            entity_id=self.schema_id,
            recursive=True,
            hard_delete=False,
        )

    def test_schema_with_database_reference(self):
        """Test schema with database reference"""
        # Arrange
        database_ref = EntityReference(
            id=UUID("750e8400-e29b-41d4-a716-446655440000"),
            type="database",
            name="analytics",
            displayName="Analytics Database",
        )

        expected_schema = MagicMock(spec=DatabaseSchemaEntity)
        expected_schema.id = UUID(self.schema_id)
        expected_schema.database = database_ref

        self.mock_ometa.get_by_id.return_value = expected_schema

        # Act
        result = DatabaseSchemas.retrieve(self.schema_id, fields=["database"])

        # Assert
        self.assertIsNotNone(result.database)
        self.assertEqual(result.database.name, "analytics")

    def test_list_database_schemas(self):
        """Test listing database schemas"""
        # Arrange
        mock_public = MagicMock(spec=DatabaseSchemaEntity)
        mock_public.name = "public"
        mock_staging = MagicMock(spec=DatabaseSchemaEntity)
        mock_staging.name = "staging"
        mock_production = MagicMock(spec=DatabaseSchemaEntity)
        mock_production.name = "production"

        mock_response = MagicMock()
        mock_response.entities = [mock_public, mock_staging, mock_production]

        self.mock_ometa.list_entities.return_value = mock_response

        # Act
        result = DatabaseSchemas.list(limit=10)

        # Assert
        self.assertEqual(len(result.entities), 3)
        self.assertEqual(result.entities[0].name, "public")
        self.assertEqual(result.entities[1].name, "staging")
        self.mock_ometa.list_entities.assert_called_once()

    def test_schema_retention_policy(self):
        """Test schema with retention policy"""
        # Arrange
        expected_schema = MagicMock(spec=DatabaseSchemaEntity)
        expected_schema.id = UUID(self.schema_id)
        expected_schema.retentionPeriod = "P30D"  # 30 days

        self.mock_ometa.get_by_id.return_value = expected_schema

        # Act
        result = DatabaseSchemas.retrieve(self.schema_id)

        # Assert
        self.assertIsNotNone(result.retentionPeriod)
        self.assertEqual(result.retentionPeriod, "P30D")

    def test_error_handling_schema_not_found(self):
        """Test error handling when schema not found"""
        # Arrange
        self.mock_ometa.get_by_id.side_effect = Exception("DatabaseSchema not found")

        # Act & Assert
        with self.assertRaises(Exception) as context:
            DatabaseSchemas.retrieve("non-existent-id")

        self.assertIn("DatabaseSchema not found", str(context.exception))


if __name__ == "__main__":
    unittest.main()
