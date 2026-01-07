"""
Unit tests for the to_entity_reference helper function.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.sdk import to_entity_reference
from metadata.sdk.entities.base import BaseEntity


class MockEntity:
    """Mock entity class for testing."""

    def __init__(
        self,
        entity_id: str | None = None,
        entity_type: str | None = None,
        name: str | None = None,
        fqn: str | None = None,
    ):
        self.id = UUID(entity_id) if entity_id else None
        self.entityType = entity_type
        self.name = name
        self.fullyQualifiedName = fqn


class MockEntityWithRoot:
    """Mock entity with root wrapper (like pydantic models)."""

    def __init__(self, entity_id: str):
        self.id = MagicMock()
        self.id.root = UUID(entity_id)
        self.entityType = "team"
        self.name = "engineering"
        self.fullyQualifiedName = "engineering"


class TestToEntityReference(unittest.TestCase):
    """Test to_entity_reference helper function."""

    def test_basic_entity_reference(self):
        """Test converting a basic entity to EntityReference."""
        entity = MockEntity(
            entity_id="550e8400-e29b-41d4-a716-446655440000",
            entity_type="team",
            name="engineering",
            fqn="engineering",
        )

        result = to_entity_reference(entity)

        self.assertIsInstance(result, dict)
        self.assertEqual(result["id"], "550e8400-e29b-41d4-a716-446655440000")
        self.assertEqual(result["type"], "team")
        self.assertEqual(result["name"], "engineering")
        self.assertEqual(result["fullyQualifiedName"], "engineering")

    def test_entity_reference_minimal_fields(self):
        """Test with only required fields (id)."""
        entity = MockEntity(
            entity_id="550e8400-e29b-41d4-a716-446655440001",
            entity_type="user",
        )

        result = to_entity_reference(entity)

        self.assertEqual(result["id"], "550e8400-e29b-41d4-a716-446655440001")
        self.assertEqual(result["type"], "user")
        self.assertNotIn("name", result)
        self.assertNotIn("fullyQualifiedName", result)

    def test_entity_reference_fallback_type(self):
        """Test type fallback to class name when entityType is None."""
        entity = MockEntity(
            entity_id="550e8400-e29b-41d4-a716-446655440002",
            entity_type=None,
            name="test",
        )

        result = to_entity_reference(entity)

        self.assertEqual(result["id"], "550e8400-e29b-41d4-a716-446655440002")
        # Should fall back to class name
        self.assertEqual(result["type"], "mockentity")
        self.assertEqual(result["name"], "test")

    def test_entity_reference_with_root_wrapper(self):
        """Test entity with UUID wrapped in root attribute (pydantic style)."""
        entity = MockEntityWithRoot("550e8400-e29b-41d4-a716-446655440003")

        result = to_entity_reference(entity)

        self.assertEqual(result["id"], "550e8400-e29b-41d4-a716-446655440003")
        self.assertEqual(result["type"], "team")
        self.assertEqual(result["name"], "engineering")

    def test_entity_reference_missing_id_raises(self):
        """Test that missing id raises ValueError."""
        entity = MockEntity(entity_id=None)

        with self.assertRaises(ValueError) as context:
            to_entity_reference(entity)

        self.assertIn("id", str(context.exception).lower())

    def test_entity_reference_via_base_entity(self):
        """Test calling via BaseEntity.to_entity_reference static method."""
        entity = MockEntity(
            entity_id="550e8400-e29b-41d4-a716-446655440004",
            entity_type="database",
            name="analytics",
            fqn="snowflake_prod.analytics",
        )

        result = BaseEntity.to_entity_reference(entity)

        self.assertEqual(result["id"], "550e8400-e29b-41d4-a716-446655440004")
        self.assertEqual(result["type"], "database")
        self.assertEqual(result["name"], "analytics")
        self.assertEqual(result["fullyQualifiedName"], "snowflake_prod.analytics")

    def test_entity_reference_user_type(self):
        """Test converting a user entity."""
        user = MockEntity(
            entity_id="550e8400-e29b-41d4-a716-446655440005",
            entity_type="user",
            name="john.doe",
            fqn="john.doe",
        )

        result = to_entity_reference(user)

        self.assertEqual(result["type"], "user")
        self.assertEqual(result["name"], "john.doe")

    def test_entity_reference_domain_type(self):
        """Test converting a domain entity."""
        domain = MockEntity(
            entity_id="550e8400-e29b-41d4-a716-446655440006",
            entity_type="domain",
            name="Sales",
            fqn="Sales",
        )

        result = to_entity_reference(domain)

        self.assertEqual(result["type"], "domain")
        self.assertEqual(result["name"], "Sales")

    def test_multiple_owners_pattern(self):
        """Test pattern for setting multiple owners."""
        team = MockEntity(
            entity_id="550e8400-e29b-41d4-a716-446655440007",
            entity_type="team",
            name="data-platform",
            fqn="data-platform",
        )
        user = MockEntity(
            entity_id="550e8400-e29b-41d4-a716-446655440008",
            entity_type="user",
            name="john.doe",
            fqn="john.doe",
        )

        owners = [
            to_entity_reference(team),
            to_entity_reference(user),
        ]

        self.assertEqual(len(owners), 2)
        self.assertEqual(owners[0]["type"], "team")
        self.assertEqual(owners[1]["type"], "user")


if __name__ == "__main__":
    unittest.main()
