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
Unit tests for DatalakeGcsClient cold storage filtering
"""

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from metadata.ingestion.source.database.datalake.clients.gcs import (
    GCS_COLD_STORAGE_CLASSES,
    DatalakeGcsClient,
)


class TestDatalakeGcsClientColdStorage(unittest.TestCase):
    """Tests for skip_cold_storage filtering in get_table_names"""

    def setUp(self):
        self.mock_gcs_client = MagicMock()
        self.client = DatalakeGcsClient(
            client=self.mock_gcs_client, temp_credentials_file_path_list=[]
        )

    def _make_blob(self, name, storage_class=None):
        blob = SimpleNamespace(name=name, storage_class=storage_class)
        return blob

    def test_skip_cold_storage_filters_cold_classes(self):
        """
        GIVEN: GCS blobs with mixed storage classes
        WHEN: get_table_names is called with skip_cold_storage=True
        THEN: Only non-cold blobs should be returned
        """
        mock_bucket = MagicMock()
        mock_bucket.list_blobs.return_value = [
            self._make_blob("standard.csv", storage_class="STANDARD"),
            self._make_blob("nearline.csv", storage_class="NEARLINE"),
            self._make_blob("coldline.csv", storage_class="COLDLINE"),
            self._make_blob("archive.csv", storage_class="ARCHIVE"),
        ]
        self.mock_gcs_client.get_bucket.return_value = mock_bucket

        result = list(
            self.client.get_table_names(
                bucket_name="my-bucket", prefix=None, skip_cold_storage=True
            )
        )

        self.assertEqual(result, ["standard.csv", "nearline.csv"])

    def test_skip_cold_storage_false_returns_all(self):
        """
        GIVEN: GCS blobs with cold storage classes
        WHEN: get_table_names is called with skip_cold_storage=False
        THEN: All blobs should be returned
        """
        mock_bucket = MagicMock()
        mock_bucket.list_blobs.return_value = [
            self._make_blob("standard.csv", storage_class="STANDARD"),
            self._make_blob("archive.csv", storage_class="ARCHIVE"),
        ]
        self.mock_gcs_client.get_bucket.return_value = mock_bucket

        result = list(
            self.client.get_table_names(
                bucket_name="my-bucket", prefix=None, skip_cold_storage=False
            )
        )

        self.assertEqual(result, ["standard.csv", "archive.csv"])

    def test_default_skip_cold_storage_is_false(self):
        """
        GIVEN: GCS blobs with cold storage classes
        WHEN: get_table_names is called without skip_cold_storage
        THEN: All blobs should be returned (default is False)
        """
        mock_bucket = MagicMock()
        mock_bucket.list_blobs.return_value = [
            self._make_blob("archive.csv", storage_class="ARCHIVE"),
        ]
        self.mock_gcs_client.get_bucket.return_value = mock_bucket

        result = list(self.client.get_table_names(bucket_name="my-bucket", prefix=None))

        self.assertEqual(result, ["archive.csv"])

    def test_skip_cold_storage_handles_no_storage_class(self):
        """
        GIVEN: GCS blobs without a storage_class attribute
        WHEN: get_table_names is called with skip_cold_storage=True
        THEN: Blobs without storage_class should be included
        """
        mock_bucket = MagicMock()
        mock_bucket.list_blobs.return_value = [
            self._make_blob("no_class.csv", storage_class=None),
        ]
        self.mock_gcs_client.get_bucket.return_value = mock_bucket

        result = list(
            self.client.get_table_names(
                bucket_name="my-bucket", prefix=None, skip_cold_storage=True
            )
        )

        self.assertEqual(result, ["no_class.csv"])

    def test_skip_cold_storage_filters_each_cold_class(self):
        """
        GIVEN: One GCS blob per cold storage class
        WHEN: get_table_names is called with skip_cold_storage=True
        THEN: All cold-class blobs should be filtered out
        """
        mock_bucket = MagicMock()
        mock_bucket.list_blobs.return_value = [
            self._make_blob(f"{cls.lower()}.csv", storage_class=cls)
            for cls in GCS_COLD_STORAGE_CLASSES
        ]
        self.mock_gcs_client.get_bucket.return_value = mock_bucket

        result = list(
            self.client.get_table_names(
                bucket_name="my-bucket", prefix=None, skip_cold_storage=True
            )
        )

        self.assertEqual(result, [])

    def test_skip_cold_storage_allows_non_cold_classes(self):
        """
        GIVEN: GCS blobs with non-cold storage classes
        WHEN: get_table_names is called with skip_cold_storage=True
        THEN: All non-cold blobs should be returned
        """
        non_cold_classes = ["STANDARD", "NEARLINE", "MULTI_REGIONAL", "REGIONAL"]
        mock_bucket = MagicMock()
        mock_bucket.list_blobs.return_value = [
            self._make_blob(f"{cls.lower()}.csv", storage_class=cls)
            for cls in non_cold_classes
        ]
        self.mock_gcs_client.get_bucket.return_value = mock_bucket

        result = list(
            self.client.get_table_names(
                bucket_name="my-bucket", prefix=None, skip_cold_storage=True
            )
        )

        self.assertEqual(
            result,
            [f"{cls.lower()}.csv" for cls in non_cold_classes],
        )


if __name__ == "__main__":
    unittest.main()
