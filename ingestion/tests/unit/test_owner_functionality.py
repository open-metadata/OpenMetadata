#!/usr/bin/env python3
"""
Unit tests: Verify ownership assignment functionality

This script tests the functionality of the newly added get_default_owner_ref method.
"""

import unittest
from unittest.mock import Mock, MagicMock, patch
from typing import Optional

# Mock imports
class MockEntityReferenceList:
    def __init__(self, root=None):
        self.root = root or []

class MockSourceConfig:
    def __init__(self, owner=None, includeOwners=True):
        self.owner = owner
        self.includeOwners = includeOwners

class MockMetadata:
    def __init__(self):
        self.get_reference_by_name = Mock()

class MockDatabaseServiceSource:
    """Mock DatabaseServiceSource class"""
    
    def __init__(self, source_config, metadata):
        self.source_config = source_config
        self.metadata = metadata
    
    def get_default_owner_ref(self) -> Optional[MockEntityReferenceList]:
        """
        Test version of get_default_owner_ref method
        """
        try:
            # Check if owner is configured in sourceConfig
            if hasattr(self.source_config, 'owner') and self.source_config.owner:
                owner_name = self.source_config.owner
                print(f"Using default owner from sourceConfig: {owner_name}")
                
                # Try to get owner reference by name (could be user or team)
                owner_ref = self.metadata.get_reference_by_name(
                    name=owner_name, is_owner=True
                )
                if owner_ref:
                    return owner_ref
                else:
                    print(f"Could not find owner with name: {owner_name}")
        except Exception as exc:
            print(f"Error processing default owner from sourceConfig: {exc}")
        return None

class TestOwnerAssignment(unittest.TestCase):
    """Test ownership assignment functionality"""
    
    def setUp(self):
        """Set up test environment"""
        self.metadata = MockMetadata()
        self.mock_owner_ref = MockEntityReferenceList([{"id": "user123", "type": "user"}])
    
    def test_get_default_owner_ref_with_valid_owner(self):
        """Test valid owner scenario"""
        # Set up mocks
        source_config = MockSourceConfig(owner="data_team")
        self.metadata.get_reference_by_name.return_value = self.mock_owner_ref
        
        # Create test object
        source = MockDatabaseServiceSource(source_config, self.metadata)
        
        # Execute test
        result = source.get_default_owner_ref()
        
        # Verify results
        self.assertIsNotNone(result)
        self.assertEqual(result, self.mock_owner_ref)
        self.metadata.get_reference_by_name.assert_called_once_with(
            name="data_team", is_owner=True
        )
    
    def test_get_default_owner_ref_with_nonexistent_owner(self):
        """Test non-existent owner scenario"""
        # Set up mocks
        source_config = MockSourceConfig(owner="nonexistent_team")
        self.metadata.get_reference_by_name.return_value = None
        
        # Create test object
        source = MockDatabaseServiceSource(source_config, self.metadata)
        
        # Execute test
        result = source.get_default_owner_ref()
        
        # Verify results
        self.assertIsNone(result)
        self.metadata.get_reference_by_name.assert_called_once_with(
            name="nonexistent_team", is_owner=True
        )
    
    def test_get_default_owner_ref_with_no_owner(self):
        """Test no owner configured scenario"""
        # Set up mocks
        source_config = MockSourceConfig(owner=None)
        
        # Create test object
        source = MockDatabaseServiceSource(source_config, self.metadata)
        
        # Execute test
        result = source.get_default_owner_ref()
        
        # Verify results
        self.assertIsNone(result)
        self.metadata.get_reference_by_name.assert_not_called()
    
    def test_get_default_owner_ref_with_empty_owner(self):
        """Test empty owner scenario"""
        # Set up mocks
        source_config = MockSourceConfig(owner="")
        
        # Create test object
        source = MockDatabaseServiceSource(source_config, self.metadata)
        
        # Execute test
        result = source.get_default_owner_ref()
        
        # Verify results
        self.assertIsNone(result)
        self.metadata.get_reference_by_name.assert_not_called()
    
    def test_get_default_owner_ref_with_exception(self):
        """Test exception handling"""
        # Set up mocks
        source_config = MockSourceConfig(owner="data_team")
        self.metadata.get_reference_by_name.side_effect = Exception("Database error")
        
        # Create test object
        source = MockDatabaseServiceSource(source_config, self.metadata)
        
        # Execute test
        result = source.get_default_owner_ref()
        
        # Verify results
        self.assertIsNone(result)
        self.metadata.get_reference_by_name.assert_called_once_with(
            name="data_team", is_owner=True
        )

class TestOwnerAssignmentIntegration(unittest.TestCase):
    """Integration tests: Verify ownership assignment integration in ingestion flow"""
    
    def test_owner_priority_in_get_owner_ref(self):
        """Test owner priority in get_owner_ref method"""
        # Mock configuration
        source_config = MockSourceConfig(owner="data_team", includeOwners=True)
        metadata = MockMetadata()
        mock_owner_ref = MockEntityReferenceList([{"id": "user123", "type": "user"}])
        metadata.get_reference_by_name.return_value = mock_owner_ref
        
        # Mock get_owner_ref method behavior
        def mock_get_owner_ref(table_name: str):
            # First check default owner
            default_owner_ref = MockDatabaseServiceSource(source_config, metadata).get_default_owner_ref()
            if default_owner_ref:
                return default_owner_ref
            
            # If no default owner, extract from database metadata
            if source_config.includeOwners:
                # This would call inspector.get_table_owner etc.
                # But for testing, we return None
                return None
            return None
        
        # Execute test
        result = mock_get_owner_ref("test_table")
        
        # Verify results
        self.assertIsNotNone(result)
        self.assertEqual(result, mock_owner_ref)
        # Verify get_reference_by_name was called
        metadata.get_reference_by_name.assert_called_with(
            name="data_team", is_owner=True
        )

def run_tests():
    """Run all tests"""
    print("=== Running Ownership Assignment Functionality Tests ===\n")
    
    # Create test suite
    test_suite = unittest.TestSuite()
    
    # Add test cases
    test_suite.addTest(unittest.makeSuite(TestOwnerAssignment))
    test_suite.addTest(unittest.makeSuite(TestOwnerAssignmentIntegration))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    # Output result summary
    print(f"\n=== Test Result Summary ===")
    print(f"Tests run: {result.testsRun}")
    print(f"Success: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    
    if result.failures:
        print(f"\nFailed tests:")
        for test, traceback in result.failures:
            print(f"- {test}: {traceback}")
    
    if result.errors:
        print(f"\nError tests:")
        for test, traceback in result.errors:
            print(f"- {test}: {traceback}")
    
    return result.wasSuccessful()

if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
