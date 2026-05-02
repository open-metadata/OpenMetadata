#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Integration tests for manifest wildcards and the defaultManifest fallback.

Runs against MinIO using the same fixtures as ``test_s3_storage.py``.
Each test uses a unique service name and a unique bucket so manifests
don't collide between scenarios.
"""

import json
import uuid
from io import BytesIO

import pytest
import yaml

from _openmetadata_testutils.ometa import OM_JWT
from metadata.generated.schema.entity.data.container import Container, FileFormat
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.workflow.metadata import MetadataWorkflow

# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


def _build_pipeline_config(
    *,
    service_name: str,
    minio_container,
    default_manifest_json: str | None = None,
) -> dict:
    """Build a storage ingestion pipeline config. ``default_manifest_json``
    is passed through unchanged — caller decides whether to send one."""
    sc_config: dict = {"type": "StorageMetadata"}
    if default_manifest_json is not None:
        sc_config["defaultManifest"] = default_manifest_json

    return {
        "source": {
            "type": "s3",
            "serviceName": service_name,
            "serviceConnection": {
                "config": {
                    "type": "S3",
                    "awsConfig": {
                        "awsAccessKeyId": minio_container.access_key,
                        "awsSecretAccessKey": minio_container.secret_key,
                        "awsRegion": "us-east-1",
                        "endPointURL": f"http://localhost:{minio_container.get_exposed_port(9000)}",
                    },
                    "bucketNames": [service_name],
                }
            },
            "sourceConfig": {"config": sc_config},
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "loggerLevel": "DEBUG",
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "authProvider": "openmetadata",
                "securityConfig": {"jwtToken": OM_JWT},
            },
        },
    }


def _run_workflow(config: dict) -> None:
    # Going through YAML mirrors the deployed path more faithfully.
    workflow = MetadataWorkflow.create(yaml.safe_load(yaml.safe_dump(config)))
    workflow.execute()
    workflow.raise_from_status()
    workflow.stop()


def _put_object(minio_client, bucket: str, key: str, body: bytes) -> None:
    minio_client.put_object(bucket, key, BytesIO(body), length=len(body))


def _cleanup_service(metadata, service_name: str) -> None:
    service = metadata.get_by_name(entity=StorageService, fqn=service_name)
    if service:
        metadata.delete(
            entity=StorageService,
            entity_id=service.id,
            hard_delete=True,
            recursive=True,
        )


def _copy_parquet_files(minio_client, src_bucket: str, src_prefix: str, dst_bucket: str, dst_prefix: str) -> None:
    """Copy all objects from ``src_bucket/src_prefix`` into
    ``dst_bucket/dst_prefix``. Used so each test bucket has fresh sample
    data independent of the shared ``test-bucket`` fixture."""
    for obj in minio_client.list_objects(src_bucket, prefix=src_prefix, recursive=True):
        relative = obj.object_name[len(src_prefix) :].lstrip("/")
        dst_key = f"{dst_prefix.rstrip('/')}/{relative}".lstrip("/") if relative else dst_prefix
        response = minio_client.get_object(src_bucket, obj.object_name)
        try:
            body = response.read()
        finally:
            response.close()
            response.release_conn()
        _put_object(minio_client, dst_bucket, dst_key, body)


# ----------------------------------------------------------------------
# Per-test bucket fixture
# ----------------------------------------------------------------------


@pytest.fixture
def wildcard_bucket(minio, bucket_name, create_data):
    """A dedicated bucket seeded with a few parquet files grouped into
    Hive-style partitions so we can exercise glob matching + partition
    auto-detection. Dropped after each test."""
    _, minio_client = minio
    bucket = f"wildcards-{uuid.uuid4().hex[:8]}"
    minio_client.make_bucket(bucket)

    # Reuse the already-uploaded ``cities`` dataset (State=AL/State=AZ
    # partitions with parquet files). We copy it into a couple of
    # distinct logical paths to exercise the glob expansion.
    _copy_parquet_files(minio_client, bucket_name, "cities/", bucket, "data/sales/")
    _copy_parquet_files(minio_client, bucket_name, "cities/", bucket, "data/orders/")
    _copy_parquet_files(minio_client, bucket_name, "cities/", bucket, "archive/old_sales/")

    yield bucket

    # Tear down: empty bucket then remove.
    for obj in minio_client.list_objects(bucket, recursive=True):
        minio_client.remove_object(bucket, obj.object_name)
    minio_client.remove_bucket(bucket)


# ----------------------------------------------------------------------
# Tests
# ----------------------------------------------------------------------


class TestBucketManifestWildcards:
    """A bucket with an openmetadata.json whose dataPath is a glob."""

    def test_glob_datapath_resolves_to_multiple_containers(self, minio, metadata, wildcard_bucket):
        _, minio_client = minio
        service_name = f"wc-glob-{uuid.uuid4().hex[:8]}"

        manifest = {
            "entries": [
                {
                    "dataPath": "data/**/*.parquet",
                    "structureFormat": "parquet",
                    "autoPartitionDetection": True,
                    "excludePaths": ["archive"],
                }
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(manifest).encode(),
        )

        # Service points at exactly this bucket.
        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            _run_workflow(config)

            # data/sales and data/orders should each be a container;
            # archive/old_sales must be excluded.
            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            orders = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/orders",
                fields=["*"],
            )
            assert sales is not None, "glob should match data/sales"
            assert orders is not None, "glob should match data/orders"
            assert FileFormat.parquet in sales.fileFormats
            assert FileFormat.parquet in orders.fileFormats

            archive = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.archive/old_sales",
                fields=["*"],
            )
            assert archive is None, "excludePaths should drop archive/"

            # Auto partition detection should surface State as a partition col.
            col_names = {c.name.root for c in (sales.dataModel.columns or [])}
            assert "State" in col_names, "autoPartitionDetection should infer the Hive partition column"
            assert sales.dataModel.isPartitioned is True
        finally:
            _cleanup_service(metadata, service_name)


class TestDefaultManifestFallback:
    """defaultManifest on the pipeline config is applied when a bucket
    has no openmetadata.json of its own."""

    def test_default_manifest_used_when_bucket_has_no_file(self, minio, metadata, wildcard_bucket):
        service_name = f"wc-default-{uuid.uuid4().hex[:8]}"

        default_manifest = json.dumps(
            {
                "entries": [
                    {
                        "containerName": wildcard_bucket,
                        "dataPath": "data/**/*.parquet",
                        "structureFormat": "parquet",
                        "autoPartitionDetection": True,
                    }
                ]
            }
        )
        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
            default_manifest_json=default_manifest,
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            _run_workflow(config)

            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            orders = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/orders",
                fields=["*"],
            )
            assert sales is not None, "defaultManifest glob should match data/sales"
            assert orders is not None, "defaultManifest glob should match data/orders"
            assert sales.dataModel.isPartitioned is True
        finally:
            _cleanup_service(metadata, service_name)


class TestBucketFileWinsOverDefault:
    """When both a bucket openmetadata.json and a defaultManifest exist,
    the bucket file must win (precedence)."""

    def test_bucket_file_takes_precedence(self, minio, metadata, wildcard_bucket):
        _, minio_client = minio
        service_name = f"wc-prec-{uuid.uuid4().hex[:8]}"

        # Bucket manifest: only data/sales
        bucket_manifest = {
            "entries": [
                {
                    "dataPath": "data/sales",
                    "structureFormat": "parquet",
                    "isPartitioned": True,
                }
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(bucket_manifest).encode(),
        )

        # Default manifest: would catch BOTH data/sales and data/orders.
        # If the bucket file wins, only data/sales should appear.
        default_manifest = json.dumps(
            {
                "entries": [
                    {
                        "containerName": wildcard_bucket,
                        "dataPath": "data/**/*.parquet",
                        "structureFormat": "parquet",
                    }
                ]
            }
        )
        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
            default_manifest_json=default_manifest,
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            _run_workflow(config)

            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            orders = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/orders",
                fields=["*"],
            )
            assert sales is not None, "bucket manifest defines data/sales"
            assert orders is None, (
                "orders must NOT appear — it's only in defaultManifest, and the bucket's openmetadata.json should win."
            )
        finally:
            _cleanup_service(metadata, service_name)


class TestLiteralPathBackwardsCompat:
    """Literal dataPath entries must behave exactly as before. Runs the
    shared ``ingest_s3_storage`` flow against the full fixture manifest
    (all literal paths) and spot-checks a couple of containers."""

    def test_legacy_manifest_still_works(self, metadata, ingest_s3_storage, service_name):
        cities = metadata.get_by_name(
            entity=Container,
            fqn=f"{service_name}.test-bucket.cities",
            fields=["*"],
        )
        assert cities is not None
        assert cities.dataModel.isPartitioned is True
        assert FileFormat.parquet in cities.fileFormats

        transactions = metadata.get_by_name(
            entity=Container,
            fqn=f"{service_name}.test-bucket.transactions",
            fields=["*"],
        )
        assert transactions is not None
        assert FileFormat.csv in transactions.fileFormats


class TestInvalidDefaultManifest:
    """Invalid JSON in defaultManifest must be ignored rather than
    breaking the whole ingestion. The bucket file, if any, still wins."""

    def test_invalid_default_manifest_is_ignored(self, minio, metadata, wildcard_bucket):
        _, minio_client = minio
        service_name = f"wc-bad-{uuid.uuid4().hex[:8]}"

        # Bucket has a valid manifest covering data/sales only.
        bucket_manifest = {
            "entries": [
                {
                    "dataPath": "data/sales",
                    "structureFormat": "parquet",
                    "isPartitioned": True,
                }
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(bucket_manifest).encode(),
        )

        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
            default_manifest_json="this is not valid json {",
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            # Must not raise — invalid JSON is logged & skipped.
            _run_workflow(config)

            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert sales is not None, "bucket manifest still applied"
        finally:
            _cleanup_service(metadata, service_name)


# ----------------------------------------------------------------------
# Bucket manifest parse-error scenarios
# ----------------------------------------------------------------------


class TestMalformedBucketManifest:
    """A bucket openmetadata.json with broken content must not crash the
    workflow. Ingestion falls back to the defaultManifest (if any) and
    surfaces a warning so users can diagnose."""

    def test_invalid_json_falls_back_to_default(self, minio, metadata, wildcard_bucket):
        _, minio_client = minio
        service_name = f"wc-bad-bucket-{uuid.uuid4().hex[:8]}"

        # Bucket file is malformed JSON.
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            b"{ this is not valid json",
        )

        # defaultManifest provides a valid fallback.
        default_manifest = json.dumps(
            {
                "entries": [
                    {
                        "containerName": wildcard_bucket,
                        "dataPath": "data/**/*.parquet",
                        "structureFormat": "parquet",
                    }
                ]
            }
        )
        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
            default_manifest_json=default_manifest,
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            # Must not raise.
            _run_workflow(config)

            # Default manifest kicked in — data/sales exists.
            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert sales is not None, "malformed bucket manifest should fall back to defaultManifest"
        finally:
            _cleanup_service(metadata, service_name)

    def test_invalid_json_no_default_still_gets_bucket_container(self, minio, metadata, wildcard_bucket):
        """Without a defaultManifest, a broken bucket file leaves only the
        top-level bucket container. Ingestion MUST NOT abort."""
        _, minio_client = minio
        service_name = f"wc-bad-only-{uuid.uuid4().hex[:8]}"

        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            b'{ "entries": [ broken',
        )

        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            _run_workflow(config)

            # Bucket itself is still registered.
            bucket = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}",
                fields=["*"],
            )
            assert bucket is not None, "bucket container must still exist"

            # Nested containers NOT created (no manifest drove them).
            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert sales is None
        finally:
            _cleanup_service(metadata, service_name)

    def test_schema_violation_in_bucket_manifest(self, minio, metadata, wildcard_bucket):
        """Valid JSON but schema violation (entry missing required
        ``dataPath``). Pydantic should flag; ingestion falls back."""
        _, minio_client = minio
        service_name = f"wc-schema-{uuid.uuid4().hex[:8]}"

        # Valid JSON, but an entry is missing the required ``dataPath``.
        bad_manifest = {"entries": [{"structureFormat": "parquet"}]}  # no dataPath
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(bad_manifest).encode(),
        )

        # Provide a working defaultManifest so we can assert fallback.
        default_manifest = json.dumps(
            {
                "entries": [
                    {
                        "containerName": wildcard_bucket,
                        "dataPath": "data/**/*.parquet",
                        "structureFormat": "parquet",
                    }
                ]
            }
        )
        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
            default_manifest_json=default_manifest,
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            _run_workflow(config)
            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert sales is not None, "schema violation in bucket manifest should fall back to defaultManifest"
        finally:
            _cleanup_service(metadata, service_name)

    def test_empty_entries_in_bucket_manifest(self, minio, metadata, wildcard_bucket):
        """Bucket file with ``entries: []`` is valid but produces no
        nested containers. Ingestion should complete cleanly and fall
        through to defaultManifest (if any)."""
        _, minio_client = minio
        service_name = f"wc-empty-{uuid.uuid4().hex[:8]}"

        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps({"entries": []}).encode(),
        )

        default_manifest = json.dumps(
            {
                "entries": [
                    {
                        "containerName": wildcard_bucket,
                        "dataPath": "data/**/*.parquet",
                        "structureFormat": "parquet",
                    }
                ]
            }
        )
        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
            default_manifest_json=default_manifest,
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            _run_workflow(config)
            # Empty entries means the bucket file defined no containers —
            # defaultManifest takes over (since precedence treats an empty
            # list as "no usable entries from the bucket").
            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert sales is not None, "empty bucket entries should fall back to defaultManifest"
        finally:
            _cleanup_service(metadata, service_name)


# ----------------------------------------------------------------------
# File read / discovery edge cases
# ----------------------------------------------------------------------


class TestFileReadEdgeCases:
    """What happens when the manifest is fine but the *data files* have
    issues — corrupt content, unknown extensions, etc. These exercise
    ``expand_entry`` / schema extraction error isolation."""

    def test_corrupt_file_does_not_break_other_tables(self, minio, metadata, wildcard_bucket):
        """One unreadable parquet in one table should not block other
        tables matched by the same glob."""
        _, minio_client = minio
        service_name = f"wc-corrupt-{uuid.uuid4().hex[:8]}"

        # Drop a bogus parquet into data/orders/ alongside the real ones.
        _put_object(
            minio_client,
            wildcard_bucket,
            "data/orders/State=AL/corrupt.parquet",
            b"this is not a valid parquet file, just random bytes",
        )

        manifest = {
            "entries": [
                {
                    "dataPath": "data/**/*.parquet",
                    "structureFormat": "parquet",
                    "autoPartitionDetection": True,
                }
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(manifest).encode(),
        )

        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            # Workflow may log schema-extraction failures for the corrupt
            # file but must not raise.
            _run_workflow(config)

            # The OTHER table (data/sales) should still be cataloged.
            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert sales is not None, "a corrupt file in one table must not block others"
        finally:
            _cleanup_service(metadata, service_name)

    def test_glob_matches_no_files_yields_only_bucket(self, minio, metadata, wildcard_bucket):
        """Glob pattern matches zero files — ingestion succeeds, bucket
        container exists, no nested containers are created."""
        _, minio_client = minio
        service_name = f"wc-nomatch-{uuid.uuid4().hex[:8]}"

        manifest = {
            "entries": [
                {
                    "dataPath": "nonexistent/**/*.parquet",
                    "structureFormat": "parquet",
                }
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(manifest).encode(),
        )

        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            _run_workflow(config)

            bucket = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}",
                fields=["*"],
            )
            assert bucket is not None
            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert sales is None, "no glob match → no nested containers"
        finally:
            _cleanup_service(metadata, service_name)

    def test_glob_without_structureformat_and_unknown_extension_is_skipped(self, minio, metadata, wildcard_bucket):
        """When the file extension is not recognized and no
        ``structureFormat`` is set, the expand step should skip the
        container (WARNING log) rather than crash."""
        _, minio_client = minio
        service_name = f"wc-unknown-ext-{uuid.uuid4().hex[:8]}"

        # Put files with an unknown extension.
        _put_object(
            minio_client,
            wildcard_bucket,
            "blobs/item1.bin",
            b"\x00\x01\x02\x03",
        )
        _put_object(
            minio_client,
            wildcard_bucket,
            "blobs/item2.bin",
            b"\x00\x01\x02\x03",
        )

        manifest = {
            "entries": [
                # No structureFormat, extension is .bin → cannot infer.
                {"dataPath": "blobs/**/*.bin"}
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(manifest).encode(),
        )

        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            _run_workflow(config)
            # blobs/ container should NOT be created (format couldn't
            # be determined) but the bucket itself should.
            bucket = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}",
                fields=["*"],
            )
            assert bucket is not None
            blobs = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.blobs",
                fields=["*"],
            )
            assert blobs is None, "unknown extension without structureFormat must be skipped"
        finally:
            _cleanup_service(metadata, service_name)

    def test_unstructured_catalogs_one_container_per_file(self, minio, metadata, wildcard_bucket):
        """With ``unstructuredData: true`` each matched file becomes its
        own container (no schema extraction)."""
        _, minio_client = minio
        service_name = f"wc-unstr-{uuid.uuid4().hex[:8]}"

        _put_object(minio_client, wildcard_bucket, "images/a.png", b"\x89PNG\x00")
        _put_object(minio_client, wildcard_bucket, "images/b.png", b"\x89PNG\x00")
        _put_object(minio_client, wildcard_bucket, "images/nested/c.png", b"\x89PNG\x00")

        manifest = {
            "entries": [
                {
                    "dataPath": "images/**/*.png",
                    "unstructuredData": True,
                }
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(manifest).encode(),
        )

        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            _run_workflow(config)
            bucket = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}",
                fields=["*"],
            )
            assert bucket is not None

            # List all containers under this service. Each matched file
            # becomes its own leaf container with name == key.
            all_containers = metadata.list_all_entities(
                entity=Container,
                params={"service": service_name},
                fields=["name", "dataModel"],
            )
            names = {c.name.root for c in all_containers}
            # At least the three .png files should show up as names.
            png_names = {n for n in names if n.endswith(".png")}
            assert png_names, "unstructured mode should catalog each .png file as its own container"
            # Leaf containers have no dataModel.
            for c in all_containers:
                if c.name.root.endswith(".png"):
                    assert c.dataModel is None
        finally:
            _cleanup_service(metadata, service_name)


class TestReIngestionIdempotency:
    """Running the same manifest twice must update the same entity, not
    create duplicates. This is the migration guarantee — FQN stability."""

    def test_glob_re_ingestion_preserves_entity_id(self, minio, metadata, wildcard_bucket):
        _, minio_client = minio
        service_name = f"wc-idemp-{uuid.uuid4().hex[:8]}"

        manifest = {
            "entries": [
                {
                    "dataPath": "data/**/*.parquet",
                    "structureFormat": "parquet",
                    "autoPartitionDetection": True,
                }
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(manifest).encode(),
        )

        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            _run_workflow(config)
            first = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert first is not None
            first_id = first.id.root

            # Re-run the workflow — same config, same bucket contents.
            _run_workflow(config)
            second = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert second is not None
            assert second.id.root == first_id, "re-ingestion must update the same entity, not duplicate"
        finally:
            _cleanup_service(metadata, service_name)

    def test_literal_to_glob_migration_preserves_entity_id(self, minio, metadata, wildcard_bucket):
        """A user starts with a literal-path manifest. Later they switch
        to a glob that resolves to the *same* container name. FQNs must
        match so existing lineage/tags/descriptions are preserved."""
        _, minio_client = minio
        service_name = f"wc-migrate-{uuid.uuid4().hex[:8]}"

        # Phase 1: literal manifest
        literal = {
            "entries": [
                {
                    "dataPath": "data/sales",
                    "structureFormat": "parquet",
                    "isPartitioned": True,
                }
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(literal).encode(),
        )

        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            _run_workflow(config)
            phase1 = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert phase1 is not None
            phase1_id = phase1.id.root

            # Phase 2: swap to a glob that resolves to data/sales (and
            # data/orders, but we only care about the sales ID here).
            glob = {
                "entries": [
                    {
                        "dataPath": "data/**/*.parquet",
                        "structureFormat": "parquet",
                        "autoPartitionDetection": True,
                    }
                ]
            }
            _put_object(
                minio_client,
                wildcard_bucket,
                "openmetadata.json",
                json.dumps(glob).encode(),
            )

            _run_workflow(config)
            phase2 = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert phase2 is not None
            assert phase2.id.root == phase1_id, (
                "migrating literal → glob must preserve the entity ID so lineage / tags / descriptions survive"
            )
        finally:
            _cleanup_service(metadata, service_name)


# ----------------------------------------------------------------------
# Resilience: one bad entry must not block sibling entries
# ----------------------------------------------------------------------


class TestPerEntryResilience:
    """Whatever goes wrong with one manifest entry (raise during listing,
    bad regex, runtime error in our code) must NOT block the other
    entries in the same manifest."""

    def test_bad_entry_does_not_block_good_entry(self, minio, metadata, wildcard_bucket, monkeypatch):
        """Simulate: one entry triggers an exception deep in expand_entry;
        the other entry is a clean literal path that must still
        produce its container."""
        _, minio_client = minio
        service_name = f"wc-resilience-{uuid.uuid4().hex[:8]}"

        manifest = {
            "entries": [
                # Entry 1: glob that will blow up (monkeypatched below).
                {"dataPath": "data/**/*.parquet", "structureFormat": "parquet"},
                # Entry 2: literal path — must still work.
                {
                    "dataPath": "data/sales",
                    "structureFormat": "parquet",
                    "isPartitioned": True,
                },
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(manifest).encode(),
        )

        # Monkey-patch list_keys to raise for globs only. Literal entries
        # bypass list_keys entirely (has_glob == False).
        from metadata.ingestion.source.storage.s3.metadata import S3Source

        original_list_keys = S3Source.list_keys

        def fake_list_keys(self, bucket_name, prefix):
            if prefix and "data/" in prefix and prefix != "data/sales/":
                raise RuntimeError("simulated S3 AccessDenied during glob listing")
            yield from original_list_keys(self, bucket_name, prefix)

        monkeypatch.setattr(S3Source, "list_keys", fake_list_keys)

        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            # Must not raise — the literal entry should still succeed.
            _run_workflow(config)

            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert sales is not None, "a failure in one entry must not block sibling entries"
        finally:
            _cleanup_service(metadata, service_name)


# ----------------------------------------------------------------------
# Regex-special characters in manifest paths
# ----------------------------------------------------------------------


class TestSpecialCharsInPaths:
    """S3 keys can legitimately contain regex-special chars (parens,
    brackets, plus). A literal dataPath containing such chars MUST be
    matched exactly — pattern_to_regex should escape them."""

    def test_path_with_regex_special_chars_matches_literally(self, minio, metadata, wildcard_bucket):
        _, minio_client = minio
        service_name = f"wc-special-{uuid.uuid4().hex[:8]}"

        # Upload a parquet into a directory whose name contains a '+'.
        _copy_parquet_files(minio_client, "test-bucket", "cities/", wildcard_bucket, "rare+data/")

        # Literal dataPath — passes through expand_entry unchanged.
        manifest = {
            "entries": [
                {
                    "dataPath": "rare+data",
                    "structureFormat": "parquet",
                    "isPartitioned": True,
                }
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(manifest).encode(),
        )

        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            _run_workflow(config)
            container = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.rare+data",
                fields=["*"],
            )
            assert container is not None, (
                "literal dataPath with '+' must match the real folder, not be interpreted as a regex quantifier"
            )
        finally:
            _cleanup_service(metadata, service_name)


# ----------------------------------------------------------------------
# Issue #24823 — pipeline-level include/exclude + _SUCCESS sentinel
# ----------------------------------------------------------------------


class TestContainerFilterPatternAgainstManifestPaths:
    """Issue #24823: users report that ``containerFilterPattern``
    excludes do not apply when the manifest lists nested paths, and
    that Spark ``_SUCCESS`` sentinel files get sampled for schema
    inference. Both paths now go through ``filter_manifest_entries``
    and ``_is_excluded_artifact``."""

    def test_success_sentinel_in_manifest_is_skipped(self, minio, metadata, wildcard_bucket):
        """A manifest that accidentally lists ``_SUCCESS`` (or a path
        containing ``_SUCCESS``) must NOT produce a container."""
        _, minio_client = minio
        service_name = f"wc-succ-{uuid.uuid4().hex[:8]}"

        manifest = {
            "entries": [
                {
                    "dataPath": "data/sales",
                    "structureFormat": "parquet",
                    "isPartitioned": True,
                },
                # Shouldn't show up in the catalog even though it's listed.
                {"dataPath": "_SUCCESS"},
                {"dataPath": "data/sales/_SUCCESS"},
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(manifest).encode(),
        )
        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            _run_workflow(config)
            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert sales is not None

            bad = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}._SUCCESS",
                fields=["*"],
            )
            assert bad is None, "_SUCCESS must never become a container"

            nested = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales/_SUCCESS",
                fields=["*"],
            )
            assert nested is None, "entries whose dataPath contains a _SUCCESS segment must be skipped"
        finally:
            _cleanup_service(metadata, service_name)

    def test_container_filter_excludes_applies_to_manifest_paths(self, minio, metadata, wildcard_bucket):
        """``containerFilterPattern.excludes`` set on the pipeline
        config must drop matching entries from a bucket manifest, not
        just top-level buckets."""
        _, minio_client = minio
        service_name = f"wc-excl-{uuid.uuid4().hex[:8]}"

        manifest = {
            "entries": [
                {
                    "dataPath": "data/sales",
                    "structureFormat": "parquet",
                    "isPartitioned": True,
                },
                {
                    "dataPath": "data/orders",
                    "structureFormat": "parquet",
                    "isPartitioned": True,
                },
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(manifest).encode(),
        )

        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]
        # Exclude orders at the pipeline level. containerFilterPattern
        # uses left-anchored regex — ``.*orders`` matches any path that
        # ends with 'orders' (or contains it, since patterns aren't
        # right-anchored either).
        config["source"]["sourceConfig"]["config"]["containerFilterPattern"] = {"excludes": [".*orders"]}

        try:
            _run_workflow(config)
            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            orders = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/orders",
                fields=["*"],
            )
            assert sales is not None, "sales must be ingested"
            assert orders is None, (
                "containerFilterPattern.excludes must drop manifest entries matching the exclude pattern"
            )
        finally:
            _cleanup_service(metadata, service_name)

    def test_container_filter_includes_applies_to_manifest_paths(self, minio, metadata, wildcard_bucket):
        """Likewise ``containerFilterPattern.includes`` restricts which
        manifest entries become containers."""
        _, minio_client = minio
        service_name = f"wc-incl-{uuid.uuid4().hex[:8]}"

        manifest = {
            "entries": [
                {
                    "dataPath": "data/sales",
                    "structureFormat": "parquet",
                    "isPartitioned": True,
                },
                {
                    "dataPath": "data/orders",
                    "structureFormat": "parquet",
                    "isPartitioned": True,
                },
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(manifest).encode(),
        )

        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]
        # Left-anchored regex: ``.*sales`` matches any path that contains 'sales'.
        config["source"]["sourceConfig"]["config"]["containerFilterPattern"] = {"includes": [".*sales"]}

        try:
            _run_workflow(config)
            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            orders = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/orders",
                fields=["*"],
            )
            assert sales is not None
            assert orders is None, "only 'sales' matches the include pattern"
        finally:
            _cleanup_service(metadata, service_name)

    def test_filter_applies_after_glob_expansion(self, minio, metadata, wildcard_bucket):
        """End-to-end: a glob ``dataPath`` plus a pipeline-level
        ``containerFilterPattern`` must expand the glob THEN drop the
        matching excludes. Without this ordering, an innocent
        ``data/**/*.parquet`` pattern would sweep archive/staging dirs
        that the user already tried to exclude at the pipeline level."""
        _, minio_client = minio
        service_name = f"wc-glob-excl-{uuid.uuid4().hex[:8]}"

        manifest = {
            "entries": [
                {
                    "dataPath": "data/**/*.parquet",
                    "structureFormat": "parquet",
                    "autoPartitionDetection": True,
                }
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(manifest).encode(),
        )

        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]
        # Drop orders even though the glob would match it.
        config["source"]["sourceConfig"]["config"]["containerFilterPattern"] = {"excludes": [".*orders"]}

        try:
            _run_workflow(config)
            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            orders = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/orders",
                fields=["*"],
            )
            assert sales is not None, "sales was in the glob expansion and must be ingested"
            assert orders is None, (
                "orders was in the glob expansion but matches the containerFilterPattern exclude — must be dropped"
            )
        finally:
            _cleanup_service(metadata, service_name)

    def test_success_file_in_sample_directory_is_not_picked(self, minio, metadata, wildcard_bucket):
        """Sample-file selection must skip ``_SUCCESS`` so pyarrow
        doesn't crash on a 0-byte sentinel (original reported crash)."""
        _, minio_client = minio
        service_name = f"wc-sampsucc-{uuid.uuid4().hex[:8]}"

        # Drop 0-byte Spark sentinels alongside the valid parquet files.
        _put_object(
            minio_client,
            wildcard_bucket,
            "data/sales/State=AL/_SUCCESS",
            b"",
        )
        _put_object(
            minio_client,
            wildcard_bucket,
            "data/sales/State=AL/_SUCCESS.crc",
            b"",
        )

        manifest = {
            "entries": [
                {
                    "dataPath": "data/sales",
                    "structureFormat": "parquet",
                    "isPartitioned": True,
                }
            ]
        }
        _put_object(
            minio_client,
            wildcard_bucket,
            "openmetadata.json",
            json.dumps(manifest).encode(),
        )

        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            # Must not raise — if _SUCCESS were sampled, pyarrow would
            # blow up with "Parquet file size is 0 bytes".
            _run_workflow(config)

            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert sales is not None
            assert sales.dataModel is not None
            assert sales.dataModel.columns, "columns must come from a real parquet file, not _SUCCESS"
        finally:
            _cleanup_service(metadata, service_name)


class TestMalformedDefaultManifest:
    """Symmetric coverage for defaultManifest parse errors."""

    def test_default_manifest_schema_violation_is_ignored(self, minio, metadata, wildcard_bucket):
        """Valid JSON but wrong schema — e.g. an entry missing required
        ``containerName`` / ``dataPath``. Must be logged & skipped."""
        service_name = f"wc-bad-default-{uuid.uuid4().hex[:8]}"

        # Entries array is valid JSON but missing required fields.
        default_manifest = json.dumps({"entries": [{"structureFormat": "parquet"}]})
        config = _build_pipeline_config(
            service_name=service_name,
            minio_container=minio[0],
            default_manifest_json=default_manifest,
        )
        config["source"]["serviceConnection"]["config"]["bucketNames"] = [wildcard_bucket]

        try:
            _run_workflow(config)
            bucket = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}",
                fields=["*"],
            )
            assert bucket is not None, "bucket container still created"
            sales = metadata.get_by_name(
                entity=Container,
                fqn=f"{service_name}.{wildcard_bucket}.data/sales",
                fields=["*"],
            )
            assert sales is None, "invalid defaultManifest should not produce containers"
        finally:
            _cleanup_service(metadata, service_name)
