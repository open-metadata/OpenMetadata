import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow


@pytest.mark.xdist_group("trino-integration")
class TestTrinoMetadataIntegration:
    """Test suite for Trino metadata ingestion integration tests."""

    @pytest.fixture(scope="class")
    def setup(self, run_workflow, ingestion_config, create_test_data):
        """Set up the test environment by running the metadata workflow."""
        run_workflow(MetadataWorkflow, ingestion_config)
        yield
        # No cleanup needed as it's handled by the fixtures

    @pytest.mark.parametrize(
        "table_name",
        [
            "{database_service}.minio.my_schema.table",
            "{database_service}.minio.my_schema.titanic",
            "{database_service}.minio.my_schema.iris",
            "{database_service}.minio.my_schema.userdata",
            "{database_service}.minio.my_schema.empty",
        ],
        ids=lambda x: x.split(".")[-1],
    )
    def test_metadata_ingestion(
        self, setup, db_service, metadata: OpenMetadata, table_name
    ):
        """
        Test metadata ingestion for various tables.

        Args:
            setup: Fixture that sets up the test environment
            db_service: Database service fixture
            metadata: OpenMetadata API instance
            table_name: Name of the table to test
        """
        metadata.get_by_name(
            Table,
            table_name.format(database_service=db_service.fullyQualifiedName.root),
        )
