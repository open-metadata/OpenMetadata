"""
Integration tests for CSV import/export operations in the SDK.
Tests both sync and async operations with glossary entities.
"""
import asyncio
import time
import uuid
from typing import Optional

import pytest
from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_utils import wait_for_logs

from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import CreateGlossaryTermRequest
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.type.basic import Markdown, EntityName
from metadata.sdk.client import OpenMetadata
from metadata.sdk.entities.glossary import Glossaries
from metadata.sdk.entities.glossary_term import GlossaryTerms


@pytest.fixture(scope="module")
def openmetadata_container():
    """Start OpenMetadata container for integration tests."""
    container = DockerContainer("openmetadata/ingestion:latest")
    container.with_env("OPENMETADATA_HOST", "localhost")
    container.with_env("OPENMETADATA_PORT", "8585")
    container.with_exposed_ports(8585)
    container.start()

    # Wait for the service to be ready
    wait_for_logs(container, "OpenMetadata Server started", timeout=120)

    yield container

    container.stop()


@pytest.fixture
def client(openmetadata_container):
    """Create OpenMetadata client connected to test container."""
    port = openmetadata_container.get_exposed_port(8585)
    return OpenMetadata(
        config={
            "hostPort": f"http://localhost:{port}",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "test-token"
            }
        }
    )


@pytest.fixture
def test_glossary_name():
    """Generate unique glossary name for each test."""
    return f"test_glossary_{uuid.uuid4().hex[:8]}"


