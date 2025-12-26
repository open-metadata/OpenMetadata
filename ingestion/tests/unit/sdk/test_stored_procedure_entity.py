"""
Comprehensive unit tests for Stored Procedure entity.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.storedProcedure import (
    StoredProcedure as StoredProcedureEntity,
)
from metadata.sdk import StoredProcedures


class TestStoredProcedureEntity(unittest.TestCase):
    """Comprehensive tests for StoredProcedure entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()
        StoredProcedures.set_default_client(self.mock_ometa)

        self.entity_id = "550e8400-e29b-41d4-a716-446655440000"
        self.entity_fqn = "service.stored_procedure.test_stored_procedure"

    def test_create_stored_procedure(self):
        """Test creating a stored procedure"""
        create_request = MagicMock(spec=CreateStoredProcedureRequest)
        create_request.name = "test_stored_procedure"
        create_request.displayName = "Test Stored Procedure"
        create_request.description = "Test stored procedure for unit tests"

        expected_entity = MagicMock(spec=StoredProcedureEntity)
        expected_entity.id = UUID(self.entity_id)
        expected_entity.name = "test_stored_procedure"

        self.mock_ometa.create_or_update.return_value = expected_entity

        result = StoredProcedures.create(create_request)

        self.assertEqual(str(result.id), self.entity_id)
        self.assertEqual(result.name, "test_stored_procedure")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_stored_procedure_by_id(self):
        """Test retrieving a stored procedure by ID"""
        expected_entity = MagicMock(spec=StoredProcedureEntity)
        expected_entity.id = UUID(self.entity_id)
        expected_entity.name = "test_stored_procedure"

        self.mock_ometa.get_by_id.return_value = expected_entity

        result = StoredProcedures.retrieve(self.entity_id)

        self.assertEqual(str(result.id), self.entity_id)
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=StoredProcedureEntity, entity_id=self.entity_id, fields=None
        )

    def test_retrieve_stored_procedure_by_name(self):
        """Test retrieving a stored procedure by name"""
        expected_entity = MagicMock(spec=StoredProcedureEntity)
        expected_entity.fullyQualifiedName = self.entity_fqn

        self.mock_ometa.get_by_name.return_value = expected_entity

        result = StoredProcedures.retrieve_by_name(self.entity_fqn)

        self.assertEqual(result.fullyQualifiedName, self.entity_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=StoredProcedureEntity, fqn=self.entity_fqn, fields=None
        )

    def test_update_stored_procedure(self):
        """Test updating a stored procedure"""
        entity_to_update = MagicMock(spec=StoredProcedureEntity)
        entity_to_update.id = UUID(self.entity_id)
        entity_to_update.description = "Updated description"

        # Mock the get_by_id to return the current state
        current_entity = MagicMock(spec=type(entity_to_update))
        current_entity.id = (
            entity_to_update.id
            if hasattr(entity_to_update, "id")
            else UUID(self.entity_id)
        )
        self.mock_ometa.get_by_id.return_value = current_entity

        # Mock the patch to return the updated entity
        self.mock_ometa.patch.return_value = entity_to_update

        result = StoredProcedures.update(entity_to_update)

        self.assertEqual(result.description, "Updated description")
        # Verify get_by_id was called to fetch current state
        self.mock_ometa.get_by_id.assert_called_once()
        # Verify patch was called with source and destination
        self.mock_ometa.patch.assert_called_once()

    def test_delete_stored_procedure(self):
        """Test deleting a stored procedure"""
        StoredProcedures.delete(self.entity_id, recursive=True, hard_delete=False)

        self.mock_ometa.delete.assert_called_once_with(
            entity=StoredProcedureEntity,
            entity_id=self.entity_id,
            recursive=True,
            hard_delete=False,
        )

    def test_list_stored_procedures(self):
        """Test listing stored procedures"""
        mock_entity1 = MagicMock(spec=StoredProcedureEntity)
        mock_entity1.name = "entity1"
        mock_entity2 = MagicMock(spec=StoredProcedureEntity)
        mock_entity2.name = "entity2"

        mock_response = MagicMock()
        mock_response.entities = [mock_entity1, mock_entity2]

        self.mock_ometa.list_entities.return_value = mock_response

        result = StoredProcedures.list(limit=10)

        self.assertEqual(len(result.entities), 2)
        self.assertEqual(result.entities[0].name, "entity1")
        self.mock_ometa.list_entities.assert_called_once()


if __name__ == "__main__":
    unittest.main()
