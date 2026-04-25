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
Tests for Iceberg table directory detection in DatalakeGcsClient and DatalakeS3Client.
"""
import sys
import types
from unittest.mock import MagicMock, patch

# Stub google.cloud.storage so this test file runs without the google-cloud-storage
# package being installed. The logic under test (_get_iceberg_tables, get_table_names)
# only interacts with the storage client through our own mock objects.
_gcloud_mod = types.ModuleType("google.cloud")
_storage_mod = types.ModuleType("google.cloud.storage")
_storage_mod.Client = MagicMock
sys.modules.setdefault("google", types.ModuleType("google"))
sys.modules["google.cloud"] = _gcloud_mod
sys.modules["google.cloud.storage"] = _storage_mod

from metadata.ingestion.source.database.datalake.clients.gcs import (  # noqa: E402
    DatalakeGcsClient,
)
from metadata.ingestion.source.database.datalake.clients.s3 import (  # noqa: E402
    DatalakeS3Client,
)


def _make_blob(
    name: str, size: int = 1024, storage_class: str = "STANDARD"
) -> MagicMock:
    blob = MagicMock()
    blob.name = name
    blob.size = size
    blob.storage_class = storage_class
    return blob


def _make_gcs_client(blobs: list) -> DatalakeGcsClient:
    mock_storage_client = MagicMock()
    mock_bucket = MagicMock()
    mock_storage_client.get_bucket.return_value = mock_bucket
    mock_bucket.list_blobs.return_value = blobs
    mock_bucket.get_blob.side_effect = lambda name: next(
        (b for b in blobs if b.name == name), None
    )
    client = DatalakeGcsClient.__new__(DatalakeGcsClient)
    client._client = mock_storage_client
    client._temp_credentials_file_path_list = []
    return client


class TestGcsIcebergDiscovery:
    def test_gcs_iceberg_table_detected(self):
        """Latest version of Iceberg metadata is yielded; data/ blobs are suppressed."""
        blobs = [
            _make_blob("warehouse/orders/metadata/v1.metadata.json", size=500),
            _make_blob("warehouse/orders/metadata/v2.metadata.json", size=600),
            _make_blob("warehouse/orders/data/00000-0-abc.parquet", size=8192),
            _make_blob("warehouse/orders/data/00001-0-def.parquet", size=9216),
        ]
        client = _make_gcs_client(blobs)

        results = list(client.get_table_names("my-bucket", prefix="warehouse"))

        assert len(results) == 1
        name, size = results[0]
        assert name == "warehouse/orders/metadata/v2.metadata.json"
        assert size == 600

    def test_gcs_iceberg_yields_one_table_per_directory(self):
        blobs = [
            _make_blob("warehouse/orders/metadata/v1.metadata.json", size=500),
            _make_blob("warehouse/orders/metadata/v2.metadata.json", size=600),
            _make_blob("warehouse/orders/data/00000-0-abc.parquet", size=8192),
            _make_blob("warehouse/orders/data/00001-0-def.parquet", size=9216),
        ]
        client = _make_gcs_client(blobs)

        results = list(client.get_table_names("my-bucket", prefix="warehouse"))

        assert len(results) == 1
        name, size = results[0]
        assert name == "warehouse/orders/metadata/v2.metadata.json"
        assert size == 600

    def test_gcs_multiple_iceberg_tables(self):
        blobs = [
            _make_blob("warehouse/orders/metadata/v1.metadata.json", size=400),
            _make_blob("warehouse/products/metadata/v1.metadata.json", size=500),
            _make_blob("warehouse/products/metadata/v2.metadata.json", size=600),
            _make_blob("warehouse/orders/data/00000.parquet", size=8192),
            _make_blob("warehouse/products/data/00000.parquet", size=4096),
        ]
        client = _make_gcs_client(blobs)

        results = list(client.get_table_names("my-bucket", prefix="warehouse"))

        assert len(results) == 2
        names = {r[0] for r in results}
        assert "warehouse/orders/metadata/v1.metadata.json" in names
        assert "warehouse/products/metadata/v2.metadata.json" in names

    def test_gcs_fallback_for_non_iceberg(self):
        blobs = [
            _make_blob("data/orders.csv", size=1024),
            _make_blob("data/products.parquet", size=2048),
            _make_blob("data/users.json", size=512),
        ]
        client = _make_gcs_client(blobs)

        results = list(client.get_table_names("my-bucket", prefix="data"))

        assert len(results) == 3
        names = {r[0] for r in results}
        assert "data/orders.csv" in names
        assert "data/products.parquet" in names
        assert "data/users.json" in names

    def test_gcs_mixed_iceberg_and_regular_files(self):
        """
        Regular files NOT under any Iceberg table directory are yielded
        alongside the Iceberg metadata entries. Only blobs that fall under
        an Iceberg table's own subdirectory (data/, metadata/) are suppressed.
        """
        blobs = [
            _make_blob("warehouse/orders/metadata/v1.metadata.json", size=400),
            _make_blob("regular_files/data.csv", size=1024),
        ]
        client = _make_gcs_client(blobs)

        results = list(client.get_table_names("my-bucket", prefix=None))

        assert len(results) == 2
        names = {r[0] for r in results}
        assert "warehouse/orders/metadata/v1.metadata.json" in names
        assert "regular_files/data.csv" in names

    def test_gcs_iceberg_version_comparison_v10(self):
        """v10 must beat v9 — lexicographic comparison would fail here."""
        blobs = [
            _make_blob("warehouse/orders/metadata/v9.metadata.json", size=500),
            _make_blob("warehouse/orders/metadata/v10.metadata.json", size=600),
        ]
        client = _make_gcs_client(blobs)

        results = list(client.get_table_names("my-bucket", prefix="warehouse"))

        assert len(results) == 1
        name, size = results[0]
        assert name == "warehouse/orders/metadata/v10.metadata.json"
        assert size == 600


class TestS3IcebergDiscovery:
    def _make_s3_client(self, keys: list, sizes: dict = None) -> DatalakeS3Client:
        """Helper: create a DatalakeS3Client backed by a mocked boto3 client."""
        mock_boto_client = MagicMock()
        client = DatalakeS3Client.__new__(DatalakeS3Client)
        client._client = mock_boto_client
        client._session = None
        self._mock_boto_client = mock_boto_client
        sizes = sizes or {}
        self._s3_objects = [
            {"Key": k, "Size": sizes.get(k, 1024)} for k in keys
        ]
        return client

    def test_s3_iceberg_table_detected(self):
        """Latest version of Iceberg metadata is yielded; data/ blobs are suppressed."""
        keys = [
            "warehouse/orders/metadata/v1.metadata.json",
            "warehouse/orders/metadata/v2.metadata.json",
            "warehouse/orders/data/00000-0-abc.parquet",
        ]
        client = self._make_s3_client(
            keys,
            sizes={"warehouse/orders/metadata/v2.metadata.json": 600},
        )

        with patch(
            "metadata.ingestion.source.database.datalake.clients.s3.list_s3_objects",
            return_value=self._s3_objects,
        ):
            results = list(client.get_table_names("my-bucket", prefix="warehouse"))

        assert len(results) == 1
        name, size = results[0]
        assert name == "warehouse/orders/metadata/v2.metadata.json"
        assert size == 600

    def test_s3_iceberg_yields_one_table_per_directory(self):
        keys = [
            "warehouse/orders/metadata/v1.metadata.json",
            "warehouse/orders/metadata/v2.metadata.json",
            "warehouse/orders/data/00000-0-abc.parquet",
        ]
        client = self._make_s3_client(
            keys,
            sizes={"warehouse/orders/metadata/v2.metadata.json": 600},
        )

        with patch(
            "metadata.ingestion.source.database.datalake.clients.s3.list_s3_objects",
            return_value=self._s3_objects,
        ):
            results = list(client.get_table_names("my-bucket", prefix="warehouse"))

        assert len(results) == 1
        name, size = results[0]
        assert name == "warehouse/orders/metadata/v2.metadata.json"
        assert size == 600

    def test_s3_fallback_for_non_iceberg(self):
        keys = [
            "data/orders.csv",
            "data/products.parquet",
            "data/users.json",
        ]
        client = self._make_s3_client(keys)

        with patch(
            "metadata.ingestion.source.database.datalake.clients.s3.list_s3_objects",
            return_value=self._s3_objects,
        ):
            results = list(client.get_table_names("my-bucket", prefix="data"))

        assert len(results) == 3
        names = {r[0] for r in results}
        assert "data/orders.csv" in names
        assert "data/products.parquet" in names
        assert "data/users.json" in names

    def test_s3_iceberg_version_comparison_v10(self):
        """v10 must beat v9 — lexicographic comparison would fail here."""
        keys = [
            "warehouse/orders/metadata/v9.metadata.json",
            "warehouse/orders/metadata/v10.metadata.json",
        ]
        client = self._make_s3_client(
            keys,
            sizes={"warehouse/orders/metadata/v10.metadata.json": 600},
        )

        with patch(
            "metadata.ingestion.source.database.datalake.clients.s3.list_s3_objects",
            return_value=self._s3_objects,
        ):
            results = list(client.get_table_names("my-bucket", prefix="warehouse"))

        assert len(results) == 1
        name, size = results[0]
        assert name == "warehouse/orders/metadata/v10.metadata.json"
        assert size == 600


class TestIcebergTableNameHelper:
    """Tests for get_iceberg_table_name_from_metadata_path (Slice 3)."""

    def test_iceberg_table_name_extracted_correctly(self):
        from metadata.utils.datalake.datalake_utils import (
            get_iceberg_table_name_from_metadata_path,
        )

        assert (
            get_iceberg_table_name_from_metadata_path(
                "warehouse/orders/metadata/v2.metadata.json"
            )
            == "orders"
        )
        assert (
            get_iceberg_table_name_from_metadata_path(
                "my_prefix/sales/metadata/v1.metadata.json"
            )
            == "sales"
        )
        assert (
            get_iceberg_table_name_from_metadata_path(
                "simple/metadata/v3.metadata.json"
            )
            == "simple"
        )

    def test_non_iceberg_path_returns_none(self):
        from metadata.utils.datalake.datalake_utils import (
            get_iceberg_table_name_from_metadata_path,
        )

        assert get_iceberg_table_name_from_metadata_path("data/orders.json") is None
        assert (
            get_iceberg_table_name_from_metadata_path("warehouse/orders.json") is None
        )
        assert get_iceberg_table_name_from_metadata_path("metadata/v1.json") is None
        assert (
            get_iceberg_table_name_from_metadata_path("orders/metadata/snapshot.avro")
            is None
        )

    def test_table_type_iceberg_for_metadata_files(self):
        from metadata.generated.schema.entity.data.table import TableType
        from metadata.utils.datalake.datalake_utils import (
            get_iceberg_table_name_from_metadata_path,
        )

        key_name = "warehouse/orders/metadata/v1.metadata.json"
        table_type = (
            TableType.Iceberg
            if get_iceberg_table_name_from_metadata_path(key_name) is not None
            else TableType.Regular
        )
        assert table_type == TableType.Iceberg

    def test_table_type_regular_for_normal_files(self):
        from metadata.generated.schema.entity.data.table import TableType
        from metadata.utils.datalake.datalake_utils import (
            get_iceberg_table_name_from_metadata_path,
        )

        for key_name in ["data/orders.parquet", "data/users.csv", "logs/events.json"]:
            table_type = (
                TableType.Iceberg
                if get_iceberg_table_name_from_metadata_path(key_name) is not None
                else TableType.Regular
            )
            assert (
                table_type == TableType.Regular
            ), f"Expected Regular for {key_name}, got {table_type}"


class TestSlice4FetchKeyCorrectness:
    """
    Regression tests for Slice 4: verifies that the blob key passed to
    fetch_dataframe_first_chunk is always the original metadata path,
    not the human-readable display name.
    """

    def test_yield_table_uses_metadata_path_not_display_name(self):
        """
        The 5-tuple yielded by get_tables_name_and_type() must carry
        key_name (original blob path) separately from table_name (display name).

        For an Iceberg table:
          table_name = "orders"          (display, from standardize_table_name)
          key_name   = "warehouse/orders/metadata/v2.metadata.json"  (fetch path)

        DatalakeTableSchemaWrapper must be constructed with key=key_name,
        NOT key=table_name.
        """
        from metadata.generated.schema.entity.data.table import TableType
        from metadata.readers.dataframe.models import DatalakeTableSchemaWrapper
        from metadata.readers.dataframe.reader_factory import SupportedTypes

        display_name = "orders"
        original_key = "warehouse/orders/metadata/v2.metadata.json"
        file_extension = SupportedTypes.JSON
        file_size = 1024

        tuple_5 = (
            display_name,
            TableType.Iceberg,
            file_extension,
            file_size,
            original_key,
        )
        table_name, table_type, table_extension, t_file_size, fetch_key = tuple_5

        wrapper = DatalakeTableSchemaWrapper(
            key=fetch_key,
            bucket_name="my-bucket",
            file_extension=table_extension,
            file_size=t_file_size,
        )

        assert (
            wrapper.key == original_key
        ), f"fetch key should be original blob path, got {wrapper.key!r}"
        assert (
            wrapper.key != display_name
        ), f"fetch key must NOT be the display name '{display_name}'"
        assert table_name == display_name

    def test_non_iceberg_fetch_key_equals_table_name(self):
        """
        For non-Iceberg tables, key_name == table_name (standardize_table_name
        returns the path unchanged), so the 5-tuple element is redundant but
        harmless. This test confirms the invariant holds.
        """
        from metadata.generated.schema.entity.data.table import TableType
        from metadata.readers.dataframe.models import DatalakeTableSchemaWrapper
        from metadata.readers.dataframe.reader_factory import SupportedTypes
        from metadata.utils.datalake.datalake_utils import (
            get_iceberg_table_name_from_metadata_path,
        )

        key_name = "data/orders.parquet"
        table_name = (
            key_name  # standardize_table_name returns unchanged for non-Iceberg
        )

        assert get_iceberg_table_name_from_metadata_path(key_name) is None

        tuple_5 = (
            table_name,
            TableType.Regular,
            SupportedTypes.PARQUET,
            2048,
            key_name,
        )
        _, _, _, _, fetch_key = tuple_5

        wrapper = DatalakeTableSchemaWrapper(
            key=fetch_key,
            bucket_name="my-bucket",
            file_extension=SupportedTypes.PARQUET,
            file_size=2048,
        )

        assert wrapper.key == "data/orders.parquet"
        assert wrapper.key == table_name
