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
"""Integration tests for S3 archive support (archive.py + s3/metadata.py)."""

import tarfile
import uuid
import zipfile
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.metadataIngestion.storage.containerMetadataConfig import (
    MetadataEntry,
)
from metadata.ingestion.source.storage.s3.metadata import (
    S3BucketResponse,
    S3Source,
)
from metadata.readers.archive import (
    TarArchiveReader,
    ZipArchiveReader,
    infer_columns_from_archive_entry,
)

MOCK_S3_CONFIG = {
    "source": {
        "type": "s3",
        "serviceName": "s3_test",
        "serviceConnection": {"config": {"type": "S3", "awsConfig": {"awsRegion": "us-east-1"}}},
        "sourceConfig": {
            "config": {
                "type": "StorageMetadata",
                "storageMetadataConfigSource": {
                    "securityConfig": {"awsRegion": "us-east-1"},
                    "prefixConfig": {
                        "containerName": "test_bucket",
                        "objectPrefix": "manifest",
                    },
                },
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}

_CSV_CONTENT = b"id,name,value\n1,Alice,100\n2,Bob,200\n"
_CSV2_CONTENT = b"id,name,value\n3,Carol,300\n4,Dave,400\n"


def _make_zip(files: dict, compression: int = zipfile.ZIP_DEFLATED) -> bytes:
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", compression=compression) as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return buf.getvalue()


def _make_tar(files: dict, mode: str = "w:gz") -> bytes:
    buf = BytesIO()
    with tarfile.open(fileobj=buf, mode=mode) as tf:
        for name, content in files.items():
            data = content if isinstance(content, bytes) else content.encode()
            info = tarfile.TarInfo(name=name)
            info.size = len(data)
            tf.addfile(info, BytesIO(data))
    return buf.getvalue()


class TestS3ArchiveIntegration:
    @pytest.fixture(autouse=True)
    def setup(self):
        with (
            patch("boto3.client"),
            patch("metadata.ingestion.source.storage.storage_service.StorageServiceSource.test_connection"),
            patch(
                "metadata.ingestion.source.storage.storage_service.get_connection",
                return_value=MagicMock(),
            ),
        ):
            self.s3_source = S3Source.create(MOCK_S3_CONFIG["source"], MagicMock())
        ctx = MagicMock()
        ctx.objectstore_service = "test_svc"
        self.s3_source.context = MagicMock()
        self.s3_source.context.get.return_value = ctx
        self.bucket = S3BucketResponse(Name="my-bucket", CreationDate=None)
        yield

    def _make_archive_entity(self):
        entity = MagicMock()
        entity.id.root = str(uuid.uuid4())
        return entity

    def test_archive_format_routes_to_handler(self):
        entry = MetadataEntry(dataPath="data.zip", structureFormat="zip")

        self.s3_source._generate_archive_containers = MagicMock(return_value=iter([]))
        self.s3_source._generate_container_details = MagicMock()

        list(
            self.s3_source._generate_structured_containers(
                bucket_response=self.bucket,
                entries=[entry],
            )
        )

        self.s3_source._generate_archive_containers.assert_called_once()
        self.s3_source._generate_container_details.assert_not_called()

    def test_non_archive_does_not_call_handler(self):
        entry = MetadataEntry(dataPath="data/", structureFormat="csv")

        self.s3_source._generate_archive_containers = MagicMock()
        self.s3_source._generate_container_details = MagicMock(return_value=None)

        list(
            self.s3_source._generate_structured_containers(
                bucket_response=self.bucket,
                entries=[entry],
            )
        )

        self.s3_source._generate_archive_containers.assert_not_called()

    def test_yields_parent_then_two_children(self):
        zip_bytes = _make_zip({"file1.csv": _CSV_CONTENT, "file2.csv": _CSV2_CONTENT})
        self.s3_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.s3_source.get_size = MagicMock(return_value=len(zip_bytes))

        with patch(
            "metadata.ingestion.source.storage.s3.metadata.open_archive_reader",
            return_value=ZipArchiveReader(zip_bytes),
        ):
            results = list(
                self.s3_source._generate_archive_containers(
                    bucket_response=self.bucket,
                    metadata_entry=MetadataEntry(dataPath="archive.zip", structureFormat="zip"),
                )
            )

        assert results[0].name == "archive.zip"
        assert results[0].data_model is None
        assert len(results) == 3
        child_names = {r.name for r in results[1:]}
        assert child_names == {"file1.csv", "file2.csv"}

    def test_yields_parent_then_one_child_tar(self):
        tar_bytes = _make_tar({"data.csv": _CSV_CONTENT})
        self.s3_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.s3_source.get_size = MagicMock(return_value=len(tar_bytes))

        with patch(
            "metadata.ingestion.source.storage.s3.metadata.open_archive_reader",
            return_value=TarArchiveReader(tar_bytes),
        ):
            results = list(
                self.s3_source._generate_archive_containers(
                    bucket_response=self.bucket,
                    metadata_entry=MetadataEntry(dataPath="archive.tar.gz", structureFormat="tar.gz"),
                )
            )

        assert len(results) == 2
        assert results[0].name == "archive.tar.gz"
        assert results[1].name == "data.csv"

    def test_schema_inferred_exactly_once(self):
        zip_bytes = _make_zip({"a.csv": _CSV_CONTENT, "b.csv": _CSV2_CONTENT})
        self.s3_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.s3_source.get_size = MagicMock(return_value=len(zip_bytes))

        with (
            patch(
                "metadata.ingestion.source.storage.s3.metadata.open_archive_reader",
                return_value=ZipArchiveReader(zip_bytes),
            ),
            patch(
                "metadata.readers.archive.infer_columns_from_archive_entry",
                wraps=infer_columns_from_archive_entry,
            ) as mock_infer,
        ):
            list(
                self.s3_source._generate_archive_containers(
                    bucket_response=self.bucket,
                    metadata_entry=MetadataEntry(dataPath="archive.zip", structureFormat="zip"),
                )
            )

        mock_infer.assert_called_once()

    def test_children_share_same_columns(self):
        zip_bytes = _make_zip({"a.csv": _CSV_CONTENT, "b.csv": _CSV2_CONTENT})
        self.s3_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.s3_source.get_size = MagicMock(return_value=len(zip_bytes))

        with patch(
            "metadata.ingestion.source.storage.s3.metadata.open_archive_reader",
            return_value=ZipArchiveReader(zip_bytes),
        ):
            results = list(
                self.s3_source._generate_archive_containers(
                    bucket_response=self.bucket,
                    metadata_entry=MetadataEntry(dataPath="archive.zip", structureFormat="zip"),
                )
            )

        children = [r for r in results if r.parent is not None]
        assert len(children) == 2
        assert children[0].data_model is not None
        assert children[0].data_model.columns == children[1].data_model.columns

    def test_open_reader_value_error_yields_only_parent(self):
        self.s3_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.s3_source.get_size = MagicMock(return_value=100)

        with patch(
            "metadata.ingestion.source.storage.s3.metadata.open_archive_reader",
            side_effect=ValueError("Corrupted ZIP"),
        ):
            results = list(
                self.s3_source._generate_structured_containers(
                    bucket_response=self.bucket,
                    entries=[MetadataEntry(dataPath="bad.zip", structureFormat="zip")],
                )
            )

        assert len(results) == 1
        assert results[0].name == "bad.zip"
        assert results[0].data_model is None

    def test_empty_archive_yields_only_parent(self):
        zip_bytes = _make_zip({})
        self.s3_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.s3_source.get_size = MagicMock(return_value=len(zip_bytes))

        with patch(
            "metadata.ingestion.source.storage.s3.metadata.open_archive_reader",
            return_value=ZipArchiveReader(zip_bytes),
        ):
            results = list(
                self.s3_source._generate_archive_containers(
                    bucket_response=self.bucket,
                    metadata_entry=MetadataEntry(dataPath="empty.zip", structureFormat="zip"),
                )
            )

        assert len(results) == 1
        assert results[0].name == "empty.zip"

    def test_archive_entity_not_found_skips_children(self):
        zip_bytes = _make_zip({"file.csv": _CSV_CONTENT})
        self.s3_source.metadata.get_by_name = MagicMock(return_value=None)
        self.s3_source.get_size = MagicMock(return_value=len(zip_bytes))

        results = list(
            self.s3_source._generate_archive_containers(
                bucket_response=self.bucket,
                metadata_entry=MetadataEntry(dataPath="archive.zip", structureFormat="zip"),
            )
        )

        assert len(results) == 1
        assert results[0].name == "archive.zip"

    def test_s3_blob_adapter_is_used(self):
        zip_bytes = _make_zip({"file.csv": _CSV_CONTENT})
        self.s3_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.s3_source.get_size = MagicMock(return_value=len(zip_bytes))

        with (
            patch(
                "metadata.ingestion.source.storage.s3.metadata.S3BlobAdapter",
                return_value=MagicMock(
                    get_size=MagicMock(return_value=len(zip_bytes)),
                    read_range=MagicMock(side_effect=ValueError("force fallback")),
                    read_all=MagicMock(return_value=zip_bytes),
                ),
            ) as mock_adapter,
            patch(
                "metadata.ingestion.source.storage.s3.metadata.open_archive_reader",
                return_value=ZipArchiveReader(zip_bytes),
            ),
        ):
            list(
                self.s3_source._generate_archive_containers(
                    bucket_response=self.bucket,
                    metadata_entry=MetadataEntry(dataPath="archive.zip", structureFormat="zip"),
                )
            )

        mock_adapter.assert_called_once()
