import unittest
from unittest.mock import MagicMock

from metadata.ingestion.ometa.mixins.csv_mixin import CSVMixin

"""
Simple test for CSV operations to verify the implementation.
Tests the CSVMixin functionality directly.
"""
from unittest.mock import Mock

from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)


class TestCsvMixinOperations(unittest.TestCase):
    def setUp(self):
        """Set up test fixtures"""
        self.mock_client = MagicMock()
        self.csv_mixin = CSVMixin()
        self.csv_mixin.client = self.mock_client

    """Test CSV mixin operations."""

    def test_csv_mixin_export(self):
        """Test CSV export method in mixin."""
        # Create mock client
        mock_client = Mock()
        mock_response = "parent,name,description\n,term1,Test term"
        mock_client.get.return_value = mock_response

        # Create OpenMetadata instance with mock client
        config = OpenMetadataConnection(
            hostPort="http://test", authProvider=AuthProvider.openmetadata
        )
        # Use mocked client directly
        # Already set in setUp

        # Mock the get method on the CSVMixin's client
        self.mock_client.get.return_value = mock_response

        # Test export
        result = self.csv_mixin.export_csv(Glossary, "test_glossary")

        # Verify
        assert result == mock_response
        self.mock_client.get.assert_called_once_with(
            "/glossaries/name/test_glossary/export"
        )

    def test_csv_mixin_export_async(self):
        """Test async CSV export method."""
        # Create mock client
        mock_client = Mock()
        mock_response = {"jobId": "export-job-123"}
        mock_client.get.return_value = mock_response

        # Create OpenMetadata instance with mock client
        config = OpenMetadataConnection(
            hostPort="http://test", authProvider=AuthProvider.openmetadata
        )
        # Use mocked client directly
        # Already set in setUp

        # Mock the get method
        self.mock_client.get.return_value = {"jobId": "export-job-123"}

        # Test async export
        result = self.csv_mixin.export_csv_async(Glossary, "test_glossary")

        # Verify
        assert result == "export-job-123"
        self.mock_client.get.assert_called_once_with(
            "/glossaries/name/test_glossary/exportAsync"
        )

    def test_csv_mixin_import(self):
        """Test CSV import method."""
        # Create mock client
        mock_client = Mock()
        mock_response = {"created": 5, "updated": 2}
        self.mock_client.put.return_value = mock_response

        # Create OpenMetadata instance with mock client
        config = OpenMetadataConnection(
            hostPort="http://test", authProvider=AuthProvider.openmetadata
        )
        # Use mocked client directly
        # Already set in setUp

        # Test import
        csv_data = "parent,name,description\n,term1,Test term"
        result = self.csv_mixin.import_csv(
            Glossary, "test_glossary", csv_data, dry_run=False
        )

        # Verify
        assert result == mock_response
        self.mock_client.put.assert_called_once_with(
            "/glossaries/name/test_glossary/import",
            csv_data,
            headers={"Content-Type": "text/plain"},
        )

    def test_csv_mixin_import_dry_run(self):
        """Test CSV import with dry run."""
        # Create mock client
        mock_client = Mock()
        mock_response = {"wouldCreate": 5, "wouldUpdate": 2}
        self.mock_client.put.return_value = mock_response

        # Create OpenMetadata instance with mock client
        config = OpenMetadataConnection(
            hostPort="http://test", authProvider=AuthProvider.openmetadata
        )
        # Use mocked client directly
        # Already set in setUp

        # Test import with dry run
        csv_data = "parent,name,description\n,term1,Test term"
        result = self.csv_mixin.import_csv(
            Glossary, "test_glossary", csv_data, dry_run=True
        )

        # Verify
        assert result == mock_response
        self.mock_client.put.assert_called_once_with(
            "/glossaries/name/test_glossary/import?dryRun=true",
            csv_data,
            headers={"Content-Type": "text/plain"},
        )

    def test_csv_mixin_import_async(self):
        """Test async CSV import."""
        # Create mock client
        mock_client = Mock()
        mock_response = {"jobId": "import-job-456"}
        self.mock_client.put.return_value = mock_response

        # Create OpenMetadata instance with mock client
        config = OpenMetadataConnection(
            hostPort="http://test", authProvider=AuthProvider.openmetadata
        )
        # Use mocked client directly
        # Already set in setUp

        # Test async import
        csv_data = "parent,name,description\n,term1,Test term"
        result = self.csv_mixin.import_csv_async(
            Glossary, "test_glossary", csv_data, dry_run=False
        )

        # Verify
        assert result == "import-job-456"
        self.mock_client.put.assert_called_once_with(
            "/glossaries/name/test_glossary/importAsync",
            csv_data,
            headers={"Content-Type": "text/plain"},
        )

    def test_base_entity_csv_export_integration(self):
        """Test BaseEntity export_csv method integration."""
        from metadata.sdk import BaseEntity

        # Create mock entity class
        class TestEntity(BaseEntity):
            @classmethod
            def entity_type(cls):
                return Glossary

        # Setup mock client
        mock_ometa = Mock()
        mock_ometa.export_csv = Mock(return_value="csv,export,data")
        TestEntity.set_default_client(mock_ometa)

        # Test export
        exporter = TestEntity.export_csv("test_glossary")
        csv_data = exporter.execute()

        # Verify
        assert csv_data == "csv,export,data"
        mock_ometa.export_csv.assert_called_once_with(
            entity=Glossary, name="test_glossary"
        )

    def test_base_entity_csv_import_integration(self):
        """Test BaseEntity import_csv method integration."""
        from metadata.sdk import BaseEntity

        # Create mock entity class
        class TestEntity(BaseEntity):
            @classmethod
            def entity_type(cls):
                return Glossary

        # Setup mock client
        mock_ometa = Mock()
        mock_ometa.import_csv = Mock(return_value={"created": 3})
        TestEntity.set_default_client(mock_ometa)

        # Test import
        importer = TestEntity.import_csv("test_glossary")
        csv_data = "parent,name\n,term1"
        importer.csv_data = csv_data
        result = importer.execute()

        # Verify
        assert result == {"created": 3}
        mock_ometa.import_csv.assert_called_once_with(
            entity=Glossary, name="test_glossary", csv_data=csv_data, dry_run=False
        )
