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
Test BurstIQ Lineage Extraction - table and column lineage from edges
"""

from unittest import TestCase
from unittest.mock import Mock, patch

from metadata.ingestion.source.database.burstiq.lineage import BurstiqLineageSource
from metadata.ingestion.source.database.burstiq.models import BurstIQEdge


class TestBurstIQLineage(TestCase):
    """Test BurstIQ Lineage Extraction"""

    def setUp(self):
        """Set up test fixtures"""
        # Sample edge data
        self.sample_edge = {
            "id": "edge_1",
            "name": "patient_to_visit",
            "fromDictionary": "patient",
            "toDictionary": "visit",
            "condition": [
                {"fromCol": "patient_id", "toCol": "patient_id"},
                {"fromCol": "mrn", "toCol": "medical_record_number"},
            ],
        }

        # Sample edge without column mapping
        self.sample_edge_no_columns = {
            "id": "edge_2",
            "name": "visit_to_diagnosis",
            "fromDictionary": "visit",
            "toDictionary": "diagnosis",
            "condition": [],
        }

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    def test_lineage_source_initialization(self, mock_post):
        """Test lineage source initialization"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = {
            "access_token": "test_token",
            "expires_in": 3600,
        }
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Create config
        config_dict = {
            "type": "burstiq",
            "serviceName": "test_burstiq",
            "serviceConnection": {
                "config": {
                    "type": "BurstIQ",
                    "username": "test_user",
                    "password": "test_password",
                    "realmName": "test_realm",
                    "biqSdzName": "test_sdz",
                    "biqCustomerName": "test_customer",
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseLineage"}},
        }

        mock_metadata = Mock()

        # This should not raise an exception
        with patch.object(BurstiqLineageSource, "test_connection"):
            source = BurstiqLineageSource.create(config_dict, mock_metadata)
            self.assertIsNotNone(source)

    def test_edge_model_validation(self):
        """Test BurstIQEdge model validation"""
        # Valid edge
        edge = BurstIQEdge(**self.sample_edge)
        self.assertEqual(edge.name, "patient_to_visit")
        self.assertEqual(edge.fromDictionary, "patient")
        self.assertEqual(edge.toDictionary, "visit")
        self.assertEqual(len(edge.condition), 2)
        self.assertEqual(edge.condition[0].fromCol, "patient_id")
        self.assertEqual(edge.condition[0].toCol, "patient_id")

    def test_edge_without_columns(self):
        """Test edge without column mappings"""
        edge = BurstIQEdge(**self.sample_edge_no_columns)
        self.assertEqual(edge.name, "visit_to_diagnosis")
        self.assertEqual(len(edge.condition), 0)

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    def test_get_table_entity_not_found(self, mock_post):
        """Test table entity not found"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = {
            "access_token": "test_token",
            "expires_in": 3600,
        }
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Create config
        config_dict = {
            "type": "burstiq",
            "serviceName": "test_burstiq",
            "serviceConnection": {
                "config": {
                    "type": "BurstIQ",
                    "username": "test_user",
                    "password": "test_password",
                    "realmName": "test_realm",
                    "biqSdzName": "test_sdz",
                    "biqCustomerName": "test_customer",
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseLineage"}},
        }

        mock_metadata = Mock()
        mock_metadata.get_by_name.side_effect = Exception("Not found")

        with patch.object(BurstiqLineageSource, "test_connection"):
            source = BurstiqLineageSource.create(config_dict, mock_metadata)
            source.metadata = mock_metadata

            # Get table entity - should return None
            table = source._get_table_entity("nonexistent")

            # Verify
            self.assertIsNone(table)

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    def test_process_edge_missing_tables(self, mock_post):
        """Test processing edge when tables don't exist"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = {
            "access_token": "test_token",
            "expires_in": 3600,
        }
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Create config
        config_dict = {
            "type": "burstiq",
            "serviceName": "test_burstiq",
            "serviceConnection": {
                "config": {
                    "type": "BurstIQ",
                    "username": "test_user",
                    "password": "test_password",
                    "realmName": "test_realm",
                    "biqSdzName": "test_sdz",
                    "biqCustomerName": "test_customer",
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseLineage"}},
        }

        mock_metadata = Mock()
        mock_metadata.get_by_name.return_value = None

        with patch.object(BurstiqLineageSource, "test_connection"):
            source = BurstiqLineageSource.create(config_dict, mock_metadata)
            source.metadata = mock_metadata

            # Process edge - should return None when tables not found
            result = source._process_edge(self.sample_edge)

            # Verify no lineage was created
            self.assertIsNone(result)

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    @patch("metadata.ingestion.source.database.burstiq.client.requests.request")
    def test_lineage_iteration_success(self, mock_request, mock_post):
        """Test successful lineage iteration from edges"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = {
            "access_token": "test_token",
            "expires_in": 3600,
        }
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Mock get edges response
        mock_edges_response = Mock()
        mock_edges_response.json.return_value = [
            self.sample_edge,
            self.sample_edge_no_columns,
        ]
        mock_edges_response.raise_for_status = Mock()
        mock_request.return_value = mock_edges_response

        # Create config
        config_dict = {
            "type": "burstiq",
            "serviceName": "test_burstiq",
            "serviceConnection": {
                "config": {
                    "type": "BurstIQ",
                    "username": "test_user",
                    "password": "test_password",
                    "realmName": "test_realm",
                    "biqSdzName": "test_sdz",
                    "biqCustomerName": "test_customer",
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseLineage"}},
        }

        mock_metadata = Mock()
        mock_metadata.get_by_name.return_value = None  # Simulate tables not found

        with patch.object(BurstiqLineageSource, "test_connection"):
            source = BurstiqLineageSource.create(config_dict, mock_metadata)
            source.metadata = mock_metadata

            # Iterate lineage
            results = list(source._iter())

            # Verify edges were fetched
            mock_request.assert_called_once()

    @patch("metadata.ingestion.source.database.burstiq.client.requests.post")
    @patch("metadata.ingestion.source.database.burstiq.client.requests.request")
    def test_lineage_iteration_error_handling(self, mock_request, mock_post):
        """Test error handling during lineage iteration"""
        # Mock authentication
        mock_auth_response = Mock()
        mock_auth_response.json.return_value = {
            "access_token": "test_token",
            "expires_in": 3600,
        }
        mock_auth_response.raise_for_status = Mock()
        mock_post.return_value = mock_auth_response

        # Mock get edges failure
        mock_request.side_effect = Exception("API Error")

        # Create config
        config_dict = {
            "type": "burstiq",
            "serviceName": "test_burstiq",
            "serviceConnection": {
                "config": {
                    "type": "BurstIQ",
                    "username": "test_user",
                    "password": "test_password",
                    "realmName": "test_realm",
                    "biqSdzName": "test_sdz",
                    "biqCustomerName": "test_customer",
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseLineage"}},
        }

        mock_metadata = Mock()

        with patch.object(BurstiqLineageSource, "test_connection"):
            source = BurstiqLineageSource.create(config_dict, mock_metadata)
            source.metadata = mock_metadata

            # Iterate lineage - should yield error
            results = list(source._iter())

            # Verify error was yielded
            self.assertEqual(len(results), 1)
            self.assertTrue(results[0].left)  # Error is on left side of Either
