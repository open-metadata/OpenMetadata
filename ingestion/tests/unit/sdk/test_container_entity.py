"""
Comprehensive unit tests for Container entity with full mock coverage.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.entity.data.container import Container as ContainerEntity
from metadata.generated.schema.entity.data.container import (
    ContainerDataModel,
    FileFormat,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk import Containers


class TestContainerEntity(unittest.TestCase):
    """Comprehensive tests for Container entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()

        # Set default client directly
        Containers.set_default_client(self.mock_ometa)

        # Test data
        self.container_id = "650e8400-e29b-41d4-a716-446655440000"
        self.container_fqn = "s3-prod.analytics-bucket"

    def test_create_container(self):
        """Test creating a container"""
        # Arrange
        create_request = CreateContainerRequest(
            name="analytics-bucket",
            service="s3-prod",
            displayName="Analytics Bucket",
            description="S3 bucket for analytics data",
            fileFormats=[FileFormat.parquet, FileFormat.csv],
        )

        expected_container = MagicMock(spec=ContainerEntity)
        expected_container.id = UUID(self.container_id)
        expected_container.name = "analytics-bucket"
        expected_container.fullyQualifiedName = self.container_fqn
        expected_container.fileFormats = [FileFormat.parquet, FileFormat.csv]

        self.mock_ometa.create_or_update.return_value = expected_container

        # Act
        result = Containers.create(create_request)

        # Assert
        self.assertEqual(str(result.id), self.container_id)
        self.assertEqual(result.name, "analytics-bucket")
        self.assertEqual(result.fullyQualifiedName, self.container_fqn)
        self.assertEqual(len(result.fileFormats), 2)
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_container_by_id(self):
        """Test retrieving a container by ID"""
        # Arrange
        expected_container = MagicMock(spec=ContainerEntity)
        expected_container.id = UUID(self.container_id)
        expected_container.name = "analytics-bucket"
        expected_container.description = "Analytics data storage"

        self.mock_ometa.get_by_id.return_value = expected_container

        # Act
        result = Containers.retrieve(self.container_id)

        # Assert
        self.assertEqual(str(result.id), self.container_id)
        self.assertEqual(result.name, "analytics-bucket")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=ContainerEntity, entity_id=self.container_id, fields=None
        )

    def test_retrieve_container_with_children(self):
        """Test retrieving container with child containers"""
        # Arrange
        fields = ["children", "parent", "dataModel"]

        # Mock child containers
        child1 = EntityReference(
            id=UUID("750e8400-e29b-41d4-a716-446655440001"),
            type="container",
            name="raw-data",
        )
        child2 = EntityReference(
            id=UUID("750e8400-e29b-41d4-a716-446655440002"),
            type="container",
            name="processed-data",
        )

        expected_container = MagicMock(spec=ContainerEntity)
        expected_container.id = UUID(self.container_id)
        expected_container.name = "analytics-bucket"
        expected_container.children = [child1, child2]

        self.mock_ometa.get_by_id.return_value = expected_container

        # Act
        result = Containers.retrieve(self.container_id, fields=fields)

        # Assert
        self.assertIsNotNone(result.children)
        self.assertEqual(len(result.children), 2)
        self.assertEqual(result.children[0].name, "raw-data")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=ContainerEntity, entity_id=self.container_id, fields=fields
        )

    def test_retrieve_container_by_name(self):
        """Test retrieving a container by name"""
        # Arrange
        expected_container = MagicMock(spec=ContainerEntity)
        expected_container.id = UUID(self.container_id)
        expected_container.name = "analytics-bucket"
        expected_container.fullyQualifiedName = self.container_fqn

        self.mock_ometa.get_by_name.return_value = expected_container

        # Act
        result = Containers.retrieve_by_name(self.container_fqn)

        # Assert
        self.assertEqual(result.fullyQualifiedName, self.container_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=ContainerEntity, fqn=self.container_fqn, fields=None
        )

    def test_update_container(self):
        """Test updating a container"""
        # Arrange
        container_to_update = MagicMock(spec=ContainerEntity)
        container_to_update.id = UUID(self.container_id)
        container_to_update.name = "analytics-bucket"
        container_to_update.description = "Updated analytics bucket"

        # Mock the get_by_id to return the current state
        current_entity = MagicMock(spec=type(container_to_update))
        current_entity.id = (
            container_to_update.id
            if hasattr(container_to_update, "id")
            else UUID(self.entity_id)
        )
        self.mock_ometa.get_by_id.return_value = current_entity

        # Mock the patch to return the updated entity
        self.mock_ometa.patch.return_value = container_to_update

        # Act
        result = Containers.update(container_to_update)

        # Assert
        self.assertEqual(result.description, "Updated analytics bucket")
        # Verify get_by_id was called to fetch current state
        self.mock_ometa.get_by_id.assert_called_once()
        # Verify patch was called with source and destination
        self.mock_ometa.patch.assert_called_once()

    def test_delete_container(self):
        """Test deleting a container"""
        # Act
        Containers.delete(self.container_id, recursive=True, hard_delete=False)

        # Assert
        self.mock_ometa.delete.assert_called_once_with(
            entity=ContainerEntity,
            entity_id=self.container_id,
            recursive=True,
            hard_delete=False,
        )

    def test_container_with_data_model(self):
        """Test container with data model"""
        # Arrange
        data_model = MagicMock(spec=ContainerDataModel)
        data_model.isPartitioned = True

        expected_container = MagicMock(spec=ContainerEntity)
        expected_container.id = UUID(self.container_id)
        expected_container.dataModel = data_model

        self.mock_ometa.get_by_id.return_value = expected_container

        # Act
        result = Containers.retrieve(self.container_id, fields=["dataModel"])

        # Assert
        self.assertIsNotNone(result.dataModel)
        self.assertEqual(result.dataModel.isPartitioned, True)

    def test_container_hierarchy(self):
        """Test container with parent reference"""
        # Arrange
        parent_ref = EntityReference(
            id=UUID("550e8400-e29b-41d4-a716-446655440000"),
            type="container",
            name="data-lake",
        )

        expected_container = MagicMock(spec=ContainerEntity)
        expected_container.id = UUID(self.container_id)
        expected_container.parent = parent_ref

        self.mock_ometa.get_by_id.return_value = expected_container

        # Act
        result = Containers.retrieve(self.container_id, fields=["parent"])

        # Assert
        self.assertIsNotNone(result.parent)
        self.assertEqual(result.parent.name, "data-lake")

    def test_container_with_prefix(self):
        """Test container with prefix path"""
        # Arrange
        create_request = CreateContainerRequest(
            name="partitioned-data",
            service="s3-prod",
            prefix="/data/year=2024/month=01/",
        )

        expected_container = MagicMock(spec=ContainerEntity)
        expected_container.name = "partitioned-data"
        expected_container.prefix = "/data/year=2024/month=01/"

        self.mock_ometa.create_or_update.return_value = expected_container

        # Act
        result = Containers.create(create_request)

        # Assert
        self.assertEqual(result.prefix, "/data/year=2024/month=01/")

    def test_list_containers(self):
        """Test listing containers with pagination"""
        # Arrange
        mock_bucket1 = MagicMock(spec=ContainerEntity)
        mock_bucket1.name = "bucket1"
        mock_bucket2 = MagicMock(spec=ContainerEntity)
        mock_bucket2.name = "bucket2"
        mock_bucket3 = MagicMock(spec=ContainerEntity)
        mock_bucket3.name = "bucket3"

        mock_response = MagicMock()
        mock_response.entities = [mock_bucket1, mock_bucket2, mock_bucket3]

        self.mock_ometa.list_entities.return_value = mock_response

        # Act
        result = Containers.list(limit=25, after="cursor456")

        # Assert
        self.assertEqual(len(result.entities), 3)
        self.assertEqual(result.entities[0].name, "bucket1")
        self.mock_ometa.list_entities.assert_called_once()

    def test_container_size_and_objects(self):
        """Test container with size and object count"""
        # Arrange
        expected_container = MagicMock(spec=ContainerEntity)
        expected_container.id = UUID(self.container_id)
        expected_container.size = 1073741824  # 1GB in bytes
        expected_container.numberOfObjects = 1500

        self.mock_ometa.get_by_id.return_value = expected_container

        # Act
        result = Containers.retrieve(self.container_id)

        # Assert
        self.assertEqual(result.size, 1073741824)
        self.assertEqual(result.numberOfObjects, 1500)

    def test_error_handling_container_not_found(self):
        """Test error handling when container not found"""
        # Arrange
        self.mock_ometa.get_by_id.side_effect = Exception("Container not found")

        # Act & Assert
        with self.assertRaises(Exception) as context:
            Containers.retrieve("non-existent-id")

        self.assertIn("Container not found", str(context.exception))


if __name__ == "__main__":
    unittest.main()
