# SPDX-License-Identifier: Apache-2.0
"""
Unit tests for owner_utils module
"""

import unittest
from unittest.mock import MagicMock

from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.utils.owner_utils import OwnerResolver, get_owner_from_config


class TestOwnerResolver(unittest.TestCase):
    """Test cases for OwnerResolver class"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = MagicMock()

        # Mock successful owner lookup
        mock_owner = EntityReference(
            id="owner-id", type="user", name="test-user", fullyQualifiedName="test-user"
        )
        self.mock_owner_list = EntityReferenceList(root=[mock_owner])

    def test_simple_default_owner(self):
        """Test simple default owner configuration"""
        config = {"default": "data-team"}

        self.mock_metadata.get_reference_by_name.return_value = self.mock_owner_list

        resolver = OwnerResolver(self.mock_metadata, config)
        result = resolver.resolve_owner(entity_type="table", entity_name="test_table")

        self.assertIsNotNone(result)
        self.mock_metadata.get_reference_by_name.assert_called_with(
            name="data-team", is_owner=True
        )

    def test_level_specific_owner(self):
        """Test level-specific owner configuration"""
        config = {
            "default": "default-team",
            "database": "db-team",
            "databaseSchema": "schema-team",
            "table": "table-team",
        }

        self.mock_metadata.get_reference_by_name.return_value = self.mock_owner_list

        resolver = OwnerResolver(self.mock_metadata, config)

        # Test database level
        result = resolver.resolve_owner(entity_type="database", entity_name="test_db")
        self.assertIsNotNone(result)
        self.mock_metadata.get_reference_by_name.assert_called_with(
            name="db-team", is_owner=True
        )

        # Test databaseSchema level
        result = resolver.resolve_owner(
            entity_type="databaseSchema", entity_name="test_schema"
        )
        self.assertIsNotNone(result)
        self.mock_metadata.get_reference_by_name.assert_called_with(
            name="schema-team", is_owner=True
        )

        # Test table level
        result = resolver.resolve_owner(entity_type="table", entity_name="test_table")
        self.assertIsNotNone(result)
        self.mock_metadata.get_reference_by_name.assert_called_with(
            name="table-team", is_owner=True
        )

    def test_specific_entity_mapping(self):
        """Test specific entity name mapping"""
        config = {
            "default": "default-team",
            "table": {"orders": "sales-team", "customers": "customer-team"},
        }

        self.mock_metadata.get_reference_by_name.return_value = self.mock_owner_list

        resolver = OwnerResolver(self.mock_metadata, config)

        # Test specific table mapping
        result = resolver.resolve_owner(entity_type="table", entity_name="orders")
        self.assertIsNotNone(result)
        self.mock_metadata.get_reference_by_name.assert_called_with(
            name="sales-team", is_owner=True
        )

        # Test unmapped table falls back to default
        result = resolver.resolve_owner(entity_type="table", entity_name="products")
        self.assertIsNotNone(result)
        self.mock_metadata.get_reference_by_name.assert_called_with(
            name="default-team", is_owner=True
        )

    def test_fqn_matching(self):
        """Test FQN matching for entities"""
        config = {
            "default": "default-team",
            "table": {
                "sales_db.public.orders": "sales-team",
                "analytics_db.public.reports": "analytics-team",
            },
        }

        self.mock_metadata.get_reference_by_name.return_value = self.mock_owner_list

        resolver = OwnerResolver(self.mock_metadata, config)

        # Test FQN match
        result = resolver.resolve_owner(
            entity_type="table", entity_name="sales_db.public.orders"
        )
        self.assertIsNotNone(result)
        self.mock_metadata.get_reference_by_name.assert_called_with(
            name="sales-team", is_owner=True
        )

    def test_simple_name_fallback(self):
        """Test fallback to simple name when FQN doesn't match"""
        config = {"default": "default-team", "table": {"orders": "sales-team"}}

        self.mock_metadata.get_reference_by_name.return_value = self.mock_owner_list

        resolver = OwnerResolver(self.mock_metadata, config)

        # Test FQN that falls back to simple name
        result = resolver.resolve_owner(
            entity_type="table", entity_name="sales_db.public.orders"
        )
        self.assertIsNotNone(result)
        # Should match on simple name "orders"
        self.mock_metadata.get_reference_by_name.assert_called_with(
            name="sales-team", is_owner=True
        )

    def test_inheritance_enabled(self):
        """Test owner inheritance from parent"""
        config = {"default": "default-team", "enableInheritance": True, "table": {}}

        self.mock_metadata.get_reference_by_name.return_value = self.mock_owner_list

        resolver = OwnerResolver(self.mock_metadata, config)

        # Table should inherit from schema owner
        result = resolver.resolve_owner(
            entity_type="table", entity_name="test_table", parent_owner="schema-team"
        )
        self.assertIsNotNone(result)
        self.mock_metadata.get_reference_by_name.assert_called_with(
            name="schema-team", is_owner=True
        )

    def test_inheritance_disabled(self):
        """Test that inheritance can be disabled"""
        config = {"default": "default-team", "enableInheritance": False, "table": {}}

        self.mock_metadata.get_reference_by_name.return_value = self.mock_owner_list

        resolver = OwnerResolver(self.mock_metadata, config)

        # Table should NOT inherit, should use default
        result = resolver.resolve_owner(
            entity_type="table", entity_name="test_table", parent_owner="schema-team"
        )
        self.assertIsNotNone(result)
        # Should use default, not parent
        self.mock_metadata.get_reference_by_name.assert_called_with(
            name="default-team", is_owner=True
        )

    def test_priority_order(self):
        """Test priority order: specific > level > inheritance > default"""
        config = {
            "default": "default-team",
            "enableInheritance": True,
            "table": {"orders": "specific-team"},
        }

        self.mock_metadata.get_reference_by_name.return_value = self.mock_owner_list

        resolver = OwnerResolver(self.mock_metadata, config)

        # Specific configuration should have highest priority
        result = resolver.resolve_owner(
            entity_type="table", entity_name="orders", parent_owner="parent-team"
        )
        self.assertIsNotNone(result)
        # Should use specific, not parent or default
        self.mock_metadata.get_reference_by_name.assert_called_with(
            name="specific-team", is_owner=True
        )

    def test_owner_not_found(self):
        """Test handling when owner is not found"""
        config = {"default": "nonexistent-team"}

        self.mock_metadata.get_reference_by_name.return_value = None

        resolver = OwnerResolver(self.mock_metadata, config)
        result = resolver.resolve_owner(entity_type="table", entity_name="test_table")

        self.assertIsNone(result)

    def test_empty_config(self):
        """Test with empty configuration"""
        resolver = OwnerResolver(self.mock_metadata, {})
        result = resolver.resolve_owner(entity_type="table", entity_name="test_table")

        self.assertIsNone(result)

    def test_email_lookup(self):
        """Test owner lookup by email"""
        config = {"default": "admin@company.com"}

        # First call (by name) returns None, second call (by email) succeeds
        self.mock_metadata.get_reference_by_name.return_value = None
        self.mock_metadata.get_reference_by_email.return_value = self.mock_owner_list

        resolver = OwnerResolver(self.mock_metadata, config)
        result = resolver.resolve_owner(entity_type="table", entity_name="test_table")

        self.assertIsNotNone(result)
        self.mock_metadata.get_reference_by_email.assert_called_with(
            "admin@company.com"
        )

    def test_multiple_owners_array(self):
        """Test multiple owners specified as array"""
        config = {
            "default": "default-team",
            "table": {"orders": ["sales-team", "finance-team"]},
        }

        mock_sales_owner = EntityReference(
            id="sales-id",
            type="team",
            name="sales-team",
            fullyQualifiedName="sales-team",
        )
        mock_finance_owner = EntityReference(
            id="finance-id",
            type="team",
            name="finance-team",
            fullyQualifiedName="finance-team",
        )

        def mock_get_reference(name, is_owner=False):
            if name == "sales-team":
                return EntityReferenceList(root=[mock_sales_owner])
            elif name == "finance-team":
                return EntityReferenceList(root=[mock_finance_owner])
            return None

        self.mock_metadata.get_reference_by_name.side_effect = mock_get_reference

        resolver = OwnerResolver(self.mock_metadata, config)
        result = resolver.resolve_owner(entity_type="table", entity_name="orders")

        self.assertIsNotNone(result)
        self.assertEqual(len(result.root), 2)
        self.assertEqual(result.root[0].name, "sales-team")
        self.assertEqual(result.root[1].name, "finance-team")

    def test_multiple_owners_partial_success(self):
        """Test that partial success works when some owners are not found"""
        config = {
            "table": {"orders": ["sales-team", "nonexistent-team", "finance-team"]}
        }

        mock_sales_owner = EntityReference(
            id="sales-id",
            type="team",
            name="sales-team",
            fullyQualifiedName="sales-team",
        )
        mock_finance_owner = EntityReference(
            id="finance-id",
            type="team",
            name="finance-team",
            fullyQualifiedName="finance-team",
        )

        def mock_get_reference(name, is_owner=False):
            if name == "sales-team":
                return EntityReferenceList(root=[mock_sales_owner])
            elif name == "finance-team":
                return EntityReferenceList(root=[mock_finance_owner])
            return None

        self.mock_metadata.get_reference_by_name.side_effect = mock_get_reference

        resolver = OwnerResolver(self.mock_metadata, config)
        result = resolver.resolve_owner(entity_type="table", entity_name="orders")

        self.assertIsNotNone(result)
        self.assertEqual(len(result.root), 2)

    def test_multiple_owners_all_fail(self):
        """Test that None is returned when all owners fail"""
        config = {"table": {"orders": ["nonexistent-1", "nonexistent-2"]}}

        self.mock_metadata.get_reference_by_name.return_value = None

        resolver = OwnerResolver(self.mock_metadata, config)
        result = resolver.resolve_owner(entity_type="table", entity_name="orders")

        self.assertIsNone(result)

    def test_backward_compatibility_single_string(self):
        """Test backward compatibility with single string owner"""
        config = {"table": {"orders": "sales-team"}}

        self.mock_metadata.get_reference_by_name.return_value = self.mock_owner_list

        resolver = OwnerResolver(self.mock_metadata, config)
        result = resolver.resolve_owner(entity_type="table", entity_name="orders")

        self.assertIsNotNone(result)
        self.mock_metadata.get_reference_by_name.assert_called_with(
            name="sales-team", is_owner=True
        )

    def test_multiple_owners_with_fqn(self):
        """Test multiple owners with FQN matching"""
        config = {"table": {"sales_db.public.orders": ["sales-team", "audit-team"]}}

        mock_sales_owner = EntityReference(
            id="sales-id",
            type="team",
            name="sales-team",
            fullyQualifiedName="sales-team",
        )
        mock_audit_owner = EntityReference(
            id="audit-id",
            type="team",
            name="audit-team",
            fullyQualifiedName="audit-team",
        )

        def mock_get_reference(name, is_owner=False):
            if name == "sales-team":
                return EntityReferenceList(root=[mock_sales_owner])
            elif name == "audit-team":
                return EntityReferenceList(root=[mock_audit_owner])
            return None

        self.mock_metadata.get_reference_by_name.side_effect = mock_get_reference

        resolver = OwnerResolver(self.mock_metadata, config)
        result = resolver.resolve_owner(
            entity_type="table", entity_name="sales_db.public.orders"
        )

        self.assertIsNotNone(result)
        self.assertEqual(len(result.root), 2)


