"""
Comprehensive unit tests for Data Product entity.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.domains.createDataProduct import (
    CreateDataProductRequest,
)
from metadata.generated.schema.entity.domains.dataProduct import (
    DataProduct as DataProductEntity,
)
from metadata.sdk import DataProducts


class TestDataProductEntity(unittest.TestCase):
    """Comprehensive tests for DataProduct entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()
        DataProducts.set_default_client(self.mock_ometa)

        self.entity_id = "550e8400-e29b-41d4-a716-446655440000"
        self.entity_fqn = "service.data_product.test_data_product"

    def test_create_data_product(self):
        """Test creating a data product"""
        create_request = MagicMock(spec=CreateDataProductRequest)
        create_request.name = "test_data_product"
        create_request.displayName = "Test Data Product"
        create_request.description = "Test data product for unit tests"

        expected_entity = MagicMock(spec=DataProductEntity)
        expected_entity.id = UUID(self.entity_id)
        expected_entity.name = "test_data_product"

        self.mock_ometa.create_or_update.return_value = expected_entity

        result = DataProducts.create(create_request)

        self.assertEqual(str(result.id), self.entity_id)
        self.assertEqual(result.name, "test_data_product")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_data_product_by_id(self):
        """Test retrieving a data product by ID"""
        expected_entity = MagicMock(spec=DataProductEntity)
        expected_entity.id = UUID(self.entity_id)
        expected_entity.name = "test_data_product"

        self.mock_ometa.get_by_id.return_value = expected_entity

        result = DataProducts.retrieve(self.entity_id)

        self.assertEqual(str(result.id), self.entity_id)
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=DataProductEntity, entity_id=self.entity_id, fields=None
        )

    def test_retrieve_data_product_by_name(self):
        """Test retrieving a data product by name"""
        expected_entity = MagicMock(spec=DataProductEntity)
        expected_entity.fullyQualifiedName = self.entity_fqn

        self.mock_ometa.get_by_name.return_value = expected_entity

        result = DataProducts.retrieve_by_name(self.entity_fqn)

        self.assertEqual(result.fullyQualifiedName, self.entity_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=DataProductEntity, fqn=self.entity_fqn, fields=None
        )

    def test_update_data_product(self):
        """Test updating a data product"""
        entity_to_update = MagicMock(spec=DataProductEntity)
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

        result = DataProducts.update(entity_to_update)

        self.assertEqual(result.description, "Updated description")
        # Verify get_by_id was called to fetch current state
        self.mock_ometa.get_by_id.assert_called_once()
        # Verify patch was called with source and destination
        self.mock_ometa.patch.assert_called_once()

    def test_delete_data_product(self):
        """Test deleting a data product"""
        DataProducts.delete(self.entity_id, recursive=True, hard_delete=False)

        self.mock_ometa.delete.assert_called_once_with(
            entity=DataProductEntity,
            entity_id=self.entity_id,
            recursive=True,
            hard_delete=False,
        )

    def test_list_data_products(self):
        """Test listing data products"""
        mock_entity1 = MagicMock(spec=DataProductEntity)
        mock_entity1.name = "entity1"
        mock_entity2 = MagicMock(spec=DataProductEntity)
        mock_entity2.name = "entity2"

        mock_response = MagicMock()
        mock_response.entities = [mock_entity1, mock_entity2]

        self.mock_ometa.list_entities.return_value = mock_response

        result = DataProducts.list(limit=10)

        self.assertEqual(len(result.entities), 2)
        self.assertEqual(result.entities[0].name, "entity1")
        self.mock_ometa.list_entities.assert_called_once()


if __name__ == "__main__":
    unittest.main()
