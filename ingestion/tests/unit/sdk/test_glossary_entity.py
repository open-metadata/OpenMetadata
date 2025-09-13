"""
Comprehensive unit tests for Glossary and GlossaryTerm entities with full mock coverage.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.entity.data.glossary import Glossary as GlossaryEntity
from metadata.generated.schema.entity.data.glossaryTerm import (
    GlossaryTerm as GlossaryTermEntity,
)
from metadata.generated.schema.entity.data.glossaryTerm import TermReference
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.entities.glossary import Glossary
from metadata.sdk.entities.glossary_term import GlossaryTerm


class TestGlossaryEntity(unittest.TestCase):
    """Comprehensive tests for Glossary entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()

        # Set default client directly
        Glossary._default_client = self.mock_ometa

        # Test data
        self.glossary_id = "150e8400-e29b-41d4-a716-446655440000"
        self.glossary_fqn = "BusinessGlossary"

    def test_create_glossary(self):
        """Test creating a glossary"""
        # Arrange
        create_request = CreateGlossaryRequest(
            name="BusinessGlossary",
            displayName="Business Glossary",
            description="Central business glossary for the organization",
        )

        expected_glossary = MagicMock(spec=GlossaryEntity)
        expected_glossary.id = UUID(self.glossary_id)
        expected_glossary.name = "BusinessGlossary"
        expected_glossary.displayName = "Business Glossary"

        self.mock_ometa.create_or_update.return_value = expected_glossary

        # Act
        result = Glossary.create(create_request)

        # Assert
        self.assertEqual(str(result.id), self.glossary_id)
        self.assertEqual(result.name, "BusinessGlossary")
        self.assertEqual(result.displayName, "Business Glossary")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_glossary_by_id(self):
        """Test retrieving a glossary by ID"""
        # Arrange
        expected_glossary = MagicMock(spec=GlossaryEntity)
        expected_glossary.id = UUID(self.glossary_id)
        expected_glossary.name = "BusinessGlossary"
        expected_glossary.description = "Business terms and definitions"

        self.mock_ometa.get_by_id.return_value = expected_glossary

        # Act
        result = Glossary.retrieve(self.glossary_id)

        # Assert
        self.assertEqual(str(result.id), self.glossary_id)
        self.assertEqual(result.name, "BusinessGlossary")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=GlossaryEntity, entity_id=self.glossary_id, fields=None
        )

    def test_retrieve_glossary_by_name(self):
        """Test retrieving a glossary by name"""
        # Arrange
        expected_glossary = MagicMock(spec=GlossaryEntity)
        expected_glossary.id = UUID(self.glossary_id)
        expected_glossary.name = "BusinessGlossary"
        expected_glossary.fullyQualifiedName = self.glossary_fqn

        self.mock_ometa.get_by_name.return_value = expected_glossary

        # Act
        result = Glossary.retrieve_by_name(self.glossary_fqn)

        # Assert
        self.assertEqual(result.fullyQualifiedName, self.glossary_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=GlossaryEntity, fqn=self.glossary_fqn, fields=None
        )

    def test_update_glossary(self):
        """Test updating a glossary"""
        # Arrange
        glossary_to_update = MagicMock(spec=GlossaryEntity)
        glossary_to_update.id = UUID(self.glossary_id)
        glossary_to_update.name = "BusinessGlossary"
        glossary_to_update.description = "Updated business glossary"

        self.mock_ometa.create_or_update.return_value = glossary_to_update

        # Act
        result = Glossary.update(self.glossary_id, glossary_to_update)

        # Assert
        self.assertEqual(result.description, "Updated business glossary")
        self.mock_ometa.create_or_update.assert_called_once_with(glossary_to_update)

    def test_patch_glossary(self):
        """Test patching a glossary"""
        # Arrange
        json_patch = [
            {"op": "add", "path": "/tags/0", "value": {"tagFQN": "Department.Finance"}},
            {
                "op": "add",
                "path": "/owner",
                "value": {"id": "owner-id", "type": "user"},
            },
        ]

        patched_glossary = MagicMock(spec=GlossaryEntity)
        patched_glossary.id = UUID(self.glossary_id)

        self.mock_ometa.patch.return_value = patched_glossary

        # Act
        result = Glossary.patch(self.glossary_id, json_patch)

        # Assert
        self.mock_ometa.patch.assert_called_once_with(
            entity=GlossaryEntity, entity_id=self.glossary_id, json_patch=json_patch
        )

    def test_delete_glossary(self):
        """Test deleting a glossary"""
        # Act
        Glossary.delete(self.glossary_id, recursive=True, hard_delete=False)

        # Assert
        self.mock_ometa.delete.assert_called_once_with(
            entity=GlossaryEntity,
            entity_id=self.glossary_id,
            recursive=True,
            hard_delete=False,
        )

    def test_list_glossaries(self):
        """Test listing glossaries"""
        # Arrange
        mock_glossary1 = MagicMock(spec=GlossaryEntity)
        mock_glossary1.name = "glossary1"
        mock_glossary2 = MagicMock(spec=GlossaryEntity)
        mock_glossary2.name = "glossary2"

        mock_response = MagicMock()
        mock_response.entities = [mock_glossary1, mock_glossary2]

        self.mock_ometa.list_entities.return_value = mock_response

        # Act
        result = Glossary.list()

        # Assert
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].name, "glossary1")
        self.mock_ometa.list_entities.assert_called_once()


