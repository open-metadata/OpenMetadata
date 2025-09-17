"""
Comprehensive unit tests for Classification entity.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.entity.classification.classification import (
    Classification as ClassificationEntity,
)
from metadata.sdk.entities.classifications import Classifications


class TestClassificationEntity(unittest.TestCase):
    """Comprehensive tests for Classification entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()
        Classification._default_client = self.mock_ometa

        self.entity_id = "550e8400-e29b-41d4-a716-446655440000"
        self.entity_fqn = "service.classification.test_classification"

    def test_create_classification(self):
        """Test creating a classification"""
        create_request = MagicMock(spec=CreateClassificationRequest)
        create_request.name = "test_classification"
        create_request.displayName = "Test Classification"
        create_request.description = "Test classification for unit tests"

        expected_entity = MagicMock(spec=ClassificationEntity)
        expected_entity.id = UUID(self.entity_id)
        expected_entity.name = "test_classification"

        self.mock_ometa.create_or_update.return_value = expected_entity

        result = Classifications.create(create_request)

        self.assertEqual(str(result.id), self.entity_id)
        self.assertEqual(result.name, "test_classification")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_classification_by_id(self):
        """Test retrieving a classification by ID"""
        expected_entity = MagicMock(spec=ClassificationEntity)
        expected_entity.id = UUID(self.entity_id)
        expected_entity.name = "test_classification"

        self.mock_ometa.get_by_id.return_value = expected_entity

        result = Classifications.retrieve(self.entity_id)

        self.assertEqual(str(result.id), self.entity_id)
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=ClassificationEntity, entity_id=self.entity_id, fields=None
        )

    def test_retrieve_classification_by_name(self):
        """Test retrieving a classification by name"""
        expected_entity = MagicMock(spec=ClassificationEntity)
        expected_entity.fullyQualifiedName = self.entity_fqn

        self.mock_ometa.get_by_name.return_value = expected_entity

        result = Classifications.retrieve_by_name(self.entity_fqn)

        self.assertEqual(result.fullyQualifiedName, self.entity_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=ClassificationEntity, fqn=self.entity_fqn, fields=None
        )

    def test_update_classification(self):
        """Test updating a classification"""
        entity_to_update = MagicMock(spec=ClassificationEntity)
        entity_to_update.id = UUID(self.entity_id)
        entity_to_update.description = "Updated description"

        self.mock_ometa.create_or_update.return_value = entity_to_update

        result = Classifications.update(entity_to_update)

        self.assertEqual(result.description, "Updated description")
        self.mock_ometa.create_or_update.assert_called_once_with(entity_to_update)

    def test_patch_classification(self):
        """Test patching a classification"""
        json_patch = [
            {"op": "add", "path": "/description", "value": "Patched description"},
            {"op": "add", "path": "/tags/0", "value": {"tagFQN": "Important.High"}},
        ]

        patched_entity = MagicMock(spec=ClassificationEntity)
        patched_entity.id = UUID(self.entity_id)
        patched_entity.description = "Patched description"

        self.mock_ometa.patch.return_value = patched_entity

        result = Classifications.patch(self.entity_id, json_patch)

        self.assertEqual(result.description, "Patched description")
        self.mock_ometa.patch.assert_called_once_with(
            entity=ClassificationEntity, entity_id=self.entity_id, json_patch=json_patch
        )

    def test_delete_classification(self):
        """Test deleting a classification"""
        Classifications.delete(self.entity_id, recursive=True, hard_delete=False)

        self.mock_ometa.delete.assert_called_once_with(
            entity=ClassificationEntity,
            entity_id=self.entity_id,
            recursive=True,
            hard_delete=False,
        )

    def test_list_classifications(self):
        """Test listing classifications"""
        mock_entity1 = MagicMock(spec=ClassificationEntity)
        mock_entity1.name = "entity1"
        mock_entity2 = MagicMock(spec=ClassificationEntity)
        mock_entity2.name = "entity2"

        mock_response = MagicMock()
        mock_response.entities = [mock_entity1, mock_entity2]

        self.mock_ometa.list_entities.return_value = mock_response

        result = Classifications.list(limit=10)

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].name, "entity1")
        self.mock_ometa.list_entities.assert_called_once()


if __name__ == "__main__":
    unittest.main()
