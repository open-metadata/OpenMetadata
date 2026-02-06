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
Test Iceberg REST Catalog configuration
"""
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.iceberg.icebergCatalog import (
    IcebergCatalog,
)
from metadata.generated.schema.entity.services.connections.database.iceberg.restCatalogConnection import (
    OAuth2Credential,
    RestCatalogConnection,
    Sigv4,
)
from metadata.ingestion.source.database.iceberg.catalog.rest import IcebergRestCatalog


class TestIcebergRestCatalog(TestCase):
    """Test Iceberg REST Catalog parameter generation"""

    @patch("metadata.ingestion.source.database.iceberg.catalog.rest.load_rest")
    def test_rest_catalog_sigv4_parameters(self, mock_load_rest):
        """Test that sigv4 parameters are correctly set with the right parameter names"""

        # Create a catalog configuration with sigv4
        catalog = IcebergCatalog(
            name="test-catalog",
            warehouseLocation="s3://my-bucket/warehouse",
            connection=RestCatalogConnection(
                uri="https://my-rest-catalog.amazonaws.com/api/v1",
                sigv4=Sigv4(signingRegion="us-east-1", signingName="s3tables"),
            ),
        )

        # Call get_catalog
        IcebergRestCatalog.get_catalog(catalog)

        # Verify load_rest was called
        self.assertTrue(mock_load_rest.called)

        # Get the parameters passed to load_rest
        call_args = mock_load_rest.call_args
        parameters = call_args[0][1]  # Second argument (first is catalog name)

        # Verify the sigv4 parameters are correct
        self.assertIn("rest.sigv4-enabled", parameters)
        self.assertEqual(parameters["rest.sigv4-enabled"], "true")
        self.assertEqual(parameters["rest.signing_region"], "us-east-1")
        self.assertEqual(parameters["rest.signing_name"], "s3tables")

        # Verify the old incorrect parameter is not present
        self.assertNotIn("rest.sigv4", parameters)

    @patch("metadata.ingestion.source.database.iceberg.catalog.rest.load_rest")
    def test_rest_catalog_scope_parameter(self, mock_load_rest):
        """Test that scope parameter is correctly set when provided in OAuth2 credential"""

        # Create a catalog configuration with OAuth2 credential and scope
        catalog = IcebergCatalog(
            name="test-catalog",
            warehouseLocation="s3://my-bucket/warehouse",
            connection=RestCatalogConnection(
                uri="https://my-rest-catalog.example.com/api/v1",
                credential=OAuth2Credential(
                    clientId="test-client-id",
                    clientSecret="test-client-secret",
                    scopes="all-apis",
                ),
            ),
        )

        IcebergRestCatalog.get_catalog(catalog)

        self.assertTrue(mock_load_rest.called)

        call_args = mock_load_rest.call_args
        parameters = call_args[0][1]

        self.assertIn("scope", parameters)
        self.assertEqual(parameters["scope"], "all-apis")
        self.assertIn("credential", parameters)
        self.assertEqual(parameters["credential"], "test-client-id:test-client-secret")

    @patch("metadata.ingestion.source.database.iceberg.catalog.rest.load_rest")
    def test_rest_catalog_no_scope_when_not_provided(self, mock_load_rest):
        """Test that scope parameter is not set when not provided in OAuth2 credential"""

        catalog = IcebergCatalog(
            name="test-catalog",
            warehouseLocation="s3://my-bucket/warehouse",
            connection=RestCatalogConnection(
                uri="https://my-rest-catalog.example.com/api/v1",
                credential=OAuth2Credential(
                    clientId="test-client-id",
                    clientSecret="test-client-secret",
                ),
            ),
        )

        IcebergRestCatalog.get_catalog(catalog)

        self.assertTrue(mock_load_rest.called)

        call_args = mock_load_rest.call_args
        parameters = call_args[0][1]

        self.assertNotIn("scope", parameters)
        self.assertIn("credential", parameters)
        self.assertEqual(parameters["credential"], "test-client-id:test-client-secret")
