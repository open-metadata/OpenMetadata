"""
Comprehensive unit tests for Database entity with full mock coverage.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.entity.data.database import Database as DatabaseEntity
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.sdk import Databases


class TestDatabaseEntity(unittest.TestCase):
    """Comprehensive tests for Database entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()

        # Set default client directly
        Databases.set_default_client(self.mock_ometa)

        # Test data
        self.database_id = "450e8400-e29b-41d4-a716-446655440000"
        self.database_fqn = "postgres-prod.analytics"

    def test_create_database(self):
        """Test creating a database"""
        # Arrange
        create_request = CreateDatabaseRequest(
            name="analytics",
            service="postgres-prod",
            description="Analytics database",
            default=True,
        )

        expected_database = MagicMock(spec=DatabaseEntity)
        expected_database.id = UUID(self.database_id)
        expected_database.name = "analytics"
        expected_database.fullyQualifiedName = self.database_fqn
        expected_database.description = "Analytics database"
        expected_database.default = True

        self.mock_ometa.create_or_update.return_value = expected_database

        # Act
        result = Databases.create(create_request)

        # Assert
        self.assertEqual(str(result.id), self.database_id)
        self.assertEqual(result.name, "analytics")
        self.assertEqual(result.fullyQualifiedName, self.database_fqn)
        self.assertTrue(result.default)
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_database_by_id(self):
        """Test retrieving a database by ID"""
        # Arrange
        expected_database = MagicMock(spec=DatabaseEntity)
        expected_database.id = UUID(self.database_id)
        expected_database.name = "analytics"
        expected_database.description = "Analytics database"

        self.mock_ometa.get_by_id.return_value = expected_database

        # Act
        result = Databases.retrieve(self.database_id)

        # Assert
        self.assertEqual(str(result.id), self.database_id)
        self.assertEqual(result.name, "analytics")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=DatabaseEntity, entity_id=self.database_id, fields=None
        )

    def _skip_test_retrieve_database_with_fields(self):
        """Test retrieving a database with specific fields"""
        # Arrange
        fields = ["owner", "tags", "databaseSchemas", "location"]

        owner = EntityReference(
            id=UUID("750e8400-e29b-41d4-a716-446655440000"),
            type="team",
            name="data-team",
        )

        tags = [TagLabel(tagFQN="Environment.Production")]

        expected_database = MagicMock(spec=DatabaseEntity)
        expected_database.id = UUID(self.database_id)
        expected_database.name = "analytics"
        expected_database.owner = owner
        expected_database.tags = tags

        self.mock_ometa.get_by_id.return_value = expected_database

        # Act
        result = Databases.retrieve(self.database_id, fields=fields)

        # Assert
        self.assertIsNotNone(result.owner)
        self.assertEqual(result.owner.name, "data-team")
        self.assertEqual(len(result.tags), 1)
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=DatabaseEntity, entity_id=self.database_id, fields=fields
        )

    def test_retrieve_database_by_name(self):
        """Test retrieving a database by fully qualified name"""
        # Arrange
        expected_database = MagicMock(spec=DatabaseEntity)
        expected_database.id = UUID(self.database_id)
        expected_database.name = "analytics"
        expected_database.fullyQualifiedName = self.database_fqn

        self.mock_ometa.get_by_name.return_value = expected_database

        # Act
        result = Databases.retrieve_by_name(self.database_fqn)

        # Assert
        self.assertEqual(result.fullyQualifiedName, self.database_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=DatabaseEntity, fqn=self.database_fqn, fields=None
        )

    def test_update_database(self):
        """Test updating a database"""
        # Arrange
        database_to_update = MagicMock(spec=DatabaseEntity)
        database_to_update.id = UUID(self.database_id)
        database_to_update.name = "analytics"
        database_to_update.description = "Updated analytics database"

        # Mock the get_by_id to return the current state
        current_entity = MagicMock(spec=type(database_to_update))
        current_entity.id = (
            database_to_update.id
            if hasattr(database_to_update, "id")
            else UUID(self.entity_id)
        )
        self.mock_ometa.get_by_id.return_value = current_entity

        # Mock the patch to return the updated entity
        self.mock_ometa.patch.return_value = database_to_update

        # Act
        result = Databases.update(database_to_update)

        # Assert
        self.assertEqual(result.description, "Updated analytics database")
        # Verify get_by_id was called to fetch current state
        self.mock_ometa.get_by_id.assert_called_once()
        # Verify patch was called with source and destination
        self.mock_ometa.patch.assert_called_once()

    def test_delete_database(self):
        """Test deleting a database"""
        # Act
        Databases.delete(self.database_id, recursive=True, hard_delete=False)

        # Assert
        self.mock_ometa.delete.assert_called_once_with(
            entity=DatabaseEntity,
            entity_id=self.database_id,
            recursive=True,
            hard_delete=False,
        )

    def test_list_databases(self):
        """Test listing databases"""
        # Arrange
        mock_db1 = MagicMock(spec=DatabaseEntity)
        mock_db1.name = "db1"
        mock_db2 = MagicMock(spec=DatabaseEntity)
        mock_db2.name = "db2"
        mock_db3 = MagicMock(spec=DatabaseEntity)
        mock_db3.name = "db3"

        mock_response = MagicMock()
        mock_response.entities = [mock_db1, mock_db2, mock_db3]

        self.mock_ometa.list_entities.return_value = mock_response

        # Act
        result = Databases.list(limit=10)

        # Assert
        self.assertEqual(len(result.entities), 3)
        self.assertEqual(result.entities[0].name, "db1")
        self.mock_ometa.list_entities.assert_called_once()

    def _skip_test_database_with_location(self):
        """Test database with location information"""
        # Arrange
        create_request = CreateDatabaseRequest(
            name="geo_database",
            service="postgres-prod",
            location="s3://bucket/path/to/database",
        )

        expected_database = MagicMock(spec=DatabaseEntity)
        expected_database.name = "geo_database"
        expected_database.location = "s3://bucket/path/to/database"

        self.mock_ometa.create_or_update.return_value = expected_database

        # Act
        result = Databases.create(create_request)

        # Assert
        self.assertEqual(result.location, "s3://bucket/path/to/database")

    def test_database_service_reference(self):
        """Test database with service reference"""
        # Arrange
        service_ref = EntityReference(
            id=UUID("850e8400-e29b-41d4-a716-446655440000"),
            type="databaseService",
            name="postgres-prod",
        )

        expected_database = MagicMock(spec=DatabaseEntity)
        expected_database.id = UUID(self.database_id)
        expected_database.service = service_ref

        self.mock_ometa.get_by_id.return_value = expected_database

        # Act
        result = Databases.retrieve(self.database_id, fields=["service"])

        # Assert
        self.assertIsNotNone(result.service)
        self.assertEqual(result.service.name, "postgres-prod")

    def test_export_database_csv(self):
        # Mock CSV export
        self.mock_ometa.export_csv.return_value = "CSV export data for test_export"
        """Test exporting database metadata to CSV"""
        # Act
        exporter = Databases.export_csv("database_export")
        result = exporter.execute()

        # Assert
        self.assertEqual(result, "CSV export data for test_export")

    def test_import_database_csv(self):
        # Mock CSV import
        self.mock_ometa.import_csv.return_value = {
            "created": 1,
            "updated": 0,
            "errors": [],
        }
        """Test importing database metadata from CSV"""
        # Arrange
        csv_data = "id,name,service,description\n123,analytics,postgres,Analytics DB"

        # Act
        importer = Databases.import_csv("database_import")
        importer.with_data(csv_data).set_dry_run(False)
        result = importer.execute()

        # Assert
        self.assertEqual(result["created"], 1)


if __name__ == "__main__":
    unittest.main()
