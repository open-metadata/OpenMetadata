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
Unit tests for DbtHttpConfig — verifies that custom HTTP headers and SSL
verification settings are correctly forwarded to requests.get() calls.
"""

from unittest.mock import MagicMock, patch

import pytest
import requests

from metadata.generated.schema.metadataIngestion.dbtconfig.dbtHttpConfig import (
    DbtConfigType,
    DbtHttpConfig,
)
from metadata.generated.schema.security.ssl.validateSSLClientConfig import (
    ValidateSslClientConfig,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import SslConfig, VerifySSL
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.ingestion.source.database.dbt.dbt_config import (
    DBTConfigException,
    get_dbt_details,
)

MANIFEST_URL = "https://example.com/manifest.json"
MANIFEST_JSON = {
    "metadata": {},
    "nodes": {},
    "sources": {},
    "exposures": {},
    "metrics": {},
}


def _make_json_response(data: dict, status_code: int = 200) -> MagicMock:
    """Build a mock requests.Response whose .json() returns *data*."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = data
    resp.raise_for_status.return_value = None
    return resp


def _base_config(**kwargs) -> DbtHttpConfig:
    """Minimal valid DbtHttpConfig with only manifest path set."""
    return DbtHttpConfig(
        dbtConfigType=DbtConfigType.http,
        dbtManifestHttpPath=MANIFEST_URL,
        **kwargs,
    )


class TestDbtHttpConfigNoAuth:
    """requests.get is called with empty headers and verify=True when no auth/SSL is configured."""

    def test_no_auth_no_ssl_uses_empty_headers_and_verify_true(self):
        config = _base_config()
        manifest_resp = _make_json_response(MANIFEST_JSON)

        with patch(
            "metadata.ingestion.source.database.dbt.dbt_config.requests.get",
            return_value=manifest_resp,
        ) as mock_get:
            list(get_dbt_details(config))

        mock_get.assert_called_once_with(MANIFEST_URL, headers={}, verify=True, timeout=30)


class TestDbtHttpConfigCustomHeaders:
    """Custom headers dict is forwarded verbatim to every requests.get() call."""

    def test_custom_authorization_header_passed_to_manifest_fetch(self):
        config = _base_config(dbtHttpHeaders={"Authorization": "Bearer mytoken"})
        manifest_resp = _make_json_response(MANIFEST_JSON)

        with patch(
            "metadata.ingestion.source.database.dbt.dbt_config.requests.get",
            return_value=manifest_resp,
        ) as mock_get:
            list(get_dbt_details(config))

        _, kwargs = mock_get.call_args
        assert kwargs["headers"] == {"Authorization": "Bearer mytoken"}

    def test_gitlab_private_token_header_passed(self):
        config = _base_config(dbtHttpHeaders={"PRIVATE-TOKEN": "glpat-abc123"})
        manifest_resp = _make_json_response(MANIFEST_JSON)

        with patch(
            "metadata.ingestion.source.database.dbt.dbt_config.requests.get",
            return_value=manifest_resp,
        ) as mock_get:
            list(get_dbt_details(config))

        _, kwargs = mock_get.call_args
        assert kwargs["headers"] == {"PRIVATE-TOKEN": "glpat-abc123"}

    def test_headers_forwarded_to_all_optional_fetch_calls(self):
        config = _base_config(
            dbtHttpHeaders={"Authorization": "Bearer tok"},
            dbtRunResultsHttpPath="https://example.com/run_results.json",
            dbtCatalogHttpPath="https://example.com/catalog.json",
            dbtSourcesHttpPath="https://example.com/sources.json",
        )
        manifest_resp = _make_json_response(MANIFEST_JSON)
        other_resp = _make_json_response({})

        with patch(
            "requests.get",
            side_effect=[manifest_resp, other_resp, other_resp, other_resp],
        ) as mock_get:
            list(get_dbt_details(config))

        assert mock_get.call_count == 4
        for actual_call in mock_get.call_args_list:
            _, kwargs = actual_call
            assert kwargs["headers"] == {"Authorization": "Bearer tok"}


