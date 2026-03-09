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
Unit tests for DatalakeS3Client cold storage filtering
"""

import unittest
from unittest.mock import MagicMock, patch

from metadata.ingestion.source.database.datalake.clients.s3 import (
    S3_COLD_STORAGE_CLASSES,
    DatalakeS3Client,
)


class TestDatalakeS3ClientColdStorage(unittest.TestCase):
    """Tests for skip_cold_storage filtering in get_table_names"""

    def setUp(self):
        self.mock_s3_client = MagicMock()
        self.client = DatalakeS3Client(client=self.mock_s3_client)

    @patch("metadata.ingestion.source.database.datalake.clients.s3.list_s3_objects")
    def test_skip_cold_storage_filters_glacier_objects(self, mock_list_s3):
        """
        GIVEN: S3 objects with mixed StorageClass values
        WHEN: get_table_names is called with skip_cold_storage=True
        THEN: Only non-cold objects should be returned
        """
        mock_list_s3.return_value = [
            {"Key": "data/standard.csv", "StorageClass": "STANDARD"},
            {"Key": "data/glacier.csv", "StorageClass": "GLACIER"},
            {"Key": "data/deep_archive.csv", "StorageClass": "DEEP_ARCHIVE"},
            {"Key": "data/glacier_ir.csv", "StorageClass": "GLACIER_IR"},
            {"Key": "data/ia.csv", "StorageClass": "STANDARD_IA"},
        ]

        result = list(
            self.client.get_table_names(
                bucket_name="my-bucket", prefix=None, skip_cold_storage=True
            )
        )

        self.assertEqual(result, ["data/standard.csv", "data/ia.csv"])

    @patch("metadata.ingestion.source.database.datalake.clients.s3.list_s3_objects")
    def test_skip_cold_storage_false_returns_all(self, mock_list_s3):
        """
        GIVEN: S3 objects with cold StorageClass
        WHEN: get_table_names is called with skip_cold_storage=False
        THEN: All objects should be returned
        """
        mock_list_s3.return_value = [
            {"Key": "data/standard.csv", "StorageClass": "STANDARD"},
            {"Key": "data/glacier.csv", "StorageClass": "GLACIER"},
        ]

        result = list(
            self.client.get_table_names(
                bucket_name="my-bucket", prefix=None, skip_cold_storage=False
            )
        )

        self.assertEqual(result, ["data/standard.csv", "data/glacier.csv"])

    @patch("metadata.ingestion.source.database.datalake.clients.s3.list_s3_objects")
    def test_default_skip_cold_storage_is_false(self, mock_list_s3):
        """
        GIVEN: S3 objects with cold StorageClass
        WHEN: get_table_names is called without skip_cold_storage
        THEN: All objects should be returned (default is False)
        """
        mock_list_s3.return_value = [
            {"Key": "data/glacier.csv", "StorageClass": "GLACIER"},
        ]

        result = list(self.client.get_table_names(bucket_name="my-bucket", prefix=None))

        self.assertEqual(result, ["data/glacier.csv"])

    @patch("metadata.ingestion.source.database.datalake.clients.s3.list_s3_objects")
    def test_skip_cold_storage_handles_missing_storage_class(self, mock_list_s3):
        """
        GIVEN: S3 objects without a StorageClass key
        WHEN: get_table_names is called with skip_cold_storage=True
        THEN: Objects without StorageClass default to STANDARD and are included
        """
        mock_list_s3.return_value = [
            {"Key": "data/no_class.csv"},
        ]

        result = list(
            self.client.get_table_names(
                bucket_name="my-bucket", prefix=None, skip_cold_storage=True
            )
        )

        self.assertEqual(result, ["data/no_class.csv"])

    @patch("metadata.ingestion.source.database.datalake.clients.s3.list_s3_objects")
    def test_skip_cold_storage_filters_each_cold_class(self, mock_list_s3):
        """
        GIVEN: One S3 object per cold storage class
        WHEN: get_table_names is called with skip_cold_storage=True
        THEN: All cold-class objects should be filtered out
        """
        mock_list_s3.return_value = [
            {"Key": f"data/{cls.lower()}.csv", "StorageClass": cls}
            for cls in S3_COLD_STORAGE_CLASSES
        ]

        result = list(
            self.client.get_table_names(
                bucket_name="my-bucket", prefix=None, skip_cold_storage=True
            )
        )

        self.assertEqual(result, [])

    @patch("metadata.ingestion.source.database.datalake.clients.s3.list_s3_objects")
    def test_skip_cold_storage_allows_non_cold_classes(self, mock_list_s3):
        """
        GIVEN: S3 objects with non-cold storage classes
        WHEN: get_table_names is called with skip_cold_storage=True
        THEN: All non-cold objects should be returned
        """
        non_cold_classes = [
            "STANDARD",
            "STANDARD_IA",
            "ONEZONE_IA",
            "INTELLIGENT_TIERING",
            "REDUCED_REDUNDANCY",
        ]
        mock_list_s3.return_value = [
            {"Key": f"data/{cls.lower()}.csv", "StorageClass": cls}
            for cls in non_cold_classes
        ]

        result = list(
            self.client.get_table_names(
                bucket_name="my-bucket", prefix=None, skip_cold_storage=True
            )
        )

        self.assertEqual(
            result,
            [f"data/{cls.lower()}.csv" for cls in non_cold_classes],
        )


if __name__ == "__main__":
    unittest.main()
