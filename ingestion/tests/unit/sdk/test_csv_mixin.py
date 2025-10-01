"""
Unit tests for CSV mixin functionality.
"""
from unittest.mock import Mock, patch

import pytest

from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User


class TestCsvMixin:
    """Test CSV mixin methods."""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = Mock()

    @patch("metadata.ingestion.ometa.mixins.csv_mixin.CSVMixin._get_csv_endpoint")
    def test_export_csv(self, mock_get_endpoint):
        """Test export_csv method."""
        from metadata.ingestion.ometa.mixins.csv_mixin import CSVMixin

        # Create a mock client
        mock_client = Mock()
        mock_client.get = Mock(return_value="csv,data,here")

        # Create instance with mocked client
        mixin = CSVMixin()
        mixin.client = mock_client
        mock_get_endpoint.return_value = "glossaries"

        # Test export
        result = mixin.export_csv(Glossary, "test_glossary")

        # Verify
        assert result == "csv,data,here"
        mock_client.get.assert_called_once_with("/glossaries/name/test_glossary/export")
        mock_get_endpoint.assert_called_once_with(Glossary)

    @patch("metadata.ingestion.ometa.mixins.csv_mixin.CSVMixin._get_csv_endpoint")
    def test_export_csv_async(self, mock_get_endpoint):
        """Test export_csv_async method."""
        from metadata.ingestion.ometa.mixins.csv_mixin import CSVMixin

        # Create a mock client
        mock_client = Mock()
        mock_client.get = Mock(return_value={"jobId": "job-123"})

        # Create instance with mocked client
        mixin = CSVMixin()
        mixin.client = mock_client
        mock_get_endpoint.return_value = "glossaries"

        # Test async export
        result = mixin.export_csv_async(Glossary, "test_glossary")

        # Verify
        assert result == "job-123"
        mock_client.get.assert_called_once_with(
            "/glossaries/name/test_glossary/exportAsync"
        )

    @patch("metadata.ingestion.ometa.mixins.csv_mixin.CSVMixin._get_csv_endpoint")
    def test_import_csv(self, mock_get_endpoint):
        """Test import_csv method."""
        from metadata.ingestion.ometa.mixins.csv_mixin import CSVMixin

        # Create a mock client
        mock_client = Mock()
        mock_client.put = Mock(return_value={"created": 5, "updated": 2})

        # Create instance with mocked client
        mixin = CSVMixin()
        mixin.client = mock_client
        mock_get_endpoint.return_value = "glossaries"

        # Test import
        csv_data = "parent,name,description\n,term1,Test term"
        result = mixin.import_csv(Glossary, "test_glossary", csv_data, dry_run=False)

        # Verify
        assert result == {"created": 5, "updated": 2}
        mock_client.put.assert_called_once_with(
            "/glossaries/name/test_glossary/import",
            csv_data,
            headers={"Content-Type": "text/plain"},
        )

    @patch("metadata.ingestion.ometa.mixins.csv_mixin.CSVMixin._get_csv_endpoint")
    def test_import_csv_dry_run(self, mock_get_endpoint):
        """Test import_csv with dry_run=True."""
        from metadata.ingestion.ometa.mixins.csv_mixin import CSVMixin

        # Create a mock client
        mock_client = Mock()
        mock_client.put = Mock(return_value={"wouldCreate": 3, "wouldUpdate": 1})

        # Create instance with mocked client
        mixin = CSVMixin()
        mixin.client = mock_client
        mock_get_endpoint.return_value = "glossaries"

        # Test import with dry run
        csv_data = "parent,name,description\n,term1,Test term"
        result = mixin.import_csv(Glossary, "test_glossary", csv_data, dry_run=True)

        # Verify
        assert result == {"wouldCreate": 3, "wouldUpdate": 1}
        mock_client.put.assert_called_once_with(
            "/glossaries/name/test_glossary/import?dryRun=true",
            csv_data,
            headers={"Content-Type": "text/plain"},
        )

    @patch("metadata.ingestion.ometa.mixins.csv_mixin.CSVMixin._get_csv_endpoint")
    def test_import_csv_async(self, mock_get_endpoint):
        """Test import_csv_async method."""
        from metadata.ingestion.ometa.mixins.csv_mixin import CSVMixin

        # Create a mock client
        mock_client = Mock()
        mock_client.put = Mock(return_value={"jobId": "import-job-456"})

        # Create instance with mocked client
        mixin = CSVMixin()
        mixin.client = mock_client
        mock_get_endpoint.return_value = "glossaries"

        # Test async import
        csv_data = "parent,name,description\n,term1,Test term"
        result = mixin.import_csv_async(
            Glossary, "test_glossary", csv_data, dry_run=False
        )

        # Verify
        assert result == "import-job-456"
        mock_client.put.assert_called_once_with(
            "/glossaries/name/test_glossary/importAsync",
            csv_data,
            headers={"Content-Type": "text/plain"},
        )

    def test_get_csv_endpoint_glossary(self):
        # Mock CSV import
        # Mock CSV export
        """Test _get_csv_endpoint for Glossary."""
        from metadata.ingestion.ometa.mixins.csv_mixin import CSVMixin

        mixin = CSVMixin()
        endpoint = mixin._get_csv_endpoint(Glossary)
        # Glossary endpoint can be glossary or glossaries
        assert endpoint in ["glossary", "glossaries"]

    def test_get_csv_endpoint_team(self):
        """Test _get_csv_endpoint for Teams."""
        from metadata.ingestion.ometa.mixins.csv_mixin import CSVMixin

        mixin = CSVMixin()
        endpoint = mixin._get_csv_endpoint(Team)
        assert endpoint == "teams"

    def test_get_csv_endpoint_user(self):
        """Test _get_csv_endpoint for Users."""
        from metadata.ingestion.ometa.mixins.csv_mixin import CSVMixin

        mixin = CSVMixin()
        endpoint = mixin._get_csv_endpoint(User)
        assert endpoint == "users"

    def test_get_csv_endpoint_unsupported(self):
        """Test _get_csv_endpoint for unsupported entity type."""
        from metadata.generated.schema.entity.data.chart import Chart
        from metadata.ingestion.ometa.mixins.csv_mixin import CSVMixin

        mixin = CSVMixin()

        with pytest.raises(ValueError, match="CSV operations not supported"):
            mixin._get_csv_endpoint(Chart)