class TestGetOwnerFromConfig(unittest.TestCase):
    """Test cases for get_owner_from_config function"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = MagicMock()
        mock_owner = EntityReference(
            id="owner-id", type="user", name="test-user", fullyQualifiedName="test-user"
        )
        self.mock_owner_list = EntityReferenceList(root=[mock_owner])

    def test_string_config(self):
        """Test with string configuration (simple mode)"""
        self.mock_metadata.get_reference_by_name.return_value = self.mock_owner_list

        result = get_owner_from_config(
            metadata=self.mock_metadata,
            owner_config="data-team",
            entity_type="table",
            entity_name="test_table",
        )

        self.assertIsNotNone(result)
        self.mock_metadata.get_reference_by_name.assert_called_with(
            name="data-team", is_owner=True
        )

    def test_dict_config(self):
        """Test with dict configuration"""
        config = {"default": "data-team"}
        self.mock_metadata.get_reference_by_name.return_value = self.mock_owner_list

        result = get_owner_from_config(
            metadata=self.mock_metadata,
            owner_config=config,
            entity_type="table",
            entity_name="test_table",
        )

        self.assertIsNotNone(result)
        self.mock_metadata.get_reference_by_name.assert_called_with(
            name="data-team", is_owner=True
        )

    def test_none_config(self):
        """Test with None configuration"""
        result = get_owner_from_config(
            metadata=self.mock_metadata,
            owner_config=None,
            entity_type="table",
            entity_name="test_table",
        )

        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