class TestDbtHttpConfigSSLVerify:
    """verifySSL enum values produce correct verify= argument to requests.get()."""

    def test_verify_ssl_ignore_passes_verify_false(self):
        config = _base_config(dbtVerifySSL=VerifySSL.ignore)
        manifest_resp = _make_json_response(MANIFEST_JSON)

        with patch(
            "metadata.ingestion.source.database.dbt.dbt_config.requests.get",
            return_value=manifest_resp,
        ) as mock_get:
            list(get_dbt_details(config))

        _, kwargs = mock_get.call_args
        assert kwargs["verify"] is False

    def test_verify_ssl_validate_passes_ca_cert_path(self):
        ssl_config = SslConfig(root=ValidateSslClientConfig(caCertificate=CustomSecretStr("/path/to/ca.pem")))
        config = _base_config(
            dbtVerifySSL=VerifySSL.validate,
            dbtSSLConfig=ssl_config,
        )
        manifest_resp = _make_json_response(MANIFEST_JSON)

        with patch(
            "metadata.ingestion.source.database.dbt.dbt_config.requests.get",
            return_value=manifest_resp,
        ) as mock_get:
            list(get_dbt_details(config))

        _, kwargs = mock_get.call_args
        assert kwargs["verify"] == "/path/to/ca.pem"

    def test_verify_ssl_no_ssl_passes_verify_true(self):
        config = _base_config(dbtVerifySSL=VerifySSL.no_ssl)
        manifest_resp = _make_json_response(MANIFEST_JSON)

        with patch(
            "metadata.ingestion.source.database.dbt.dbt_config.requests.get",
            return_value=manifest_resp,
        ) as mock_get:
            list(get_dbt_details(config))

        _, kwargs = mock_get.call_args
        assert kwargs["verify"] is True


class TestDbtHttpConfigErrorHandling:
    """SSL and auth errors raise DBTConfigException with informative messages."""

    def test_ssl_error_raises_dbt_config_exception(self):
        ssl_config = SslConfig(root=ValidateSslClientConfig(caCertificate=CustomSecretStr("/path/to/ca.pem")))
        config = _base_config(
            dbtVerifySSL=VerifySSL.validate,
            dbtSSLConfig=ssl_config,
        )

        with patch(
            "requests.get",
            side_effect=requests.exceptions.SSLError("cert verify failed"),
        ):
            with pytest.raises(DBTConfigException) as exc_info:
                list(get_dbt_details(config))

        assert "SSL verification failed" in str(exc_info.value)
        assert MANIFEST_URL in str(exc_info.value)

    def test_401_raises_dbt_config_exception_with_auth_hint(self):
        config = _base_config()
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        http_error = requests.exceptions.HTTPError(response=mock_resp)
        mock_resp.raise_for_status.side_effect = http_error

        with patch(
            "metadata.ingestion.source.database.dbt.dbt_config.requests.get",
            return_value=mock_resp,
        ):
            with pytest.raises(DBTConfigException) as exc_info:
                list(get_dbt_details(config))

        assert "dbtHttpHeaders" in str(exc_info.value)

    def test_403_raises_dbt_config_exception_with_auth_hint(self):
        config = _base_config()
        mock_resp = MagicMock()
        mock_resp.status_code = 403
        http_error = requests.exceptions.HTTPError(response=mock_resp)
        mock_resp.raise_for_status.side_effect = http_error

        with patch(
            "metadata.ingestion.source.database.dbt.dbt_config.requests.get",
            return_value=mock_resp,
        ):
            with pytest.raises(DBTConfigException) as exc_info:
                list(get_dbt_details(config))

        assert "dbtHttpHeaders" in str(exc_info.value)
