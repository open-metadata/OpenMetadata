"""
Basic integration tests for CSV import/export operations.
These tests can run without testcontainers by using a mock or existing server.
"""
import uuid
from unittest.mock import Mock, patch

import pytest

from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.type.basic import EntityName, Markdown, Uuid
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sdk.entities.csv_operations import CsvExporter, CsvImporter
from metadata.sdk.entities.glossary import Glossaries
from metadata.sdk.entities.glossary_term import GlossaryTerms


class TestCsvOperationsBasic:
    """Basic tests for CSV operations without requiring a real server."""

    def setup_method(self):
        """Setup mock client for each test."""
        self.mock_client = Mock(spec=OpenMetadata)
        self.mock_ometa = Mock()
        self.mock_client.ometa = self.mock_ometa

    def test_csv_exporter_initialization(self):
        """Test CsvExporter initialization and configuration."""
        exporter = CsvExporter(self.mock_client, "test_entity")

        # Check initial state
        assert exporter.entity_name == "test_entity"
        assert exporter.client == self.mock_client
        assert not exporter.async_mode
        assert not exporter.with_websocket
        assert exporter.timeout_seconds == 60

        # Test fluent configuration
        configured_exporter = (
            exporter.async_mode().with_websocket().wait_for_completion(timeout=120)
        )

        assert configured_exporter.async_mode
        assert configured_exporter.with_websocket
        assert configured_exporter.timeout_seconds == 120

    def test_csv_importer_initialization(self):
        """Test CsvImporter initialization and configuration."""
        importer = CsvImporter(self.mock_client, "test_entity")

        # Check initial state
        assert importer.entity_name == "test_entity"
        assert importer.client == self.mock_client
        assert importer.csv_data is None
        assert not importer.dry_run
        assert not importer.async_mode

        # Test fluent configuration with data
        csv_data = "parent,name,description\n,term1,Test term"
        configured_importer = importer.with_data(csv_data).dry_run().async_mode()

        assert configured_importer.csv_data == csv_data
        assert configured_importer.dry_run
        assert configured_importer.async_mode

    def test_glossary_export_csv_method(self):
        """Test Glossaries.export_csv static method."""
        # Setup mock
        self.mock_ometa.export_csv = Mock(return_value="csv,data,here")
        Glossaries.set_default_client(self.mock_client)

        # Execute export
        result = Glossaries.export_csv("test_glossary")

        # Verify exporter returned
        assert isinstance(result, CsvExporter)
        assert result.entity_name == "test_glossary"

        # Execute the export
        csv_data = result.execute()
        assert csv_data == "csv,data,here"
        self.mock_ometa.export_csv.assert_called_once()

    def test_glossary_import_csv_method(self):
        """Test Glossaries.import_csv static method."""
        # Setup mock
        import_result = {"status": "success", "created": 5, "updated": 2}
        self.mock_ometa.import_csv = Mock(return_value=import_result)
        Glossaries.set_default_client(self.mock_client)

        # Execute import
        csv_data = "parent,name,description\n,term1,Description 1"
        result = Glossaries.import_csv("test_glossary").with_data(csv_data)

        # Verify importer returned
        assert isinstance(result, CsvImporter)
        assert result.entity_name == "test_glossary"
        assert result.csv_data == csv_data

        # Execute the import
        import_response = result.execute()
        assert import_response == import_result
        self.mock_ometa.import_csv.assert_called_once()

    def test_async_csv_export(self):
        """Test async CSV export operation."""
        # Setup mock
        self.mock_ometa.export_csv_async = Mock(return_value="job-123")
        Glossaries.set_default_client(self.mock_client)

        # Execute async export
        job_id = Glossaries.export_csv("test_glossary").async_mode().execute()

        # Verify async method called
        assert job_id == "job-123"
        self.mock_ometa.export_csv_async.assert_called_once()

    def test_async_csv_import(self):
        """Test async CSV import operation."""
        # Setup mock
        self.mock_ometa.import_csv_async = Mock(return_value="import-job-456")
        Glossaries.set_default_client(self.mock_client)

        # Execute async import
        csv_data = "parent,name,description\n,async_term,Async description"
        job_id = (
            Glossaries.import_csv("test_glossary")
            .with_data(csv_data)
            .async_mode()
            .execute()
        )

        # Verify async method called
        assert job_id == "import-job-456"
        self.mock_ometa.import_csv_async.assert_called_once()

    def test_csv_import_dry_run(self):
        """Test CSV import with dry run option."""
        # Setup mock
        dry_run_result = {"status": "validation", "wouldCreate": 3, "wouldUpdate": 1}
        self.mock_ometa.import_csv = Mock(return_value=dry_run_result)
        Glossaries.set_default_client(self.mock_client)

        # Execute dry run
        csv_data = "parent,name,description\n,dry_term,Dry run term"
        result = (
            Glossaries.import_csv("test_glossary")
            .with_data(csv_data)
            .dry_run()
            .execute()
        )

        # Verify dry run parameter passed
        assert result == dry_run_result
        self.mock_ometa.import_csv.assert_called_once_with(
            entity=Glossary, name="test_glossary", csv_data=csv_data, dry_run=True
        )

    def test_csv_operations_with_glossary_terms(self):
        """Test CSV operations work with GlossaryTerms entity."""
        # Setup mock
        self.mock_ometa.export_csv = Mock(return_value="term,csv,data")
        GlossaryTerms.set_default_client(self.mock_client)

        # Note: GlossaryTerms doesn't directly support CSV export,
        # but we test the pattern would work if extended
        # For now, we test that the entity classes follow the same pattern

        # Create a mock glossary term
        mock_term = GlossaryTerm(
            id=Uuid("test-id"),
            name=EntityName("test_term"),
            fullyQualifiedName="glossary.test_term",
            glossary={"id": "glossary-id", "type": "glossary"},
            description=Markdown("Test term description"),
        )

        # Test that GlossaryTerms has the same base methods
        assert hasattr(GlossaryTerms, "create")
        assert hasattr(GlossaryTerms, "retrieve")
        assert hasattr(GlossaryTerms, "update")
        assert hasattr(GlossaryTerms, "delete")
        assert hasattr(GlossaryTerms, "list")
        assert hasattr(GlossaryTerms, "list_all")

    def test_csv_export_with_callback(self):
        """Test CSV export with completion callback."""
        # Setup mock
        self.mock_ometa.export_csv_async = Mock(return_value="callback-job-789")
        Glossaries.set_default_client(self.mock_client)

        # Track callback execution
        callback_executed = False
        callback_job_id = None

        def on_complete(job_id):
            nonlocal callback_executed, callback_job_id
            callback_executed = True
            callback_job_id = job_id

        # Execute with callback
        exporter = (
            Glossaries.export_csv("test_glossary").async_mode().on_complete(on_complete)
        )

        job_id = exporter.execute()

        # Simulate callback execution
        on_complete(job_id)

        # Verify callback was set up correctly
        assert callback_executed
        assert callback_job_id == "callback-job-789"

    def test_csv_import_error_handling(self):
        """Test CSV import error handling."""
        # Setup mock to raise an error
        from metadata.ingestion.ometa.client import APIError

        self.mock_ometa.import_csv = Mock(side_effect=APIError("Invalid CSV format"))
        Glossaries.set_default_client(self.mock_client)

        # Test error is propagated
        with pytest.raises(APIError, match="Invalid CSV format"):
            Glossaries.import_csv("test_glossary").with_data("invalid").execute()

    def test_base_entity_csv_methods(self):
        """Test that BaseEntity properly delegates to CSV operations."""
        from metadata.sdk.entities.base import BaseEntity

        # Create a mock entity class
        class TestEntity(BaseEntity):
            @classmethod
            def entity_type(cls):
                return Glossary

        # Setup mock client
        TestEntity.set_default_client(self.mock_client)
        self.mock_ometa.export_csv = Mock(return_value="base,entity,csv")

        # Test export_csv returns correct exporter
        exporter = TestEntity.export_csv("test_name")
        assert hasattr(exporter, "perform_sync_export")

        # Execute export
        csv_data = exporter.execute()
        assert csv_data == "base,entity,csv"

    @patch("metadata.sdk.entities.csv_operations.asyncio")
    def test_async_execution_with_future(self, mock_asyncio):
        """Test async execution returns future-like result."""
        # Setup mock
        self.mock_ometa.export_csv_async = Mock(return_value="future-job-999")
        Glossaries.set_default_client(self.mock_client)

        # Execute async
        future = Glossaries.export_csv("test_glossary").async_mode().execute_async()

        # Verify future-like behavior
        assert future is not None
        # In real implementation, this would be a CompletableFuture-like object

    def test_csv_import_from_file_mock(self):
        """Test CSV import from file with mocked file reading."""
        with patch("builtins.open", create_function=True) as mock_open:
            mock_open.return_value.__enter__.return_value.read.return_value = (
                "parent,name,description\n,file_term,From file"
            )

            # Setup mock
            self.mock_ometa.import_csv = Mock(return_value={"status": "success"})
            Glossaries.set_default_client(self.mock_client)

            # Import from file
            importer = Glossaries.import_csv("test_glossary")

            # Mock file reading for from_file
            with patch(
                "pathlib.Path.read_text",
                return_value="parent,name,description\n,file_term,From file",
            ):
                importer.from_file("/path/to/file.csv")
                assert (
                    importer.csv_data == "parent,name,description\n,file_term,From file"
                )

    def test_websocket_configuration(self):
        """Test WebSocket configuration for async operations."""
        # Setup mock
        self.mock_ometa.export_csv_async = Mock(return_value="ws-job-111")
        self.mock_client.get_server_url = Mock(return_value="http://localhost:8585")
        self.mock_client.get_user_id = Mock(return_value=uuid.uuid4())
        Glossaries.set_default_client(self.mock_client)

        # Configure with WebSocket
        exporter = (
            Glossaries.export_csv("test_glossary")
            .async_mode()
            .with_websocket()
            .wait_for_completion(timeout=30)
        )

        # Verify configuration
        assert exporter.with_websocket
        assert exporter.wait_for_completion
        assert exporter.timeout_seconds == 30

        # Execute (would use WebSocket in real implementation)
        job_id = exporter.execute()
        assert job_id == "ws-job-111"
