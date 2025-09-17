"""
Comprehensive unit tests for Query entity.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.entity.data.query import Query as QueryEntity
from metadata.sdk.entities.queries import Queries


class TestQueryEntity(unittest.TestCase):
    """Comprehensive tests for Query entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()
        Query._default_client = self.mock_ometa

        self.entity_id = "550e8400-e29b-41d4-a716-446655440000"
        self.entity_fqn = "service.query.test_query"

    def test_create_query(self):
        """Test creating a query"""
        create_request = MagicMock(spec=CreateQueryRequest)
        create_request.name = "test_query"
        create_request.displayName = "Test Query"
        create_request.description = "Test query for unit tests"

        expected_entity = MagicMock(spec=QueryEntity)
        expected_entity.id = UUID(self.entity_id)
        expected_entity.name = "test_query"

        self.mock_ometa.create_or_update.return_value = expected_entity

        result = Queries.create(create_request)

        self.assertEqual(str(result.id), self.entity_id)
        self.assertEqual(result.name, "test_query")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_query_by_id(self):
        """Test retrieving a query by ID"""
        expected_entity = MagicMock(spec=QueryEntity)
        expected_entity.id = UUID(self.entity_id)
        expected_entity.name = "test_query"

        self.mock_ometa.get_by_id.return_value = expected_entity

        result = Queries.retrieve(self.entity_id)

        self.assertEqual(str(result.id), self.entity_id)
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=QueryEntity, entity_id=self.entity_id, fields=None
        )

    def test_retrieve_query_by_name(self):
        """Test retrieving a query by name"""
        expected_entity = MagicMock(spec=QueryEntity)
        expected_entity.fullyQualifiedName = self.entity_fqn

        self.mock_ometa.get_by_name.return_value = expected_entity

        result = Queries.retrieve_by_name(self.entity_fqn)

        self.assertEqual(result.fullyQualifiedName, self.entity_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=QueryEntity, fqn=self.entity_fqn, fields=None
        )

    def test_update_query(self):
        """Test updating a query"""
        entity_to_update = MagicMock(spec=QueryEntity)
        entity_to_update.id = UUID(self.entity_id)
        entity_to_update.description = "Updated description"

        self.mock_ometa.create_or_update.return_value = entity_to_update

        result = Queries.update(entity_to_update)

        self.assertEqual(result.description, "Updated description")
        self.mock_ometa.create_or_update.assert_called_once_with(entity_to_update)

    def test_patch_query(self):
        """Test patching a query"""
        json_patch = [
            {"op": "add", "path": "/description", "value": "Patched description"},
            {"op": "add", "path": "/tags/0", "value": {"tagFQN": "Important.High"}},
        ]

        patched_entity = MagicMock(spec=QueryEntity)
        patched_entity.id = UUID(self.entity_id)
        patched_entity.description = "Patched description"

        self.mock_ometa.patch.return_value = patched_entity

        result = Queries.patch(self.entity_id, json_patch)

        self.assertEqual(result.description, "Patched description")
        self.mock_ometa.patch.assert_called_once_with(
            entity=QueryEntity, entity_id=self.entity_id, json_patch=json_patch
        )

    def test_delete_query(self):
        """Test deleting a query"""
        Queries.delete(self.entity_id, recursive=True, hard_delete=False)

        self.mock_ometa.delete.assert_called_once_with(
            entity=QueryEntity,
            entity_id=self.entity_id,
            recursive=True,
            hard_delete=False,
        )

    def test_list_querys(self):
        """Test listing querys"""
        mock_entity1 = MagicMock(spec=QueryEntity)
        mock_entity1.name = "entity1"
        mock_entity2 = MagicMock(spec=QueryEntity)
        mock_entity2.name = "entity2"

        mock_response = MagicMock()
        mock_response.entities = [mock_entity1, mock_entity2]

        self.mock_ometa.list_entities.return_value = mock_response

        result = Queries.list(limit=10)

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].name, "entity1")
        self.mock_ometa.list_entities.assert_called_once()


if __name__ == "__main__":
    unittest.main()