class TestBaseEntityCsvIntegration:
    """Test BaseEntity CSV operations integration."""

    @patch("metadata.sdk.entities.base.BaseEntity._get_client")
    def test_export_csv_integration(self, mock_get_client):
        """Test BaseEntity.export_csv integration."""
        from metadata.sdk import BaseEntity

        # Create mock ometa client
        mock_ometa = Mock()
        mock_ometa.export_csv = Mock(return_value="exported,csv,data")
        mock_get_client.return_value = mock_ometa

        # Create test entity class
        class TestEntity(BaseEntity):
            @classmethod
            def entity_type(cls):
                return Glossary

        # Test export
        exporter = TestEntity.export_csv("test_glossary")
        result = exporter.execute()

        # Verify
        assert result == "exported,csv,data"
        mock_ometa.export_csv.assert_called_once_with(
            entity=Glossary, name="test_glossary"
        )

    @patch("metadata.sdk.entities.base.BaseEntity._get_client")
    def test_import_csv_integration(self, mock_get_client):
        """Test BaseEntity.import_csv integration."""
        from metadata.sdk import BaseEntity

        # Create mock ometa client
        mock_ometa = Mock()
        mock_ometa.import_csv = Mock(return_value={"created": 10})
        mock_get_client.return_value = mock_ometa

        # Create test entity class
        class TestEntity(BaseEntity):
            @classmethod
            def entity_type(cls):
                return Glossary

        # Test import
        csv_data = "parent,name\n,test_term"
        importer = TestEntity.import_csv("test_glossary")
        importer.csv_data = csv_data
        importer.dry_run = False
        result = importer.execute()

        # Verify
        assert result == {"created": 10}
        mock_ometa.import_csv.assert_called_once_with(
            entity=Glossary, name="test_glossary", csv_data=csv_data, dry_run=False
        )

    @patch("metadata.sdk.entities.base.BaseEntity._get_client")
    def test_async_export_integration(self, mock_get_client):
        """Test BaseEntity async export integration."""
        from metadata.sdk import BaseEntity

        # Create mock ometa client
        mock_ometa = Mock()
        mock_ometa.export_csv_async = Mock(return_value="export-job-789")
        mock_get_client.return_value = mock_ometa

        # Create test entity class
        class TestEntity(BaseEntity):
            @classmethod
            def entity_type(cls):
                return Glossary

        # Test async export
        exporter = TestEntity.export_csv("test_glossary")
        result = exporter.execute_async()

        # Verify
        assert result == "export-job-789"
        mock_ometa.export_csv_async.assert_called_once_with(
            entity=Glossary, name="test_glossary"
        )

    @patch("metadata.sdk.entities.base.BaseEntity._get_client")
    def test_async_import_integration(self, mock_get_client):
        """Test BaseEntity async import integration."""
        from metadata.sdk import BaseEntity

        # Create mock ometa client
        mock_ometa = Mock()
        mock_ometa.import_csv_async = Mock(return_value="import-job-999")
        mock_get_client.return_value = mock_ometa

        # Create test entity class
        class TestEntity(BaseEntity):
            @classmethod
            def entity_type(cls):
                return Glossary

        # Test async import
        csv_data = "parent,name\n,async_term"
        importer = TestEntity.import_csv("test_glossary")
        importer.csv_data = csv_data
        importer.dry_run = False
        result = importer.execute_async()

        # Verify
        assert result == "import-job-999"
        mock_ometa.import_csv_async.assert_called_once_with(
            entity=Glossary, name="test_glossary", csv_data=csv_data, dry_run=False
        )