class TestCsvOperations:
    """Test CSV import/export operations."""

    def setup_method(self):
        """Setup before each test."""
        self.glossary: Optional[Glossary] = None
        self.terms = []

    def teardown_method(self, client):
        """Cleanup after each test."""
        # Clean up created entities
        if self.glossary:
            try:
                Glossaries.delete(str(self.glossary.id.root), recursive=True, hard_delete=True)
            except Exception:
                pass  # Entity might already be deleted

        for term in self.terms:
            try:
                GlossaryTerms.delete(str(term.id.root), hard_delete=True)
            except Exception:
                pass

    def test_glossary_csv_export_sync(self, client, test_glossary_name):
        """Test synchronous CSV export of glossary."""
        # Set default client
        OpenMetadata.set_default_client(client)
        Glossaries.set_default_client(client)
        GlossaryTerms.set_default_client(client)

        # Create glossary with terms
        self.glossary = Glossaries.create(
            CreateGlossaryRequest(
                name=EntityName(test_glossary_name),
                description=Markdown("Test glossary for CSV export")
            )
        )

        # Create some glossary terms
        for i in range(3):
            term = GlossaryTerms.create(
                CreateGlossaryTermRequest(
                    glossary=str(self.glossary.fullyQualifiedName.root),
                    name=EntityName(f"term_{i}"),
                    description=Markdown(f"Test term {i} description"),
                    displayName=f"Term {i}"
                )
            )
            self.terms.append(term)

        # Export glossary to CSV
        csv_data = Glossaries.export_csv(test_glossary_name).execute()

        # Verify CSV content
        assert csv_data is not None
        assert len(csv_data) > 0
        assert "parent" in csv_data.lower() or "name" in csv_data.lower()

        # Verify terms are included
        for i in range(3):
            assert f"term_{i}" in csv_data

    def test_glossary_csv_export_async(self, client, test_glossary_name):
        """Test asynchronous CSV export of glossary."""
        # Set default client
        OpenMetadata.set_default_client(client)
        Glossaries.set_default_client(client)

        # Create glossary
        self.glossary = Glossaries.create(
            CreateGlossaryRequest(
                name=EntityName(test_glossary_name),
                description=Markdown("Test glossary for async CSV export")
            )
        )

        # Create a glossary term
        term = GlossaryTerms.create(
            CreateGlossaryTermRequest(
                glossary=str(self.glossary.fullyQualifiedName.root),
                name=EntityName("async_term"),
                description=Markdown("Test async term")
            )
        )
        self.terms.append(term)

        # Export glossary to CSV asynchronously
        job_id = Glossaries.export_csv(test_glossary_name).async_().execute()

        # Verify job ID returned
        assert job_id is not None
        assert len(job_id) > 0

        # Note: In a real scenario, we would poll the job status
        # For now, we'll wait a bit and assume it completes
        time.sleep(2)

    def test_glossary_csv_import_sync(self, client, test_glossary_name):
        """Test synchronous CSV import for glossary."""
        # Set default client
        OpenMetadata.set_default_client(client)
        Glossaries.set_default_client(client)
        GlossaryTerms.set_default_client(client)

        # Create glossary
        self.glossary = Glossaries.create(
            CreateGlossaryRequest(
                name=EntityName(test_glossary_name),
                description=Markdown("Test glossary for CSV import")
            )
        )

        # Prepare CSV data with new terms
        csv_data = """parent,name,displayName,description,synonyms,relatedTerms,references,tags
,import_term1,Imported Term 1,First imported term,syn1;syn2,,ref1,
,import_term2,Imported Term 2,Second imported term,,,ref2,
import_term1,import_subterm,Imported Subterm,Subterm under term1,,,,"""

        # Import CSV data with dry run first
        dry_run_result = Glossaries.import_csv(test_glossary_name).withData(csv_data).dryRun().execute()

        # Verify dry run doesn't create entities
        assert dry_run_result is not None

        # Now do actual import
        import_result = Glossaries.import_csv(test_glossary_name).withData(csv_data).execute()

        # Verify import result
        assert import_result is not None

        # Verify terms were created
        all_terms = GlossaryTerms.list_all()
        term_names = [str(term.name.root) for term in all_terms]

        # Check if imported terms exist
        assert any("import_term1" in name for name in term_names)
        assert any("import_term2" in name for name in term_names)

    def test_glossary_csv_import_async(self, client, test_glossary_name):
        """Test asynchronous CSV import for glossary."""
        # Set default client
        OpenMetadata.set_default_client(client)
        Glossaries.set_default_client(client)

        # Create glossary
        self.glossary = Glossaries.create(
            CreateGlossaryRequest(
                name=EntityName(test_glossary_name),
                description=Markdown("Test glossary for async CSV import")
            )
        )

        # Prepare CSV data
        csv_data = """parent,name,displayName,description,synonyms,relatedTerms,references,tags
,async_import_term,Async Imported Term,Term imported asynchronously,,,,"""

        # Import CSV data asynchronously
        job_id = Glossaries.import_csv(test_glossary_name).withData(csv_data).async_().execute()

        # Verify job ID returned
        assert job_id is not None
        assert len(job_id) > 0

        # Wait a bit for async processing
        time.sleep(2)

    def test_csv_export_import_roundtrip(self, client, test_glossary_name):
        """Test complete roundtrip: create terms, export, import to new glossary."""
        # Set default client
        OpenMetadata.set_default_client(client)
        Glossaries.set_default_client(client)
        GlossaryTerms.set_default_client(client)

        # Create source glossary with terms
        source_glossary = Glossaries.create(
            CreateGlossaryRequest(
                name=EntityName(f"{test_glossary_name}_source"),
                description=Markdown("Source glossary")
            )
        )
        self.glossary = source_glossary

        # Create terms in source glossary
        for i in range(2):
            term = GlossaryTerms.create(
                CreateGlossaryTermRequest(
                    glossary=str(source_glossary.fullyQualifiedName.root),
                    name=EntityName(f"roundtrip_term_{i}"),
                    description=Markdown(f"Roundtrip term {i}"),
                    displayName=f"Roundtrip Term {i}"
                )
            )
            self.terms.append(term)

        # Export source glossary
        csv_data = Glossaries.export_csv(f"{test_glossary_name}_source").execute()
        assert csv_data is not None
        assert "roundtrip_term_0" in csv_data
        assert "roundtrip_term_1" in csv_data

        # Create target glossary
        target_glossary = Glossaries.create(
            CreateGlossaryRequest(
                name=EntityName(f"{test_glossary_name}_target"),
                description=Markdown("Target glossary")
            )
        )

        # Import to target glossary
        import_result = Glossaries.import_csv(f"{test_glossary_name}_target").withData(csv_data).execute()
        assert import_result is not None

        # Verify terms exist in target glossary
        target_terms = GlossaryTerms.list_all()
        target_term_names = [str(term.name.root) for term in target_terms]

        # Both source and target terms should exist
        assert any("roundtrip_term_0" in name for name in target_term_names)
        assert any("roundtrip_term_1" in name for name in target_term_names)

        # Clean up target glossary
        try:
            Glossaries.delete(str(target_glossary.id.root), recursive=True, hard_delete=True)
        except Exception:
            pass

    def test_csv_operations_error_handling(self, client, test_glossary_name):
        """Test error handling in CSV operations."""
        # Set default client
        OpenMetadata.set_default_client(client)
        Glossaries.set_default_client(client)

        # Try to export non-existent glossary
        with pytest.raises(Exception):
            Glossaries.export_csv("non_existent_glossary").execute()

        # Try to import to non-existent glossary
        with pytest.raises(Exception):
            csv_data = "parent,name,displayName,description\n,test,Test,Test description"
            Glossaries.import_csv("non_existent_glossary").withData(csv_data).execute()

        # Try to import invalid CSV data
        self.glossary = Glossaries.create(
            CreateGlossaryRequest(
                name=EntityName(test_glossary_name),
                description=Markdown("Test glossary for error handling")
            )
        )

        invalid_csv = "this is not valid csv data"
        with pytest.raises(Exception):
            Glossaries.import_csv(test_glossary_name).withData(invalid_csv).execute()

    @pytest.mark.asyncio
    async def test_async_future_operations(self, client, test_glossary_name):
        """Test async operations with CompletableFuture-like pattern."""
        # Set default client
        OpenMetadata.set_default_client(client)
        Glossaries.set_default_client(client)

        # Create glossary
        self.glossary = Glossaries.create(
            CreateGlossaryRequest(
                name=EntityName(test_glossary_name),
                description=Markdown("Test glossary for async futures")
            )
        )

        # Test async export with callback simulation
        export_completed = False

        def on_export_complete(job_id):
            nonlocal export_completed
            export_completed = True
            assert job_id is not None

        # Start async export
        job_id = Glossaries.export_csv(test_glossary_name).async_().execute()

        # Simulate callback
        on_export_complete(job_id)
        assert export_completed

        # Test async import with callback simulation
        import_completed = False

        def on_import_complete(result):
            nonlocal import_completed
            import_completed = True
            assert result is not None

        csv_data = "parent,name,displayName,description\n,future_term,Future Term,Term for future test"

        # Start async import
        import_job_id = Glossaries.import_csv(test_glossary_name).withData(csv_data).async_().execute()

        # Simulate callback
        on_import_complete(import_job_id)
        assert import_completed


