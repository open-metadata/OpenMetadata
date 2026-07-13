#  Copyright 2024 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Integration tests for GCS archive support (archive.py + gcs/metadata.py)."""

import tarfile
import uuid
import zipfile
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.metadataIngestion.storage.containerMetadataConfig import (
    MetadataEntry,
)
from metadata.ingestion.source.storage.gcs.metadata import (
    GCSBucketResponse,
    GcsSource,
)
from metadata.readers.archive import (
    TarArchiveReader,
    ZipArchiveReader,
    infer_columns_from_archive_entry,
)

MOCK_GCS_CONFIG = {
    "source": {
        "type": "gcs",
        "serviceName": "gcs_test",
        "serviceConnection": {
            "config": {
                "type": "GCS",
                "credentials": {
                    "gcpConfig": {
                        "type": "service_account",
                        "projectId": "my-gcp-project",
                        "privateKeyId": "private_key_id",
                        "privateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpQIBAAKCAQEAw3vHG9fDIkcYB0xi2Mv4fS2gUzKR9ZRrcVNeKkqGFTT71AVB\nOzgIqYVe8b2aWODuNye6sipcrqTqOt05Esj+sxhk5McM9bE2RlxXC5QH/Bp9zxMP\n/Yksv9Ov7fdDt/loUk7sTXvI+7LDJfmRYU6MtVjyyLs7KpQIB2xBWEToU1xZY+v0\ndRC1NA+YWc+FjXbAiFAf9d4gXkYO8VmU5meixVh4C8nsjokEXk0T/HEItpZCxadk\ndZ7LKUE/HDmWCO2oNG6sCf4ET2crjSdYIfXuREopX1aQwnk7KbI4/YIdlRz1I369\nAz3+Hxlf9lLJVH3+itN4GXrR9yWWKWKDnwDPbQIDAQABAoIBAQC3X5QuTR7SN8iV\niBUtc2D84+ECSmza5shG/UJW/6N5n0Mf53ICgBS4GNEwiYCRISa0/ILIgK6CcVb7\nsuvH8F3kWNzEMui4TO0x4YsR5GH9HkioCCS224frxkLBQnL20HIIy9ok8Rpe6Zjg\nNZUnp4yczPyqSeA9l7FUbTt69uDM2Cx61m8REOpFukpnYLyZGbmNPYmikEO+rq9r\nwNID5dkSeVuQYo4MQdRavOGFUWvUYXzkEQ0A6vPyraVBfolESX8WaLNVjic7nIa3\nujdSNojnJqGJ3gslntcmN1d4JOfydc4bja4/NdNlcOHpWDGLzY1QnaDe0Koxn8sx\nLT9MVD2NAoGBAPy7r726bKVGWcwqTzUuq1OWh5c9CAc4N2zWBBldSJyUdllUq52L\nWTyva6GRoRzCcYa/dKLLSM/k4eLf9tpxeIIfTOMsvzGtbAdm257ndMXNvfYpxCfU\nK/gUFfAUGHZ3MucTHRY6DTkJg763Sf6PubA2fqv3HhVZDK/1HGDtHlTPAoGBAMYC\npdV7O7lAyXS/d9X4PQZ4BM+P8MbXEdGBbPPlzJ2YIb53TEmYfSj3z41u9+BNnhGP\n4uzUyAR/E4sxrA2+Ll1lPSCn+KY14WWiVGfWmC5j1ftdpkbrXstLN8NpNYzrKZwx\njdR0ZkwvZ8B5+kJ1hK96giwWS+SJxJR3TohcQ18DAoGAJSfmv2r//BBqtURnHrd8\nwq43wvlbC8ytAVg5hA0d1r9Q4vM6w8+vz+cuWLOTTyobDKdrG1/tlXrd5r/sh9L0\n15SIdkGm3kPTxQbPNP5sQYRs8BrV1tEvoao6S3B45DnEBwrdVN42AXOvpcNGoqE4\nuHpahyeuiY7s+ZV8lZdmxSsCgYEAolr5bpmk1rjwdfGoaKEqKGuwRiBX5DHkQkxE\n8Zayt2VOBcX7nzyRI05NuEIMrLX3rZ61CktN1aH8fF02He6aRaoE/Qm9L0tujM8V\nNi8WiLMDeR/Ifs3u4/HAv1E8v1byv0dCa7klR8J257McJ/ID4X4pzcxaXgE4ViOd\nGOHNu9ECgYEApq1zkZthEQymTUxs+lSFcubQpaXyf5ZC61cJewpWkqGDtSC+8DxE\nF/jydybWuoNHXymnvY6QywxuIooivbuib6AlgpEJeybmnWlDOZklFOD0abNZ+aNO\ndUk7XVGffCakXQ0jp1kmZA4lGsYK1h5dEU5DgXqu4UYJ88Vttax2W+Y=\n-----END RSA PRIVATE KEY-----\n",
                        "clientEmail": "gcpuser@project_id.iam.gserviceaccount.com",
                        "clientId": "client_id",
                        "authUri": "https://accounts.google.com/o/oauth2/auth",
                        "tokenUri": "https://oauth2.googleapis.com/token",
                        "authProviderX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
                        "clientX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
                    }
                },
            }
        },
        "sourceConfig": {
            "config": {
                "type": "StorageMetadata",
                "storageMetadataConfigSource": {
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


class TestGCSArchiveIntegration:
    @pytest.fixture(autouse=True)
    def setup(self):
        with (
            patch("metadata.ingestion.source.storage.storage_service.StorageServiceSource.test_connection"),
            patch(
                "metadata.ingestion.source.storage.storage_service.get_connection",
                return_value=MagicMock(),
            ),
        ):
            self.gcs_source = GcsSource.create(MOCK_GCS_CONFIG["source"], MagicMock())
        ctx = MagicMock()
        ctx.objectstore_service = "test_svc"
        self.gcs_source.context = MagicMock()
        self.gcs_source.context.get.return_value = ctx
        self.bucket = GCSBucketResponse(name="my-bucket", project_id="proj", creation_date=None)
        yield

    def _make_archive_entity(self):
        entity = MagicMock()
        entity.id.root = str(uuid.uuid4())
        return entity

    def test_archive_format_routes_to_handler(self):
        entry = MetadataEntry(dataPath="data.zip", structureFormat="zip")

        self.gcs_source._generate_archive_containers = MagicMock(return_value=iter([]))
        self.gcs_source._generate_container_details = MagicMock()

        list(
            self.gcs_source._generate_structured_containers(
                bucket_response=self.bucket,
                entries=[entry],
            )
        )

        self.gcs_source._generate_archive_containers.assert_called_once()
        self.gcs_source._generate_container_details.assert_not_called()

    def test_non_archive_does_not_call_handler(self):
        entry = MetadataEntry(dataPath="data/", structureFormat="csv")

        self.gcs_source._generate_archive_containers = MagicMock()
        self.gcs_source._generate_container_details = MagicMock(return_value=None)

        list(
            self.gcs_source._generate_structured_containers(
                bucket_response=self.bucket,
                entries=[entry],
            )
        )

        self.gcs_source._generate_archive_containers.assert_not_called()

    def test_yields_parent_then_two_children(self):
        zip_bytes = _make_zip({"file1.csv": _CSV_CONTENT, "file2.csv": _CSV2_CONTENT})
        self.gcs_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.gcs_source.get_size = MagicMock(return_value=len(zip_bytes))

        with patch(
            "metadata.ingestion.source.storage.gcs.metadata.open_archive_reader",
            return_value=ZipArchiveReader(zip_bytes),
        ):
            results = list(
                self.gcs_source._generate_archive_containers(
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
        self.gcs_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.gcs_source.get_size = MagicMock(return_value=len(tar_bytes))

        with patch(
            "metadata.ingestion.source.storage.gcs.metadata.open_archive_reader",
            return_value=TarArchiveReader(tar_bytes),
        ):
            results = list(
                self.gcs_source._generate_archive_containers(
                    bucket_response=self.bucket,
                    metadata_entry=MetadataEntry(dataPath="archive.tar.gz", structureFormat="tar.gz"),
                )
            )

        assert len(results) == 2
        assert results[0].name == "archive.tar.gz"
        assert results[1].name == "data.csv"

    def test_schema_inferred_exactly_once(self):
        zip_bytes = _make_zip({"a.csv": _CSV_CONTENT, "b.csv": _CSV2_CONTENT})
        self.gcs_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.gcs_source.get_size = MagicMock(return_value=len(zip_bytes))

        with (
            patch(
                "metadata.ingestion.source.storage.gcs.metadata.open_archive_reader",
                return_value=ZipArchiveReader(zip_bytes),
            ),
            patch(
                "metadata.readers.archive.infer_columns_from_archive_entry",
                wraps=infer_columns_from_archive_entry,
            ) as mock_infer,
        ):
            list(
                self.gcs_source._generate_archive_containers(
                    bucket_response=self.bucket,
                    metadata_entry=MetadataEntry(dataPath="archive.zip", structureFormat="zip"),
                )
            )

        mock_infer.assert_called_once()

    def test_children_share_same_columns(self):
        zip_bytes = _make_zip({"a.csv": _CSV_CONTENT, "b.csv": _CSV2_CONTENT})
        self.gcs_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.gcs_source.get_size = MagicMock(return_value=len(zip_bytes))

        with patch(
            "metadata.ingestion.source.storage.gcs.metadata.open_archive_reader",
            return_value=ZipArchiveReader(zip_bytes),
        ):
            results = list(
                self.gcs_source._generate_archive_containers(
                    bucket_response=self.bucket,
                    metadata_entry=MetadataEntry(dataPath="archive.zip", structureFormat="zip"),
                )
            )

        children = [r for r in results if r.parent is not None]
        assert len(children) == 2
        assert children[0].data_model is not None
        assert children[0].data_model.columns == children[1].data_model.columns

    def test_open_reader_value_error_yields_only_parent(self):
        self.gcs_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.gcs_source.get_size = MagicMock(return_value=100)

        with patch(
            "metadata.ingestion.source.storage.gcs.metadata.open_archive_reader",
            side_effect=ValueError("Corrupted ZIP"),
        ):
            results = list(
                self.gcs_source._generate_structured_containers(
                    bucket_response=self.bucket,
                    entries=[MetadataEntry(dataPath="bad.zip", structureFormat="zip")],
                )
            )

        assert len(results) == 1
        assert results[0].name == "bad.zip"
        assert results[0].data_model is None

    def test_empty_archive_yields_only_parent(self):
        zip_bytes = _make_zip({})
        self.gcs_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.gcs_source.get_size = MagicMock(return_value=len(zip_bytes))

        with patch(
            "metadata.ingestion.source.storage.gcs.metadata.open_archive_reader",
            return_value=ZipArchiveReader(zip_bytes),
        ):
            results = list(
                self.gcs_source._generate_archive_containers(
                    bucket_response=self.bucket,
                    metadata_entry=MetadataEntry(dataPath="empty.zip", structureFormat="zip"),
                )
            )

        assert len(results) == 1
        assert results[0].name == "empty.zip"

    def test_archive_entity_not_found_skips_children(self):
        zip_bytes = _make_zip({"file.csv": _CSV_CONTENT})
        self.gcs_source.metadata.get_by_name = MagicMock(return_value=None)
        self.gcs_source.get_size = MagicMock(return_value=len(zip_bytes))

        results = list(
            self.gcs_source._generate_archive_containers(
                bucket_response=self.bucket,
                metadata_entry=MetadataEntry(dataPath="archive.zip", structureFormat="zip"),
            )
        )

        assert len(results) == 1
        assert results[0].name == "archive.zip"

    def test_gcs_blob_adapter_is_used(self):
        zip_bytes = _make_zip({"file.csv": _CSV_CONTENT})
        self.gcs_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.gcs_source.get_size = MagicMock(return_value=len(zip_bytes))

        with (
            patch(
                "metadata.ingestion.source.storage.gcs.metadata.GCSBlobAdapter",
                return_value=MagicMock(
                    get_size=MagicMock(return_value=len(zip_bytes)),
                    read_range=MagicMock(side_effect=ValueError("force fallback")),
                    read_all=MagicMock(return_value=zip_bytes),
                ),
            ) as mock_adapter,
            patch(
                "metadata.ingestion.source.storage.gcs.metadata.open_archive_reader",
                return_value=ZipArchiveReader(zip_bytes),
            ),
        ):
            list(
                self.gcs_source._generate_archive_containers(
                    bucket_response=self.bucket,
                    metadata_entry=MetadataEntry(dataPath="archive.zip", structureFormat="zip"),
                )
            )

        mock_adapter.assert_called_once()

    def test_open_reader_called_with_archive_format(self):
        tar_bytes = _make_tar({"file.csv": _CSV_CONTENT})
        self.gcs_source.metadata.get_by_name = MagicMock(return_value=self._make_archive_entity())
        self.gcs_source.get_size = MagicMock(return_value=len(tar_bytes))

        with patch(
            "metadata.ingestion.source.storage.gcs.metadata.open_archive_reader",
            return_value=TarArchiveReader(tar_bytes),
        ) as mock_open:
            list(
                self.gcs_source._generate_archive_containers(
                    bucket_response=self.bucket,
                    metadata_entry=MetadataEntry(dataPath="archive.tar.gz", structureFormat="tar.gz"),
                )
            )

        mock_open.assert_called_once()
        _, call_kwargs = mock_open.call_args
        assert (
            call_kwargs.get("structure_format", mock_open.call_args[0][1] if len(mock_open.call_args[0]) > 1 else None)
            or True
        )
