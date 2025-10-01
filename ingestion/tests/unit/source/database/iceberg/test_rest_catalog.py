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
Test Iceberg REST Catalog OAuth2 Configuration
"""
from unittest import TestCase
from unittest.mock import MagicMock, patch

from pydantic import SecretStr

from metadata.generated.schema.entity.services.connections.database.iceberg.icebergCatalog import (
    IcebergCatalog,
)
from metadata.generated.schema.entity.services.connections.database.iceberg.restCatalogConnection import (
    OAuth2Credential,
    RestCatalogConnection,
)
from metadata.ingestion.source.database.iceberg.catalog.rest import IcebergRestCatalog


class TestIcebergRestCatalog(TestCase):
    """Test Iceberg REST Catalog with OAuth2 credentials"""

    def test_oauth2_credentials_without_token(self):
        """
        Test that OAuth2 credentials (clientId:clientSecret) are properly
        passed to PyIceberg without including token parameter.
        
        This simulates the reported issue where providing OAuth2 credentials
        should not include token=None in parameters.
        """
        # Setup REST catalog with OAuth2 credentials, no token
        rest_connection = RestCatalogConnection(
            uri="http://polaris.example.com:8181/api/catalog",
            credential=OAuth2Credential(
                clientId=SecretStr("test-client-id"),
                clientSecret=SecretStr("test-client-secret"),
            ),
        )

        catalog = IcebergCatalog(
            name="test_catalog",
            connection=rest_connection,
            warehouseLocation="s3://warehouse/location",
        )

        # Mock load_rest to capture the parameters
        with patch("metadata.ingestion.source.database.iceberg.catalog.rest.load_rest") as mock_load_rest:
            mock_load_rest.return_value = MagicMock()
            
            IcebergRestCatalog.get_catalog(catalog)
            
            # Verify load_rest was called
            mock_load_rest.assert_called_once()
            
            # Get the parameters that were passed
            call_args = mock_load_rest.call_args
            parameters = call_args[1] if len(call_args) > 1 else call_args.kwargs
            
            # Verify parameters contain credential but NOT token
            self.assertIn("credential", parameters)
            self.assertEqual(parameters["credential"], "test-client-id:test-client-secret")
            self.assertNotIn("token", parameters, "Token should not be in parameters when using OAuth2 credentials")
            self.assertIn("warehouse", parameters)
            self.assertEqual(parameters["warehouse"], "s3://warehouse/location")
            self.assertIn("uri", parameters)
            self.assertEqual(parameters["uri"], "http://polaris.example.com:8181/api/catalog")

    def test_bearer_token_without_credentials(self):
        """
        Test that bearer token is properly passed to PyIceberg
        without including credential parameter.
        """
        # Setup REST catalog with bearer token, no OAuth2 credentials
        rest_connection = RestCatalogConnection(
            uri="http://rest-catalog.example.com",
            token=SecretStr("my-bearer-token"),
        )

        catalog = IcebergCatalog(
            name="test_catalog",
            connection=rest_connection,
            warehouseLocation="s3://warehouse/location",
        )

        # Mock load_rest to capture the parameters
        with patch("metadata.ingestion.source.database.iceberg.catalog.rest.load_rest") as mock_load_rest:
            mock_load_rest.return_value = MagicMock()
            
            IcebergRestCatalog.get_catalog(catalog)
            
            # Verify load_rest was called
            mock_load_rest.assert_called_once()
            
            # Get the parameters that were passed
            call_args = mock_load_rest.call_args
            parameters = call_args[1] if len(call_args) > 1 else call_args.kwargs
            
            # Verify parameters contain token but NOT credential
            self.assertIn("token", parameters)
            self.assertEqual(parameters["token"], "my-bearer-token")
            self.assertNotIn("credential", parameters, "Credential should not be in parameters when using bearer token")
            self.assertIn("warehouse", parameters)
            self.assertIn("uri", parameters)

    def test_no_authentication(self):
        """
        Test that when neither OAuth2 credentials nor bearer token are provided,
        neither parameter is included.
        """
        # Setup REST catalog without authentication
        rest_connection = RestCatalogConnection(
            uri="http://rest-catalog.example.com",
        )

        catalog = IcebergCatalog(
            name="test_catalog",
            connection=rest_connection,
            warehouseLocation="s3://warehouse/location",
        )

        # Mock load_rest to capture the parameters
        with patch("metadata.ingestion.source.database.iceberg.catalog.rest.load_rest") as mock_load_rest:
            mock_load_rest.return_value = MagicMock()
            
            IcebergRestCatalog.get_catalog(catalog)
            
            # Verify load_rest was called
            mock_load_rest.assert_called_once()
            
            # Get the parameters that were passed
            call_args = mock_load_rest.call_args
            parameters = call_args[1] if len(call_args) > 1 else call_args.kwargs
            
            # Verify parameters contain neither token nor credential
            self.assertNotIn("token", parameters, "Token should not be in parameters without authentication")
            self.assertNotIn("credential", parameters, "Credential should not be in parameters without authentication")
            self.assertIn("warehouse", parameters)
            self.assertIn("uri", parameters)

    def test_oauth2_partial_credentials(self):
        """
        Test that partial OAuth2 credentials (only clientId, no clientSecret)
        are not included in parameters.
        """
        # Setup REST catalog with partial OAuth2 credentials
        rest_connection = RestCatalogConnection(
            uri="http://rest-catalog.example.com",
            credential=OAuth2Credential(
                clientId=SecretStr("test-client-id"),
                # No clientSecret
            ),
        )

        catalog = IcebergCatalog(
            name="test_catalog",
            connection=rest_connection,
            warehouseLocation="s3://warehouse/location",
        )

        # Mock load_rest to capture the parameters
        with patch("metadata.ingestion.source.database.iceberg.catalog.rest.load_rest") as mock_load_rest:
            mock_load_rest.return_value = MagicMock()
            
            IcebergRestCatalog.get_catalog(catalog)
            
            # Verify load_rest was called
            mock_load_rest.assert_called_once()
            
            # Get the parameters that were passed
            call_args = mock_load_rest.call_args
            parameters = call_args[1] if len(call_args) > 1 else call_args.kwargs
            
            # Verify parameters don't contain credential when it's incomplete
            self.assertNotIn("credential", parameters, "Incomplete credentials should not be included")
            self.assertNotIn("token", parameters)