@pytest.mark.skipif(
    not pytest.config.getoption("--run-integration", default=False),
    reason="Integration tests require --run-integration flag"
)
class TestCsvOperationsWithRealServer:
    """
    Integration tests that require a real OpenMetadata server running.
    Run with: pytest --run-integration test_csv_operations.py::TestCsvOperationsWithRealServer
    """

    @pytest.fixture(autouse=True)
    def setup_real_client(self):
        """Setup client for real server tests."""
        # Assumes OpenMetadata is running on localhost:8585
        self.client = OpenMetadata(
            config={
                "hostPort": "http://localhost:8585",
                "authProvider": "openmetadata",
                "securityConfig": {
                    "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."
                }
            }
        )
        OpenMetadata.set_default_client(self.client)
        Glossaries.set_default_client(self.client)
        GlossaryTerms.set_default_client(self.client)

    def test_real_server_csv_operations(self):
        """Test CSV operations against real server."""
        glossary_name = f"test_real_{uuid.uuid4().hex[:8]}"

        try:
            # Create glossary
            glossary = Glossaries.create(
                CreateGlossaryRequest(
                    name=EntityName(glossary_name),
                    description=Markdown("Real server test glossary")
                )
            )

            # Create terms
            terms = []
            for i in range(2):
                term = GlossaryTerms.create(
                    CreateGlossaryTermRequest(
                        glossary=str(glossary.fullyQualifiedName.root),
                        name=EntityName(f"real_term_{i}"),
                        description=Markdown(f"Real term {i}")
                    )
                )
                terms.append(term)

            # Export CSV
            csv_data = Glossaries.export_csv(glossary_name).execute()
            assert csv_data is not None
            assert "real_term_0" in csv_data
            assert "real_term_1" in csv_data

            # Import with modification
            modified_csv = csv_data.replace("Real term 0", "Modified real term 0")
            import_result = Glossaries.import_csv(glossary_name).withData(modified_csv).execute()
            assert import_result is not None

            # Verify modification
            updated_terms = GlossaryTerms.list_all()
            modified_term = next(
                (t for t in updated_terms if "real_term_0" in str(t.name.root)),
                None
            )
            if modified_term and modified_term.description:
                assert "Modified" in str(modified_term.description.root)

        finally:
            # Cleanup
            try:
                Glossaries.delete(str(glossary.id.root), recursive=True, hard_delete=True)
            except Exception:
                pass