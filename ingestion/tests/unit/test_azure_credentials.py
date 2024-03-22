import unittest
from unittest.mock import patch

from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)


class TestAzureClient(unittest.TestCase):
    @patch("azure.identity.ClientSecretCredential")
    @patch("azure.identity.DefaultAzureCredential")
    def test_create_client(
        self,
        mock_default_credential,
        mock_client_secret_credential,
    ):
        # Test with ClientSecretCredential
        credentials = AzureCredentials(
            clientId="clientId", clientSecret="clientSecret", tenantId="tenantId"
        )
        instance = AzureClient(credentials)
        instance.create_client()

        mock_client_secret_credential.assert_called_once()
        mock_client_secret_credential.reset_mock()

        credentials = AzureCredentials(
            clientId="clientId",
        )
        instance = AzureClient(credentials)

        instance.create_client()

        mock_default_credential.assert_called_once()

    @patch("azure.storage.blob.BlobServiceClient")
    def test_create_blob_client(self, mock_blob_service_client):
        credentials = AzureCredentials(
            clientId="clientId", clientSecret="clientSecret", tenantId="tenantId"
        )
        with self.assertRaises(ValueError):
            AzureClient(credentials=credentials).create_blob_client()

        credentials.accountName = "accountName"
        AzureClient(credentials=credentials).create_blob_client()
        mock_blob_service_client.assert_called_once()

    @patch("azure.keyvault.secrets.SecretClient")
    def test_create_secret_client(self, mock_secret_client):
        credentials = AzureCredentials(
            clientId="clientId", clientSecret="clientSecret", tenantId="tenantId"
        )
        with self.assertRaises(ValueError):
            AzureClient(credentials=credentials).create_secret_client()

        credentials.vaultName = "vaultName"
        AzureClient(credentials=credentials).create_secret_client()
        mock_secret_client.assert_called_once()


if __name__ == "__main__":
    unittest.main()
