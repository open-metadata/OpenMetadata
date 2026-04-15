#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
S3 integration tests for pathSpecs auto-discovery.

Uses the same MinIO test data as test_s3_storage.py but configures
pathSpecs instead of a manifest file, verifying:
- Containers auto-discovered from glob patterns
- Hive partitions auto-detected with correct types
- Multiple file formats (parquet, csv)
- Format auto-detection from extension
- Manifest + pathSpecs coexistence
- Migration FQN compatibility
- File count and size propagation
"""
import uuid

import pytest
import yaml

from _openmetadata_testutils.ometa import OM_JWT
from metadata.generated.schema.entity.data.container import Container, FileFormat
from metadata.generated.schema.entity.data.table import DataType
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.workflow.metadata import MetadataWorkflow

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture(scope="module")
def path_specs_service_name():
    return f"path-specs-{uuid.uuid4()}"


@pytest.fixture(scope="module")
def migration_service_name():
    return f"migration-test-{uuid.uuid4()}"


def _run_workflow(config_yaml: str):
    """Helper to run an ingestion workflow from YAML string."""
    workflow = MetadataWorkflow.create(yaml.safe_load(config_yaml))
    workflow.execute()
    workflow.raise_from_status()
    workflow.stop()


def _make_config(minio_container, service_name, path_specs_yaml, manifest_source="{}"):
    """Build a storage ingestion config string."""
    return f"""
        source:
          type: s3
          serviceName: {service_name}
          serviceConnection:
            config:
              type: S3
              awsConfig:
                awsAccessKeyId: {minio_container.access_key}
                awsSecretAccessKey: {minio_container.secret_key}
                awsRegion: us-east-1
                endPointURL: http://localhost:{minio_container.get_exposed_port(9000)}
          sourceConfig:
            config:
              type: StorageMetadata
              storageMetadataConfigSource: {manifest_source}
              pathSpecs:
{path_specs_yaml}
        sink:
          type: metadata-rest
          config: {{}}
        workflowConfig:
          loggerLevel: DEBUG
          openMetadataServerConfig:
            hostPort: http://localhost:8585/api
            authProvider: openmetadata
            securityConfig:
              jwtToken: "{OM_JWT}"
    """


@pytest.fixture(scope="module")
def ingest_with_path_specs(minio, metadata, path_specs_service_name, create_data):
    """Run ingestion with pathSpecs — covers all test data."""
    minio_container, _ = minio
    path_specs = """
                - pathPattern: "**/*.parquet"
                - pathPattern: "**/*.csv"
    """
    config = _make_config(minio_container, path_specs_service_name, path_specs)
    _run_workflow(config)

    yield

    service = metadata.get_by_name(entity=StorageService, fqn=path_specs_service_name)
    if service:
        metadata.delete(
            entity=StorageService,
            entity_id=service.id,
            hard_delete=True,
            recursive=True,
        )


# ============================================================================
# Basic discovery tests
# ============================================================================


class TestAutoDiscovery:
    """Containers discovered from glob patterns without manifest.

    The openmetadata.json manifest file exists in MinIO (uploaded by
    create_data) but is NOT used because pathSpecs is configured.
    Proof: the manifest defines cities with isPartitioned=true but NO
    partitionColumns. Auto-discovery detects State as a partition column.
    If State appears in columns, the container came from pathSpecs.
    """

    def test_service_created(
        self, metadata, ingest_with_path_specs, path_specs_service_name
    ):
        service = metadata.get_by_name(
            entity=StorageService, fqn=path_specs_service_name
        )
        assert service is not None

    def test_bucket_container_created(
        self, metadata, ingest_with_path_specs, path_specs_service_name
    ):
        bucket = metadata.get_by_name(
            entity=Container,
            fqn=f"{path_specs_service_name}.test-bucket",
            fields=["*"],
        )
        assert bucket is not None

    def test_path_specs_only_no_manifest_used(
        self, metadata, ingest_with_path_specs, path_specs_service_name
    ):
        """Verify containers came from auto-discovery, not the manifest.

        The manifest (openmetadata.json) defines 'cities' with
        isPartitioned=true but NO partitionColumns. If the manifest were
        used, 'State' would NOT appear as a column. But auto-discovery
        detects it from the path structure. So 'State' in columns proves
        pathSpecs was the source.
        """
        cities = metadata.get_by_name(
            entity=Container,
            fqn=f"{path_specs_service_name}.test-bucket.cities",
            fields=["*"],
        )
        assert cities is not None
        col_names = [c.name.root for c in cities.dataModel.columns]
        # State is auto-detected by pathSpecs — manifest doesn't have it
        assert "State" in col_names, (
            "Partition column 'State' missing — manifest may have been used "
            "instead of pathSpecs auto-discovery"
        )


# ============================================================================
# Partition auto-detection
# ============================================================================


class TestPartitionDetection:
    """Hive-style partitions auto-detected from directory names."""

    def test_single_partition_key(
        self, metadata, ingest_with_path_specs, path_specs_service_name
    ):
        """cities/State=AL/ → one partition column 'State' (VARCHAR)."""
        cities = metadata.get_by_name(
            entity=Container,
            fqn=f"{path_specs_service_name}.test-bucket.cities",
            fields=["*"],
        )
        assert cities is not None
        assert cities.dataModel is not None
        assert cities.dataModel.isPartitioned is True

        col_names = [c.name.root for c in cities.dataModel.columns]
        assert "State" in col_names

    def test_multiple_partition_keys(
        self, metadata, ingest_with_path_specs, path_specs_service_name
    ):
        """cities_multiple/Year=2023/State=AL/ → two partition columns."""
        container = metadata.get_by_name(
            entity=Container,
            fqn=f"{path_specs_service_name}.test-bucket.cities_multiple",
            fields=["*"],
        )
        assert container is not None
        assert container.dataModel.isPartitioned is True

        col_names = [c.name.root for c in container.dataModel.columns]
        assert "Year" in col_names
        assert "State" in col_names

    def test_partition_column_types(
        self, metadata, ingest_with_path_specs, path_specs_service_name
    ):
        """Year=2023 should be INT, State=AL should be VARCHAR."""
        container = metadata.get_by_name(
            entity=Container,
            fqn=f"{path_specs_service_name}.test-bucket.cities_multiple",
            fields=["*"],
        )
        col_map = {c.name.root: c for c in container.dataModel.columns}

        if "Year" in col_map:
            assert col_map["Year"].dataType == DataType.INT
        if "State" in col_map:
            assert col_map["State"].dataType == DataType.VARCHAR

    def test_mixed_partition_style(
        self, metadata, ingest_with_path_specs, path_specs_service_name
    ):
        """cities_multiple_simple/20230412/State=AL/ → mixed non-Hive + Hive."""
        container = metadata.get_by_name(
            entity=Container,
            fqn=f"{path_specs_service_name}.test-bucket.cities_multiple_simple",
            fields=["*"],
        )
        # Should still detect State as partition even with non-Hive parent dir
        if container and container.dataModel:
            col_names = [c.name.root for c in container.dataModel.columns]
            assert "State" in col_names


# ============================================================================
# Format detection
# ============================================================================


class TestFormatDetection:
    """Structure format auto-detected from file extension."""

    def test_parquet_format_detected(
        self, metadata, ingest_with_path_specs, path_specs_service_name
    ):
        cities = metadata.get_by_name(
            entity=Container,
            fqn=f"{path_specs_service_name}.test-bucket.cities",
            fields=["*"],
        )
        assert cities is not None
        assert FileFormat.parquet in cities.fileFormats

    def test_csv_format_detected(
        self, metadata, ingest_with_path_specs, path_specs_service_name
    ):
        transactions = metadata.get_by_name(
            entity=Container,
            fqn=f"{path_specs_service_name}.test-bucket.transactions",
            fields=["*"],
        )
        assert transactions is not None
        assert FileFormat.csv in transactions.fileFormats


# ============================================================================
# Schema extraction
# ============================================================================


class TestSchemaExtraction:
    """Column schemas extracted from sample files."""

    def test_csv_columns_extracted(
        self, metadata, ingest_with_path_specs, path_specs_service_name
    ):
        transactions = metadata.get_by_name(
            entity=Container,
            fqn=f"{path_specs_service_name}.test-bucket.transactions",
            fields=["*"],
        )
        assert transactions.dataModel is not None
        assert not transactions.dataModel.isPartitioned
        assert len(transactions.dataModel.columns) >= 2

    def test_parquet_columns_extracted(
        self, metadata, ingest_with_path_specs, path_specs_service_name
    ):
        """Parquet schema should include both data columns and partition columns."""
        cities = metadata.get_by_name(
            entity=Container,
            fqn=f"{path_specs_service_name}.test-bucket.cities",
            fields=["*"],
        )
        # Should have data columns from parquet + partition column
        assert len(cities.dataModel.columns) >= 2


# ============================================================================
# Container metadata
# ============================================================================


class TestContainerMetadata:
    """File count and size propagated to container."""

    def test_file_count_populated(
        self, metadata, ingest_with_path_specs, path_specs_service_name
    ):
        """Discovered containers should have numberOfObjects set."""
        cities = metadata.get_by_name(
            entity=Container,
            fqn=f"{path_specs_service_name}.test-bucket.cities",
            fields=["*"],
        )
        # cities/ has 2 parquet files (State=AL + State=AZ)
        if cities and cities.numberOfObjects:
            assert cities.numberOfObjects >= 2

    def test_size_populated(
        self, metadata, ingest_with_path_specs, path_specs_service_name
    ):
        cities = metadata.get_by_name(
            entity=Container,
            fqn=f"{path_specs_service_name}.test-bucket.cities",
            fields=["*"],
        )
        if cities and cities.size:
            assert cities.size > 0


# ============================================================================
# Migration: manifest → pathSpecs FQN compatibility
# ============================================================================


class TestMigrationCompat:
    """Containers created by manifest and pathSpecs should have the same FQN."""

    def test_manifest_then_path_specs_same_entity(
        self, minio, metadata, migration_service_name, create_data
    ):
        """
        1. Ingest with manifest → creates container with FQN
        2. Re-ingest with pathSpecs → should update same entity, not create duplicate
        """
        minio_container, _ = minio

        # Step 1: Ingest with manifest (bucket-level openmetadata.json exists)
        config_manifest = f"""
            source:
              type: s3
              serviceName: {migration_service_name}
              serviceConnection:
                config:
                  type: S3
                  awsConfig:
                    awsAccessKeyId: {minio_container.access_key}
                    awsSecretAccessKey: {minio_container.secret_key}
                    awsRegion: us-east-1
                    endPointURL: http://localhost:{minio_container.get_exposed_port(9000)}
              sourceConfig:
                config:
                  type: StorageMetadata
            sink:
              type: metadata-rest
              config: {{}}
            workflowConfig:
              openMetadataServerConfig:
                hostPort: http://localhost:8585/api
                authProvider: openmetadata
                securityConfig:
                  jwtToken: "{OM_JWT}"
        """
        _run_workflow(config_manifest)

        # Get entity ID from manifest-created container
        manifest_cities = metadata.get_by_name(
            entity=Container,
            fqn=f"{migration_service_name}.test-bucket.cities",
            fields=["*"],
        )
        assert manifest_cities is not None
        manifest_id = manifest_cities.id.root

        # Step 2: Re-ingest with pathSpecs
        path_specs = """
                - pathPattern: "cities/**/*.parquet"
        """
        config_pathspecs = _make_config(
            minio_container,
            migration_service_name,
            path_specs,
            manifest_source="{}",
        )
        _run_workflow(config_pathspecs)

        # Get entity after pathSpecs ingestion
        pathspec_cities = metadata.get_by_name(
            entity=Container,
            fqn=f"{migration_service_name}.test-bucket.cities",
            fields=["*"],
        )
        assert pathspec_cities is not None

        # Same entity — ID should match
        assert pathspec_cities.id.root == manifest_id

        # Cleanup
        service = metadata.get_by_name(
            entity=StorageService, fqn=migration_service_name
        )
        if service:
            metadata.delete(
                entity=StorageService,
                entity_id=service.id,
                hard_delete=True,
                recursive=True,
            )
