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
Unit tests for GCS Object store source - Unstructured Formats Support
"""
import datetime
import uuid
from collections import namedtuple
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.metadataIngestion.storage.containerMetadataConfig import (
    MetadataEntry,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.storage.gcs.metadata import GcsSource
from metadata.ingestion.source.storage.gcs.models import (
    GCSBucketResponse,
    GCSContainerDetails,
)

MockBucketResponse = namedtuple("MockBucketResponse", ["name", "time_created"])
MockBlob = namedtuple("MockBlob", ["name", "size"])

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
                        "privateKey": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDPZPtpdoNsg5rH\n8b443iQ5FCAXYbFQEEk/nne/b+6iOzf8zGSYH6cmXmvYNIuw3pqcEAwiUStC8SPt\nbskdbdSf2miJ8DsbZoJPV2wN4zw71If/rhn+VUVgzAXUrYFEJX73gQs7Qhm0QlPL\nUUxcYoboxIkIzbn11SlX6K/IvveGzch7AYhgVGB9nWWZFdBwJaVeGRpdEjtoB/KR\nsXrydUtqzoxvJ6YIGxdV7os4GQlEbs/8mdDnC63+jfqDLzrfWQgSfuyUA2YrZFrX\n74/IhjLH9fA8rrWO0BoEzrfjxxRfXygw+V+nfl1fjPhzkUaOACsh4XaIvAZT8gt7\nzsUVycE1AgMBAAECggEABTatKUwM5rvyNqeJmCVhdLvgSKYwjmoyZTKHIR1fut1R\nPX4n4zkcexbxkBhWEKav7U9r9qriswab2BqqXJ6Hs1MKwLj0y24KxZLViQ3W1Ew1\n9QP77ExZd6L5XIzWDJACvpcUYLN7MPBf6eMLz+C8MnrKVRnS3G604NxdGudOEqnr\nB/H2IRj1G368IApSljV8uHZ7wHMq4nEeMkDYlwWbF8EkxXGc2BkQaq2VbNw4F+Ky\n1KG+G6evzT63D2T03TnB5WstOVMeZng+NOMIP2eiVBF8Pmc8nMekAJ+A35ecQDfL\njK8nlgNdvbDa0BuHSupD4XjNuCCwjVzmnbeWwrQL+wKBgQD8L+LK9K0vuiz7nxpO\noULsz8wU6lNj0qAniZRIomzmNzzgO9O3g81J2TdHOgmhOU/LP0Z26xpptzIFXZ0E\nfMFJNEuZy0R4MUyQ8fGBKIOU5GU6OECxoqZJUfj73KsIXXHOo5TkDycbXB5nDmCF\nEjqjldrOym8QQPsszprsQdJDlwKBgQDSh7jfSSTJ+3sKD1s0p1QCS3PpkQ74RovS\nRvYkHYBp9mM1PPrZqYiJY9qZno1utXUloVg1e+98ihhlAiPs29p3ISkzeTZPPEP4\nBzVGusFRaDeMUC8Ux4fHzPBiRuX/IxhZtf6VrIxwO28cePMBR1HMRNSDZLv1Dk9d\nr+PTf9rLEwKBgQDKEwzll/2WOtaEoU6RJwLbgv6C2+kKGeIfDEz3jr84EZcEDqxt\nZn1+6UE0H7tLpwLbV858x5KYlyTLy+FfkR/IKtFRYOFydf5mPphH6FDXY9QBPMYK\nEMyx/69FEeMyhr4E2Gsb+1BYyg3Kgmiw+JRoNFHqVad9HLSniL33Bh8X7QKBgFl8\nyU9X1uRoGc+X4WvLKEFlcxq3xwYvbmVuNlf5lkj0Kw1JI1N75YaIxDWCGJoTVX0u\nTMFHMe/c/yuIMl8OwJjcppezkSsy8a0u2y16WovQ4bOpramGeqep7A/KFR9S+pm/\nazyRwIxAJyWSH7DOcO2D4FUNb3tlnsSy7ANNmGGzAoGBAPVwNP+I9CSTFYJwYUCZ\neeFkJkafjfEjuN2dFJiISMd34+UO4MH45dmGB6dJsKgSpsi2HbP8mfL6Wjkmpk1w\nt496flAMznTkgegF2oRNx21c7Cz6pVB88Z8UUoBudSVBoASahdev9Ch4YU/etZOI\nCuSfmiAKdSNbly8ZHZV4Ew8b\n-----END PRIVATE KEY-----\n",
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


class TestGCSUnstructuredFormats(TestCase):
    """
    Test GCS unstructured formats support
    """

    @patch(
        "metadata.ingestion.source.storage.storage_service.StorageServiceSource.test_connection"
    )
    def setUp(self, test_connection):
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(MOCK_GCS_CONFIG)
        self.gcs_source = GcsSource.create(
            MOCK_GCS_CONFIG["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        # Mock the context
        mock_context = MagicMock()
        mock_context.get.return_value = MagicMock(
            objectstore_service="test_service", container="test_container"
        )
        self.gcs_source.context = mock_context

        # Mock metadata client
        self.gcs_source.metadata = MagicMock()

    def test_is_valid_unstructured_file(self):
        """Test file validation for unstructured formats"""
        # Test with wildcard
        self.assertTrue(self.gcs_source.is_valid_unstructured_file(["*"], "test.pdf"))
        self.assertTrue(
            self.gcs_source.is_valid_unstructured_file(["*"], "anything.txt")
        )

        # Test with specific extensions
        self.assertTrue(
            self.gcs_source.is_valid_unstructured_file([".pdf", ".txt"], "test.pdf")
        )
        self.assertTrue(
            self.gcs_source.is_valid_unstructured_file([".pdf", ".txt"], "test.txt")
        )
        self.assertFalse(
            self.gcs_source.is_valid_unstructured_file([".pdf", ".txt"], "test.doc")
        )

        # Test without extension dot
        self.assertTrue(
            self.gcs_source.is_valid_unstructured_file(["pdf", "txt"], "test.pdf")
        )

    def test_get_size(self):
        """Test getting file size from GCS"""
        # Mock the GCS client and blob
        mock_client = MagicMock()
        mock_bucket = MagicMock()
        mock_blob = MagicMock()
        mock_blob.size = 1024

        mock_client.get_bucket.return_value = mock_bucket
        mock_bucket.blob.return_value = mock_blob

        self.gcs_source.gcs_clients.storage_client.clients = {
            "my-gcp-project": mock_client
        }

        size = self.gcs_source.get_size("test-bucket", "my-gcp-project", "test.pdf")
        self.assertEqual(size, 1024)

        # Test error handling
        mock_client.get_bucket.side_effect = Exception("Error")
        size = self.gcs_source.get_size("test-bucket", "my-gcp-project", "test.pdf")
        self.assertIsNone(size)

    def test_generate_unstructured_containers(self):
        """Test generating unstructured containers"""
        bucket_response = GCSBucketResponse(
            name="test-bucket",
            project_id="my-gcp-project",
            creation_date=datetime.datetime(2025, 1, 1),
        )

        # Test with unstructuredFormats specified
        metadata_entry = MetadataEntry(
            dataPath="documents/", unstructuredFormats=[".pdf", ".txt"]
        )

        # Mock list_blobs response
        mock_client = MagicMock()
        mock_blobs = [
            MockBlob(name="documents/file1.pdf", size=1024),
            MockBlob(name="documents/file2.txt", size=2048),
            MockBlob(name="documents/file3.doc", size=512),  # Should be filtered
            MockBlob(name="documents/subdir/file4.pdf", size=4096),
        ]
        mock_client.list_blobs.return_value = mock_blobs

        self.gcs_source.gcs_clients.storage_client.clients = {
            "my-gcp-project": mock_client
        }

        # Mock the container entity lookup
        mock_container = MagicMock()
        mock_container.id.root = str(uuid.uuid4())
        self.gcs_source.metadata.get_by_name.return_value = mock_container

        # Mock get_size
        self.gcs_source.get_size = MagicMock(return_value=1024)

        parent = EntityReference(id=uuid.uuid4(), type="container")
        containers = list(
            self.gcs_source._generate_unstructured_containers(
                bucket_response, [metadata_entry], parent
            )
        )

        # Check we got the right number of containers (files + intermediate directories)
        self.assertGreater(len(containers), 0)

        # Check that we only processed valid extensions
        for container in containers:
            if container.leaf_container:
                self.assertTrue(
                    container.name.endswith(".pdf") or container.name.endswith(".txt")
                )

    def test_generate_unstructured_containers_wildcard(self):
        """Test generating unstructured containers with wildcard"""
        bucket_response = GCSBucketResponse(
            name="test-bucket",
            project_id="my-gcp-project",
            creation_date=datetime.datetime(2025, 1, 1),
        )

        # Test with wildcard to accept all files
        metadata_entry = MetadataEntry(dataPath="files/", unstructuredFormats=["*"])

        # Mock list_blobs response
        mock_client = MagicMock()
        mock_blobs = [
            MockBlob(name="files/file1.pdf", size=1024),
            MockBlob(name="files/file2.docx", size=2048),
            MockBlob(
                name="files/file3.xyz", size=512
            ),  # Should be accepted with wildcard
        ]
        mock_client.list_blobs.return_value = mock_blobs

        self.gcs_source.gcs_clients.storage_client.clients = {
            "my-gcp-project": mock_client
        }

        # Mock the container entity lookup
        mock_container = MagicMock()
        mock_container.id.root = str(uuid.uuid4())
        self.gcs_source.metadata.get_by_name.return_value = mock_container

        # Mock get_size
        self.gcs_source.get_size = MagicMock(return_value=1024)

        parent = EntityReference(id=uuid.uuid4(), type="container")
        containers = list(
            self.gcs_source._generate_unstructured_containers(
                bucket_response, [metadata_entry], parent
            )
        )

        # With wildcard, all files should be processed
        leaf_containers = [c for c in containers if c.leaf_container]
        self.assertEqual(len(leaf_containers), 3)

    def test_yield_parents_of_unstructured_container(self):
        """Test creating parent container hierarchy"""
        bucket_name = "test-bucket"
        project_id = "my-gcp-project"
        list_of_parent = ["documents", "2025", "january", "report.pdf"]

        # Mock container entity
        mock_container = MagicMock()
        mock_container.id.root = str(uuid.uuid4())
        self.gcs_source.metadata.get_by_name.return_value = mock_container

        parent = EntityReference(id=uuid.uuid4(), type="container")

        # Generate parent containers
        parents = list(
            self.gcs_source._yield_parents_of_unstructured_container(
                bucket_name, project_id, list_of_parent, parent
            )
        )

        # Should create containers for: documents, 2025, january (not report.pdf as it's the leaf)
        self.assertEqual(len(parents), 3)
        self.assertEqual(parents[0].name, "documents")
        self.assertEqual(parents[1].name, "2025")
        self.assertEqual(parents[2].name, "january")

        # Check full paths are constructed correctly
        self.assertIn("documents", parents[0].fullPath)
        self.assertIn("2025", parents[1].fullPath)
        self.assertIn("january", parents[2].fullPath)

    def test_yield_nested_unstructured_containers(self):
        """Test yielding nested unstructured containers"""
        bucket_response = GCSBucketResponse(
            name="test-bucket",
            project_id="my-gcp-project",
            creation_date=datetime.datetime(2025, 1, 1),
        )

        metadata_entry = MetadataEntry(
            dataPath="data/", unstructuredFormats=[".csv", ".json"]
        )

        # Mock list_blobs response with nested structure
        mock_client = MagicMock()
        mock_blobs = [
            MockBlob(name="data/2025/01/sales.csv", size=1024),
            MockBlob(name="data/2025/01/products.json", size=2048),
            MockBlob(name="data/2025/02/sales.csv", size=3072),
            MockBlob(name="data/temp.txt", size=512),  # Should be filtered
        ]
        mock_client.list_blobs.return_value = mock_blobs

        self.gcs_source.gcs_clients.storage_client.clients = {
            "my-gcp-project": mock_client
        }

        # Mock container entity
        mock_container = MagicMock()
        mock_container.id.root = str(uuid.uuid4())
        self.gcs_source.metadata.get_by_name.return_value = mock_container

        # Mock get_size
        self.gcs_source.get_size = MagicMock(return_value=1024)

        parent = EntityReference(id=uuid.uuid4(), type="container")

        containers = list(
            self.gcs_source._yield_nested_unstructured_containers(
                bucket_response, metadata_entry, parent
            )
        )

        # Check that containers were created for the nested structure
        self.assertGreater(len(containers), 0)

        # Check leaf containers are properly marked
        leaf_containers = [c for c in containers if c.leaf_container]
        self.assertEqual(len(leaf_containers), 3)  # 3 valid files

        # Verify leaf containers have correct names
        leaf_names = [c.name for c in leaf_containers]
        self.assertIn("sales.csv", leaf_names)
        self.assertIn("products.json", leaf_names)

    def test_integration_structured_and_unstructured(self):
        """Test integration with both structured and unstructured formats"""
        bucket_response = GCSBucketResponse(
            name="test-bucket",
            project_id="my-gcp-project",
            creation_date=datetime.datetime(2025, 1, 1),
        )

        entries = [
            # Structured entry
            MetadataEntry(
                dataPath="tables/", structureFormat="parquet", isPartitioned=False
            ),
            # Unstructured entry
            MetadataEntry(dataPath="documents/", unstructuredFormats=[".pdf", ".docx"]),
            # Mixed - should only process as unstructured
            MetadataEntry(
                dataPath="reports/",
                structureFormat="csv",
                unstructuredFormats=[
                    ".txt"
                ],  # Should be ignored when structureFormat is set
            ),
        ]

        # Mock list_blobs for unstructured
        mock_client = MagicMock()
        mock_blobs = [
            MockBlob(name="documents/report1.pdf", size=1024),
            MockBlob(name="documents/report2.docx", size=2048),
        ]
        mock_client.list_blobs.return_value = mock_blobs

        self.gcs_source.gcs_clients.storage_client.clients = {
            "my-gcp-project": mock_client
        }

        # Mock container entity
        mock_container = MagicMock()
        mock_container.id.root = str(uuid.uuid4())
        self.gcs_source.metadata.get_by_name.return_value = mock_container

        # Mock get_size
        self.gcs_source.get_size = MagicMock(return_value=1024)

        parent = EntityReference(id=uuid.uuid4(), type="container")

        # Test _generate_unstructured_containers
        unstructured_containers = list(
            self.gcs_source._generate_unstructured_containers(
                bucket_response, entries, parent
            )
        )

        # Should only process the second entry (documents/) as unstructured
        # The first is structured (skipped), the third has structureFormat so skipped
        self.assertGreater(len(unstructured_containers), 0)

    def test_unstructured_container_cache_management(self):
        """Test that unstructured container cache is properly managed"""
        # Initially cache should be empty
        self.assertEqual(len(self.gcs_source._unstructured_container_cache), 0)

        # Add some entries to cache
        self.gcs_source._unstructured_container_cache["test.service.bucket.folder1"] = (
            "id1",
            "/folder1",
        )
        self.gcs_source._unstructured_container_cache["test.service.bucket.folder2"] = (
            "id2",
            "/folder2",
        )

        self.assertEqual(len(self.gcs_source._unstructured_container_cache), 2)

        # Simulate cache clear (happens after each bucket in get_containers)
        self.gcs_source._unstructured_container_cache.clear()

        self.assertEqual(len(self.gcs_source._unstructured_container_cache), 0)

    def test_generate_structured_containers_by_depth(self):
        """Test generating structured containers with depth specification"""
        bucket_response = GCSBucketResponse(
            name="test-bucket",
            project_id="my-gcp-project",
            creation_date=datetime.datetime(2025, 1, 1),
        )

        metadata_entry = MetadataEntry(
            dataPath="data/",
            structureFormat="parquet",
            depth=2,  # Look 2 levels deep
            isPartitioned=False,
        )

        # Mock list_blobs response
        mock_client = MagicMock()
        mock_blobs = [
            MockBlob(name="data/2025/01/sales.parquet", size=1024),
            MockBlob(name="data/2025/02/sales.parquet", size=2048),
            MockBlob(name="data/2024/12/sales.parquet", size=3072),
        ]
        mock_client.list_blobs.return_value = mock_blobs

        self.gcs_source.gcs_clients.storage_client.clients = {
            "my-gcp-project": mock_client
        }

        # Mock _get_sample_file_prefix
        self.gcs_source._get_sample_file_prefix = MagicMock(return_value="data/")

        # Mock _generate_container_details to return valid containers
        mock_container_details = GCSContainerDetails(
            name="test-container", prefix="/data/2025/01/", file_formats=[], size=1024
        )
        self.gcs_source._generate_container_details = MagicMock(
            return_value=mock_container_details
        )

        parent = EntityReference(id=uuid.uuid4(), type="container")

        containers = list(
            self.gcs_source._generate_structured_containers_by_depth(
                bucket_response, metadata_entry, parent
            )
        )

        # Should create containers for unique paths at depth 2
        self.assertGreater(len(containers), 0)
