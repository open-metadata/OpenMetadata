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
Unit tests for AzureClient commercial, sovereign, and custom cloud endpoint resolution.
"""

from unittest.mock import patch

import pytest
from azure.identity import ClientSecretCredential

from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)

VALID_TENANT_ID = "11111111-2222-3333-4444-555555555555"


class TestAzureClient:
    @patch("azure.identity.ClientSecretCredential")
    @patch("azure.identity.DefaultAzureCredential")
    def test_create_client_commercial_defaults_omit_authority(
        self,
        mock_default_credential,
        mock_client_secret_credential,
    ):
        credentials = AzureCredentials(
            clientId="clientId",
            clientSecret="clientSecret",
            tenantId="tenantId",
        )
        AzureClient(credentials).create_client()

        mock_client_secret_credential.assert_called_once_with(
            tenant_id="tenantId",
            client_id="clientId",
            client_secret="clientSecret",
        )
        mock_default_credential.assert_not_called()

        credentials_default = AzureCredentials(clientId="clientId")
        AzureClient(credentials_default).create_client()

        mock_default_credential.assert_called_once_with()

    def test_init_validates_raw_mapping(self):
        client = AzureClient(
            {
                "clientId": "cid",
                "tenantId": VALID_TENANT_ID,
                "accountName": "govstorage01",
                "endpointSuffix": "core.usgovcloudapi.net",
            }
        )
        assert isinstance(client.credentials, AzureCredentials)
        assert client.credentials.endpointSuffix == "core.usgovcloudapi.net"

    def test_create_client_us_government_auto_derives_authority_on_real_sdk(self):
        credentials = AzureCredentials(
            clientId="gov-client-id",
            clientSecret="gov-client-secret",
            tenantId=VALID_TENANT_ID,
            endpointSuffix="core.usgovcloudapi.net",
        )
        sdk_cred = AzureClient(credentials).create_client()

        assert isinstance(sdk_cred, ClientSecretCredential)
        assert sdk_cred._authority == "https://login.microsoftonline.us"
        assert sdk_cred._instance_discovery is None

    @patch("azure.identity.DefaultAzureCredential")
    def test_create_client_default_credential_receives_sovereign_authority(
        self,
        mock_default_credential,
    ):
        credentials = AzureCredentials(
            accountName="govstorage01",
            endpointSuffix="core.usgovcloudapi.net",
        )
        AzureClient(credentials).create_client()

        mock_default_credential.assert_called_once_with(authority="https://login.microsoftonline.us")

    def test_create_client_china_normalizes_leading_dot_and_derives_authority(self):
        credentials = AzureCredentials(
            clientId="cn-client-id",
            clientSecret="cn-client-secret",
            tenantId=VALID_TENANT_ID,
            endpointSuffix="  .core.chinacloudapi.cn  ",
        )
        sdk_cred = AzureClient(credentials).create_client()

        assert isinstance(sdk_cred, ClientSecretCredential)
        assert sdk_cred._authority == "https://login.chinacloudapi.cn"
        assert sdk_cred._instance_discovery is None

    @pytest.mark.parametrize(
        "raw_authority",
        [
            "https://login.customcloud.local/",
            "login.customcloud.local",
            "  https://login.customcloud.local  ",
        ],
    )
    def test_create_client_custom_cloud_disables_msal_instance_discovery_on_token_init(
        self,
        raw_authority: str,
    ):
        from unittest.mock import MagicMock

        credentials = AzureCredentials(
            clientId="stack-client-id",
            clientSecret="stack-client-secret",
            tenantId=VALID_TENANT_ID,
            endpointSuffix="core.customcloud.local",
            authority=raw_authority,
        )
        sdk_cred = AzureClient(credentials).create_client()

        assert isinstance(sdk_cred, ClientSecretCredential)
        assert sdk_cred._authority == "https://login.customcloud.local"
        assert sdk_cred._instance_discovery is False

        mock_oidc_resp = MagicMock()
        mock_oidc_resp.status_code = 200
        mock_oidc_resp.text = (
            '{"authorization_endpoint":"https://login.customcloud.local/'
            f'{VALID_TENANT_ID}/oauth2/v2.0/authorize",'
            '"token_endpoint":"https://login.customcloud.local/'
            f'{VALID_TENANT_ID}/oauth2/v2.0/token",'
            '"issuer":"https://login.customcloud.local/'
            f'{VALID_TENANT_ID}/v2.0"}}'
        )
        with patch.object(sdk_cred._client, "get", return_value=mock_oidc_resp) as mock_http_get:
            msal_app = sdk_cred._get_app()

        requested_urls = [call.args[0] for call in mock_http_get.call_args_list]
        assert requested_urls == [
            f"https://login.customcloud.local/{VALID_TENANT_ID}/v2.0/.well-known/openid-configuration"
        ]
        assert all("login.microsoftonline.com" not in url for url in requested_urls)
        assert msal_app.authority.token_endpoint == (
            f"https://login.customcloud.local/{VALID_TENANT_ID}/oauth2/v2.0/token"
        )

    def test_create_client_custom_cloud_default_credential_disables_instance_discovery(self):
        from azure.identity import DefaultAzureCredential

        credentials = AzureCredentials(
            accountName="stackstorage01",
            endpointSuffix="core.customcloud.local",
            authority="login.customcloud.local",
        )
        with patch("azure.identity.DefaultAzureCredential", wraps=DefaultAzureCredential) as spy_dac:
            dac = AzureClient(credentials).create_client()

        spy_dac.assert_called_once_with(
            authority="https://login.customcloud.local",
            disable_instance_discovery=True,
        )
        assert isinstance(dac, DefaultAzureCredential)

    @patch("azure.storage.blob.BlobServiceClient")
    def test_create_blob_client_commercial_and_missing_account(self, mock_blob_service_client):
        credentials = AzureCredentials(
            clientId="clientId",
            clientSecret="clientSecret",
            tenantId=VALID_TENANT_ID,
        )
        with pytest.raises(ValueError, match="Account Name is required"):
            AzureClient(credentials=credentials).create_blob_client()

        credentials.accountName = "accountName"
        AzureClient(credentials=credentials).create_blob_client()

        mock_blob_service_client.assert_called_once()
        call_kwargs = mock_blob_service_client.call_args.kwargs
        assert call_kwargs["account_url"] == "https://accountName.blob.core.windows.net/"
        assert isinstance(call_kwargs["credential"], ClientSecretCredential)

    @pytest.mark.parametrize(
        ("endpoint_suffix", "expected_blob_url", "expected_authority"),
        [
            (
                "core.usgovcloudapi.net",
                "https://govacct.blob.core.usgovcloudapi.net/",
                "https://login.microsoftonline.us",
            ),
            (
                ".core.chinacloudapi.cn",
                "https://govacct.blob.core.chinacloudapi.cn/",
                "https://login.chinacloudapi.cn",
            ),
            (
                "core.customcloud.local",
                "https://govacct.blob.core.customcloud.local/",
                "https://login.microsoftonline.com",
            ),
        ],
    )
    @patch("azure.storage.blob.BlobServiceClient")
    def test_create_blob_client_sovereign_and_custom_endpoints(
        self,
        mock_blob_service_client,
        endpoint_suffix: str,
        expected_blob_url: str,
        expected_authority: str,
    ):
        credentials = AzureCredentials(
            accountName="govacct",
            clientId="cid",
            clientSecret="sec",
            tenantId=VALID_TENANT_ID,
            endpointSuffix=endpoint_suffix,
        )
        AzureClient(credentials=credentials).create_blob_client()

        call_kwargs = mock_blob_service_client.call_args.kwargs
        assert call_kwargs["account_url"] == expected_blob_url
        assert call_kwargs["credential"]._authority == expected_authority

    @patch("azure.keyvault.secrets.SecretClient")
    def test_create_secret_client_commercial_and_sovereign_vault_urls(self, mock_secret_client):
        credentials = AzureCredentials(
            clientId="clientId",
            clientSecret="clientSecret",
            tenantId=VALID_TENANT_ID,
        )
        with pytest.raises(ValueError, match="Vault Name is required"):
            AzureClient(credentials=credentials).create_secret_client()

        credentials.vaultName = "vaultName"
        AzureClient(credentials=credentials).create_secret_client()
        assert mock_secret_client.call_args.kwargs["vault_url"] == "https://vaultName.vault.azure.net/"

        mock_secret_client.reset_mock()
        gov_creds = AzureCredentials(
            vaultName="gov-vault-01",
            clientId="clientId",
            clientSecret="clientSecret",
            tenantId=VALID_TENANT_ID,
            endpointSuffix="core.usgovcloudapi.net",
        )
        AzureClient(credentials=gov_creds).create_secret_client()
        gov_kwargs = mock_secret_client.call_args.kwargs
        assert gov_kwargs["vault_url"] == "https://gov-vault-01.vault.usgovcloudapi.net/"
        assert gov_kwargs["credential"]._authority == "https://login.microsoftonline.us"

        mock_secret_client.reset_mock()
        cn_creds = AzureCredentials(
            vaultName="cn-vault-01",
            clientId="clientId",
            clientSecret="clientSecret",
            tenantId=VALID_TENANT_ID,
            endpointSuffix=".core.chinacloudapi.cn",
        )
        AzureClient(credentials=cn_creds).create_secret_client()
        cn_kwargs = mock_secret_client.call_args.kwargs
        assert cn_kwargs["vault_url"] == "https://cn-vault-01.vault.azure.cn/"
        assert cn_kwargs["credential"]._authority == "https://login.chinacloudapi.cn"

        mock_secret_client.reset_mock()
        custom_creds = AzureCredentials(
            vaultName="stack-vault",
            clientId="clientId",
            clientSecret="clientSecret",
            tenantId=VALID_TENANT_ID,
            endpointSuffix="core.customcloud.local",
            authority="login.customcloud.local",
        )
        AzureClient(credentials=custom_creds).create_secret_client()
        custom_kwargs = mock_secret_client.call_args.kwargs
        assert custom_kwargs["vault_url"] == "https://stack-vault.vault.customcloud.local/"
        assert custom_kwargs["credential"]._authority == "https://login.customcloud.local"

    @pytest.mark.parametrize(
        "malicious_suffix",
        [
            "evil.com/path",
            "evil.com?x=1",
            "evil.com#frag",
            "user@evil.com",
            "evil.com:8080",
            "https://evil.com",
            "http://evil.com",
            "169.254.169.254",
            "127.0.0.1",
            "[::1]",
            "localhost",
            "..evil.com",
            "-invalid.com",
        ],
    )
    @patch("azure.storage.blob.BlobServiceClient")
    def test_rejects_malicious_endpoint_suffix_before_sdk_instantiation(
        self, mock_blob_service_client, malicious_suffix: str
    ):
        credentials = AzureCredentials(
            accountName="validaccount",
            clientId="cid",
            clientSecret="sec",
            tenantId=VALID_TENANT_ID,
            endpointSuffix=malicious_suffix,
        )
        with pytest.raises(ValueError):
            AzureClient(credentials).create_blob_client()

        mock_blob_service_client.assert_not_called()

    @pytest.mark.parametrize(
        "malicious_authority",
        [
            "http://login.microsoftonline.us",
            "ftp://login.microsoftonline.us",
            "https://169.254.169.254",
            "https://127.0.0.1",
            "https://localhost",
            "https://evil.com/path",
            "https://evil.com/path?x=1",
            "https://evil.com?x=1",
            "https://evil.com#frag",
            "https://user:pass@evil.com",
            "https://evil.com:8443",
            "evil.com:8443",
            "evil.com/tenant",
        ],
    )
    @patch("azure.identity.ClientSecretCredential")
    @patch("azure.identity.DefaultAzureCredential")
    def test_rejects_malicious_authority_before_sdk_instantiation(
        self,
        mock_default_credential,
        mock_client_secret_credential,
        malicious_authority: str,
    ):
        credentials = AzureCredentials(
            accountName="validaccount",
            clientId="cid",
            clientSecret="sec",
            tenantId=VALID_TENANT_ID,
            authority=malicious_authority,
        )
        with pytest.raises(ValueError):
            AzureClient(credentials).create_client()

        mock_client_secret_credential.assert_not_called()
        mock_default_credential.assert_not_called()

    @pytest.mark.parametrize(
        "malicious_name",
        [
            "acct/evil",
            "acct?sas=1",
            "acct#frag",
            "user@evil",
            "acct:8080",
            "acct name",
            "acct.evil.com",
            "-leadinghyphen",
        ],
    )
    @patch("azure.storage.blob.BlobServiceClient")
    @patch("azure.keyvault.secrets.SecretClient")
    def test_rejects_malicious_account_or_vault_name(
        self,
        mock_secret_client,
        mock_blob_service_client,
        malicious_name: str,
    ):
        blob_creds = AzureCredentials(
            accountName=malicious_name,
            clientId="cid",
            clientSecret="sec",
            tenantId=VALID_TENANT_ID,
        )
        with pytest.raises(ValueError):
            AzureClient(blob_creds).create_blob_client()
        mock_blob_service_client.assert_not_called()

        vault_creds = AzureCredentials(
            vaultName=malicious_name,
            clientId="cid",
            clientSecret="sec",
            tenantId=VALID_TENANT_ID,
        )
        with pytest.raises(ValueError):
            AzureClient(vault_creds).create_secret_client()
        mock_secret_client.assert_not_called()

    @pytest.mark.parametrize(
        "container_name",
        [
            "raw-zone",
            "  my-container-01  ",
            "$web",
            "$logs",
            "$root",
            "$blobchangefeed",
        ],
    )
    def test_validate_container_name_accepts_dns_labels_and_system_containers(
        self,
        container_name: str,
    ):
        assert AzureClient.validate_container_name(container_name) == container_name.strip()

    @pytest.mark.parametrize(
        "invalid_container",
        [
            None,
            "",
            "   ",
            "$",
            "$WEB",
            "$bad-dash",
            "$web@evil",
            "$bad/path",
            "$bad\\path",
            "$bad:80",
            "$bad?sas=1",
            "$bad#frag",
            "$bad.dot",
            "container@evil",
            "container/path",
        ],
    )
    def test_validate_container_name_rejects_invalid_or_injected_names(
        self,
        invalid_container: str | None,
    ):
        with pytest.raises(ValueError):
            AzureClient.validate_container_name(invalid_container)