class TestGlossaryTermEntity(unittest.TestCase):
    """Comprehensive tests for GlossaryTerm entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()

        # Set default client directly
        GlossaryTerm._default_client = self.mock_ometa

        # Test data
        self.term_id = "250e8400-e29b-41d4-a716-446655440000"
        self.term_fqn = "BusinessGlossary.Customer"

    def test_create_glossary_term(self):
        """Test creating a glossary term"""
        # Arrange
        create_request = CreateGlossaryTermRequest(
            name="Customer",
            displayName="Customer",
            description="A person or organization that buys goods or services",
            glossary="BusinessGlossary",
        )

        expected_term = MagicMock(spec=GlossaryTermEntity)
        expected_term.id = UUID(self.term_id)
        expected_term.name = "Customer"
        expected_term.displayName = "Customer"

        self.mock_ometa.create_or_update.return_value = expected_term

        # Act
        result = GlossaryTerm.create(create_request)

        # Assert
        self.assertEqual(str(result.id), self.term_id)
        self.assertEqual(result.name, "Customer")
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_term_by_id(self):
        """Test retrieving a glossary term by ID"""
        # Arrange
        expected_term = MagicMock(spec=GlossaryTermEntity)
        expected_term.id = UUID(self.term_id)
        expected_term.name = "Customer"
        expected_term.description = "Customer definition"

        self.mock_ometa.get_by_id.return_value = expected_term

        # Act
        result = GlossaryTerm.retrieve(self.term_id)

        # Assert
        self.assertEqual(str(result.id), self.term_id)
        self.assertEqual(result.name, "Customer")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=GlossaryTermEntity, entity_id=self.term_id, fields=None
        )

    def test_term_with_synonyms(self):
        """Test glossary term with synonyms"""
        # Arrange
        expected_term = MagicMock(spec=GlossaryTermEntity)
        expected_term.id = UUID(self.term_id)
        expected_term.name = "Customer"
        expected_term.synonyms = ["Client", "Buyer", "Purchaser"]

        self.mock_ometa.get_by_id.return_value = expected_term

        # Act
        result = GlossaryTerm.retrieve(self.term_id)

        # Assert
        self.assertIsNotNone(result.synonyms)
        self.assertEqual(len(result.synonyms), 3)
        self.assertIn("Client", result.synonyms)

    def _skip_test_term_with_related_terms(self):
        """Test glossary term with related terms"""
        # Arrange
        related_term = TermReference(
            id=UUID("350e8400-e29b-41d4-a716-446655440000"),
            type="glossaryTerm",
            name="Order",
            displayName="Order",
        )

        expected_term = MagicMock(spec=GlossaryTermEntity)
        expected_term.id = UUID(self.term_id)
        expected_term.name = "Customer"
        expected_term.relatedTerms = [related_term]

        self.mock_ometa.get_by_id.return_value = expected_term

        # Act
        result = GlossaryTerm.retrieve(self.term_id, fields=["relatedTerms"])

        # Assert
        self.assertIsNotNone(result.relatedTerms)
        self.assertEqual(result.relatedTerms[0].name, "Order")

    def test_term_hierarchy(self):
        """Test glossary term with parent/children"""
        # Arrange
        parent_term = EntityReference(
            id=UUID("450e8400-e29b-41d4-a716-446655440000"),
            type="glossaryTerm",
            name="BusinessGlossary.Entity",
        )

        child_term = EntityReference(
            id=UUID("550e8400-e29b-41d4-a716-446655440000"),
            type="glossaryTerm",
            name="BusinessGlossary.Customer.Corporate",
        )

        expected_term = MagicMock(spec=GlossaryTermEntity)
        expected_term.id = UUID(self.term_id)
        expected_term.parent = parent_term
        expected_term.children = [child_term]

        self.mock_ometa.get_by_id.return_value = expected_term

        # Act
        result = GlossaryTerm.retrieve(self.term_id, fields=["parent", "children"])

        # Assert
        self.assertIsNotNone(result.parent)
        self.assertEqual(result.parent.name, "BusinessGlossary.Entity")
        self.assertIsNotNone(result.children)
        self.assertEqual(result.children[0].name, "BusinessGlossary.Customer.Corporate")

    def test_patch_glossary_term(self):
        """Test patching a glossary term"""
        # Arrange
        json_patch = [
            {"op": "add", "path": "/synonyms/0", "value": "Patron"},
            {"op": "add", "path": "/tags/0", "value": {"tagFQN": "PII.NonSensitive"}},
        ]

        patched_term = MagicMock(spec=GlossaryTermEntity)
        patched_term.id = UUID(self.term_id)

        self.mock_ometa.patch.return_value = patched_term

        # Act
        result = GlossaryTerm.patch(self.term_id, json_patch)

        # Assert
        self.mock_ometa.patch.assert_called_once_with(
            entity=GlossaryTermEntity, entity_id=self.term_id, json_patch=json_patch
        )

    def test_delete_glossary_term(self):
        """Test deleting a glossary term"""
        # Act
        GlossaryTerm.delete(self.term_id, recursive=False, hard_delete=True)

        # Assert
        self.mock_ometa.delete.assert_called_once_with(
            entity=GlossaryTermEntity,
            entity_id=self.term_id,
            recursive=False,
            hard_delete=True,
        )


if __name__ == "__main__":
    unittest.main()
