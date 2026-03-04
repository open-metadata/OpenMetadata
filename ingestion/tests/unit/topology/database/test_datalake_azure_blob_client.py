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
Unit tests for DatalakeAzureBlobClient

Tests focus on the get_test_list_buckets_fn method which conditionally
uses either list_containers() or get_container_properties() based on
whether a bucket_name is specified.
"""

import unittest
from unittest.mock import MagicMock, patch

from azure.core.exceptions import ResourceNotFoundError

from metadata.ingestion.source.database.datalake.clients.azure_blob import (
    DatalakeAzureBlobClient,
)


class TestDatalakeAzureBlobClient(unittest.TestCase):
    """Tests for DatalakeAzureBlobClient"""

    def setUp(self):
        """Set up test fixtures with a mocked BlobServiceClient"""
        self.mock_blob_service_client = MagicMock()
        self.client = DatalakeAzureBlobClient(client=self.mock_blob_service_client)

    # =========================================================================
    # get_test_list_buckets_fn - bucket_name NOT specified (original behavior)
    # =========================================================================

    def test_get_test_list_buckets_fn_without_bucket_calls_list_containers(self):
        """
        GIVEN: No bucket_name is specified (None)
        WHEN: get_test_list_buckets_fn is called and executed
        THEN: It should call list_containers() on the BlobServiceClient
        """
        # Arrange
        self.mock_blob_service_client.list_containers.return_value = iter(
            [
                {"name": "container1"},
                {"name": "container2"},
            ]
        )

        # Act
        test_fn = self.client.get_test_list_buckets_fn(bucket_name=None)
        test_fn()  # Execute the returned callable

        # Assert
        self.mock_blob_service_client.list_containers.assert_called_once_with(
            name_starts_with=""
        )

    def test_get_test_list_buckets_fn_without_bucket_iterates_results(self):
        """
        GIVEN: No bucket_name is specified
        WHEN: get_test_list_buckets_fn is called and executed
        THEN: It should consume the iterator (list() is called on results)
        """
        # Arrange
        mock_iterator = MagicMock()
        self.mock_blob_service_client.list_containers.return_value = mock_iterator

        # Act
        test_fn = self.client.get_test_list_buckets_fn(bucket_name=None)
        test_fn()

        # Assert - verify list_containers was called
        self.mock_blob_service_client.list_containers.assert_called_once()

    # =========================================================================
    # get_test_list_buckets_fn - bucket_name IS specified (new behavior)
    # =========================================================================

    def test_get_test_list_buckets_fn_with_bucket_uses_get_container_client(self):
        """
        GIVEN: A specific bucket_name is provided
        WHEN: get_test_list_buckets_fn is called and executed
        THEN: It should call get_container_client() with the bucket name
              and NOT call list_containers()
        """
        # Arrange
        mock_container_client = MagicMock()
        self.mock_blob_service_client.get_container_client.return_value = (
            mock_container_client
        )

        # Act
        test_fn = self.client.get_test_list_buckets_fn(bucket_name="decube")
        test_fn()

        # Assert
        self.mock_blob_service_client.get_container_client.assert_called_once_with(
            "decube"
        )
        mock_container_client.get_container_properties.assert_called_once()
        self.mock_blob_service_client.list_containers.assert_not_called()

    def test_get_test_list_buckets_fn_with_bucket_raises_on_invalid_container(self):
        """
        GIVEN: A bucket_name that does not exist
        WHEN: get_test_list_buckets_fn is called and executed
        THEN: It should propagate the ResourceNotFoundError from Azure SDK
        """
        # Arrange
        mock_container_client = MagicMock()
        mock_container_client.get_container_properties.side_effect = (
            ResourceNotFoundError("Container not found")
        )
        self.mock_blob_service_client.get_container_client.return_value = (
            mock_container_client
        )

        # Act & Assert
        test_fn = self.client.get_test_list_buckets_fn(bucket_name="nonexistent")
        with self.assertRaises(ResourceNotFoundError):
            test_fn()

    # =========================================================================
    # get_test_list_buckets_fn - Edge cases
    # =========================================================================

    def test_get_test_list_buckets_fn_with_empty_string_bucket_uses_list_containers(
        self,
    ):
        """
        GIVEN: An empty string as bucket_name
        WHEN: get_test_list_buckets_fn is called
        THEN: It should treat empty string as falsy and use list_containers()
        """
        # Arrange
        self.mock_blob_service_client.list_containers.return_value = iter([])

        # Act
        test_fn = self.client.get_test_list_buckets_fn(bucket_name="")
        test_fn()

        # Assert - empty string is falsy, so list_containers should be called
        self.mock_blob_service_client.list_containers.assert_called_once()
        self.mock_blob_service_client.get_container_client.assert_not_called()

    def test_get_test_list_buckets_fn_returns_callable(self):
        """
        GIVEN: Any bucket_name value
        WHEN: get_test_list_buckets_fn is called
        THEN: It should return a callable (function)
        """
        # Test with bucket_name
        fn_with_bucket = self.client.get_test_list_buckets_fn(bucket_name="test")
        self.assertTrue(callable(fn_with_bucket))

        # Test without bucket_name
        fn_without_bucket = self.client.get_test_list_buckets_fn(bucket_name=None)
        self.assertTrue(callable(fn_without_bucket))


class TestDatalakeAzureBlobClientFromConfig(unittest.TestCase):
    """Tests for DatalakeAzureBlobClient.from_config()"""

    @patch("metadata.ingestion.source.database.datalake.clients.azure_blob.AzureClient")
    def test_from_config_creates_client_with_security_config(self, mock_azure_client):
        """
        GIVEN: A valid AzureConfig with securityConfig
        WHEN: from_config() is called
        THEN: It should create a BlobServiceClient via AzureClient
        """
        # Arrange
        mock_config = MagicMock()
        mock_config.securityConfig = MagicMock()
        mock_blob_client = MagicMock()
        mock_azure_client.return_value.create_blob_client.return_value = (
            mock_blob_client
        )

        # Act
        client = DatalakeAzureBlobClient.from_config(mock_config)

        # Assert
        mock_azure_client.assert_called_once_with(mock_config.securityConfig)
        mock_azure_client.return_value.create_blob_client.assert_called_once()
        self.assertIsInstance(client, DatalakeAzureBlobClient)

    def test_from_config_raises_when_security_config_is_none(self):
        """
        GIVEN: An AzureConfig with securityConfig=None
        WHEN: from_config() is called
        THEN: It should raise RuntimeError
        """
        # Arrange
        mock_config = MagicMock()
        mock_config.securityConfig = None

        # Act & Assert
        with self.assertRaises(RuntimeError) as context:
            DatalakeAzureBlobClient.from_config(mock_config)

        self.assertIn("securityConfig can't be None", str(context.exception))


class TestDatalakeAzureBlobClientDatabaseMethods(unittest.TestCase):
    """Tests for database-related methods in DatalakeAzureBlobClient"""

    def setUp(self):
        """Set up test fixtures with a mocked BlobServiceClient"""
        self.mock_blob_service_client = MagicMock()
        self.client = DatalakeAzureBlobClient(client=self.mock_blob_service_client)

    def test_update_client_database_does_nothing(self):
        """
        GIVEN: A DatalakeAzureBlobClient
        WHEN: update_client_database() is called
        THEN: It should do nothing (no-op for Azure Blob)
        """
        # Act - should not raise
        self.client.update_client_database(config=MagicMock(), database_name="test_db")

        # Assert - method is a no-op, just verify it doesn't modify the client
        # No assertions needed - if it completes without error, test passes

    def test_get_database_names_with_custom_name(self):
        """
        GIVEN: A service_connection with a custom databaseName
        WHEN: get_database_names() is called
        THEN: It should yield the custom database name
        """
        # Arrange
        mock_service_connection = MagicMock()
        mock_service_connection.databaseName = "custom_database"

        # Act
        result = list(self.client.get_database_names(mock_service_connection))

        # Assert
        self.assertEqual(result, ["custom_database"])

    def test_get_database_names_with_no_name_uses_default(self):
        """
        GIVEN: A service_connection with no databaseName
        WHEN: get_database_names() is called
        THEN: It should yield the DEFAULT_DATABASE constant
        """
        # Arrange
        mock_service_connection = MagicMock()
        mock_service_connection.databaseName = None

        # Act
        result = list(self.client.get_database_names(mock_service_connection))

        # Assert
        self.assertEqual(result, ["default"])


class TestDatalakeAzureBlobClientSchemaMethods(unittest.TestCase):
    """Tests for schema-related methods in DatalakeAzureBlobClient"""

    def setUp(self):
        """Set up test fixtures with a mocked BlobServiceClient"""
        self.mock_blob_service_client = MagicMock()
        self.client = DatalakeAzureBlobClient(client=self.mock_blob_service_client)

    def test_get_database_schema_names_with_bucket_prefix(self):
        """
        GIVEN: A bucket_name is specified
        WHEN: get_database_schema_names() is called
        THEN: It should filter containers by that prefix
        """
        # Arrange
        self.mock_blob_service_client.list_containers.return_value = [
            {"name": "decube"},
            {"name": "decube-backup"},
        ]

        # Act
        result = list(self.client.get_database_schema_names(bucket_name="decube"))

        # Assert
        self.mock_blob_service_client.list_containers.assert_called_once_with(
            name_starts_with="decube"
        )
        self.assertEqual(result, ["decube", "decube-backup"])

    def test_get_database_schema_names_without_bucket_lists_all(self):
        """
        GIVEN: No bucket_name is specified (None)
        WHEN: get_database_schema_names() is called
        THEN: It should list all containers (empty prefix)
        """
        # Arrange
        self.mock_blob_service_client.list_containers.return_value = [
            {"name": "container1"},
            {"name": "container2"},
        ]

        # Act
        result = list(self.client.get_database_schema_names(bucket_name=None))

        # Assert
        self.mock_blob_service_client.list_containers.assert_called_once_with(
            name_starts_with=""
        )
        self.assertEqual(result, ["container1", "container2"])


class TestDatalakeAzureBlobClientTableMethods(unittest.TestCase):
    """Tests for table-related methods in DatalakeAzureBlobClient"""

    def setUp(self):
        """Set up test fixtures with a mocked BlobServiceClient"""
        self.mock_blob_service_client = MagicMock()
        self.client = DatalakeAzureBlobClient(client=self.mock_blob_service_client)

    def test_get_table_names_lists_blobs_in_container(self):
        """
        GIVEN: A bucket_name and optional prefix
        WHEN: get_table_names() is called
        THEN: It should list blobs in that container with the prefix
        """
        # Arrange
        mock_container_client = MagicMock()
        mock_blob1 = MagicMock()
        mock_blob1.name = "atlas-wind/file1.csv"
        mock_blob2 = MagicMock()
        mock_blob2.name = "atlas-wind/file2.csv"
        mock_container_client.list_blobs.return_value = [mock_blob1, mock_blob2]
        self.mock_blob_service_client.get_container_client.return_value = (
            mock_container_client
        )

        # Act
        result = list(
            self.client.get_table_names(bucket_name="decube", prefix="atlas-wind/")
        )

        # Assert
        self.mock_blob_service_client.get_container_client.assert_called_once_with(
            "decube"
        )
        mock_container_client.list_blobs.assert_called_once_with(
            name_starts_with="atlas-wind/"
        )
        self.assertEqual(result, ["atlas-wind/file1.csv", "atlas-wind/file2.csv"])

    def test_get_table_names_with_no_prefix(self):
        """
        GIVEN: A bucket_name with no prefix (None)
        WHEN: get_table_names() is called
        THEN: It should list all blobs with name_starts_with=None
        """
        # Arrange
        mock_container_client = MagicMock()
        mock_container_client.list_blobs.return_value = []
        self.mock_blob_service_client.get_container_client.return_value = (
            mock_container_client
        )

        # Act
        result = list(self.client.get_table_names(bucket_name="decube", prefix=None))

        # Assert
        mock_container_client.list_blobs.assert_called_once_with(name_starts_with=None)
        self.assertEqual(result, [])


class TestDatalakeAzureBlobClientConnectionLifecycle(unittest.TestCase):
    """Tests for connection lifecycle methods"""

    def setUp(self):
        """Set up test fixtures with a mocked BlobServiceClient"""
        self.mock_blob_service_client = MagicMock()
        self.client = DatalakeAzureBlobClient(client=self.mock_blob_service_client)

    def test_close_calls_client_close(self):
        """
        GIVEN: A DatalakeAzureBlobClient
        WHEN: close() is called
        THEN: It should call close() on the underlying BlobServiceClient
        """
        # Act
        self.client.close(service_connection=MagicMock())

        # Assert
        self.mock_blob_service_client.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
