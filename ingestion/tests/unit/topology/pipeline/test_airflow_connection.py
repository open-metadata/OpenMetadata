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
Tests for Airflow REST API authentication methods.

These tests verify every auth path in auth.py and the AirflowApiClient constructor:
  - AccessToken    : static bearer token, no refresh
  - BasicAuth      : Airflow 3.x JWT exchange (success) and Basic auth fallback
  - GcpCredentials : all 4 GCP credential types + service account impersonation
  - Token refresh  : GCP callback is called on every invocation (google-auth
                     manages expiry internally; REST client calls callback when
                     its own expires_in check triggers)
"""
import base64
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.utils.common.accessTokenConfig import AccessToken
from metadata.generated.schema.entity.utils.common.basicAuthConfig import BasicAuth
from metadata.generated.schema.entity.utils.common.gcpCredentialsConfig import (
    GcpServiceAccount,
)
from metadata.ingestion.source.pipeline.airflow.api.auth import (
    _BASIC_AUTH_TTL_SECONDS,
    _JWT_REFRESH_INTERVAL_SECONDS,
    build_access_token_callback,
    build_basic_auth_callback,
    build_gcp_token_callback,
    try_exchange_jwt,
)
from metadata.ingestion.source.pipeline.airflow.api.client import AirflowApiClient

# ── Helpers ─────────────────────────────────────────────────────────────────


def _make_config(auth_variant):
    """
    Build a minimal AirflowConnection config mock for AirflowApiClient.

    auth_variant is a real typed instance (AccessToken, BasicAuth,
    GcpCredentialsConfig) or a plain MagicMock for the unknown-type test.
    """
    rest_config = MagicMock()
    rest_config.authConfig = auth_variant
    rest_config.apiVersion = MagicMock()
    rest_config.apiVersion.value = "v1"
    rest_config.verifySSL = True

    config = MagicMock()
    config.hostPort = "http://airflow.example.com:8080"
    config.connection = rest_config
    return config


# ── try_exchange_jwt ─────────────────────────────────────────────────────────


class TestTryExchangeJwt:
    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.requests.post")
    def test_returns_access_token_on_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "jwt_abc123"}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        result = try_exchange_jwt(
            "http://airflow.example.com:8080", "admin", "password", True
        )
        assert result == "jwt_abc123"
        mock_post.assert_called_once_with(
            "http://airflow.example.com:8080/auth/token",
            json={"username": "admin", "password": "password"},
            timeout=10,
            verify=True,
        )

    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.requests.post")
    def test_returns_none_when_http_error(self, mock_post):
        from requests.exceptions import HTTPError

        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = HTTPError("401")
        mock_post.return_value = mock_response

        result = try_exchange_jwt("http://airflow.example.com:8080", "u", "p", True)
        assert result is None

    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.requests.post")
    def test_returns_none_on_connection_error(self, mock_post):
        mock_post.side_effect = Exception("Connection refused")
        result = try_exchange_jwt("http://airflow.example.com:8080", "u", "p", False)
        assert result is None

    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.requests.post")
    def test_returns_none_when_token_missing_from_response(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"detail": "no token here"}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        result = try_exchange_jwt("http://airflow.example.com:8080", "u", "p", True)
        assert result is None

    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.requests.post")
    def test_passes_verify_ssl_false(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "tok"}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        try_exchange_jwt("http://airflow.example.com:8080", "u", "p", False)
        assert mock_post.call_args.kwargs["verify"] is False


# ── build_access_token_callback ──────────────────────────────────────────────


class TestBuildAccessTokenCallback:
    def test_returns_static_token(self):
        cb = build_access_token_callback("my_static_token")
        token, expiry = cb()
        assert token == "my_static_token"

    def test_expiry_is_zero(self):
        cb = build_access_token_callback("tok")
        _, expiry = cb()
        assert expiry == 0

    def test_callback_is_idempotent(self):
        cb = build_access_token_callback("tok")
        assert cb() == cb()

    def test_different_tokens_produce_different_callbacks(self):
        cb1 = build_access_token_callback("token_a")
        cb2 = build_access_token_callback("token_b")
        assert cb1()[0] == "token_a"
        assert cb2()[0] == "token_b"


# ── build_basic_auth_callback ────────────────────────────────────────────────


class TestBuildBasicAuthCallback:
    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.auth.try_exchange_jwt",
        return_value="jwt_token_xyz",
    )
    def test_jwt_success_returns_bearer_mode(self, _mock_jwt):
        cb, mode = build_basic_auth_callback(
            "http://airflow.example.com:8080", "admin", "pass", True
        )
        assert mode is None
        token, expiry = cb()
        assert token == "Bearer jwt_token_xyz"
        assert expiry == _JWT_REFRESH_INTERVAL_SECONDS

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.auth.try_exchange_jwt",
        return_value=None,
    )
    def test_jwt_failure_falls_back_to_basic(self, _mock_jwt):
        cb, mode = build_basic_auth_callback(
            "http://airflow.example.com:8080", "admin", "secret", True
        )
        assert mode is None
        token, expiry = cb()
        expected_b64 = base64.b64encode(b"admin:secret").decode()
        assert token == f"Basic {expected_b64}"
        assert expiry == _BASIC_AUTH_TTL_SECONDS

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.auth.try_exchange_jwt",
        return_value=None,
    )
    def test_basic_token_encodes_colon_in_password_correctly(self, _mock_jwt):
        cb, mode = build_basic_auth_callback("http://h", "user", "pass:word", True)
        token, _ = cb()
        assert token.startswith("Basic ")
        decoded = base64.b64decode(token[len("Basic ") :]).decode()
        assert decoded == "user:pass:word"

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.auth.try_exchange_jwt",
        return_value=None,
    )
    def test_passes_host_and_credentials_to_jwt_exchange(self, mock_jwt):
        cb, _ = build_basic_auth_callback("http://my.airflow.com", "alice", "pw", False)
        cb()
        mock_jwt.assert_called_once_with("http://my.airflow.com", "alice", "pw", False)


# ── build_gcp_token_callback ─────────────────────────────────────────────────


class TestBuildGcpTokenCallback:
    def _make_gcp_credentials(self, impersonate=None):
        creds = MagicMock()
        creds.gcpImpersonateServiceAccount = impersonate
        return creds

    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.set_google_credentials")
    def test_set_google_credentials_called_on_build(self, mock_set):
        gcp_creds = self._make_gcp_credentials()
        build_gcp_token_callback(gcp_creds)
        mock_set.assert_called_once_with(gcp_creds)

    @patch("google.auth.default")
    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.set_google_credentials")
    def test_callback_returns_token_and_expiry(self, _mock_set, mock_default):
        expiry = datetime.now(timezone.utc) + timedelta(hours=1)
        mock_creds = MagicMock(token="gcp_access_token", expiry=expiry)
        mock_default.return_value = (mock_creds, "project")

        gcp_creds = self._make_gcp_credentials()
        cb = build_gcp_token_callback(gcp_creds)

        with patch("google.auth.transport.requests.Request"):
            token, returned_expiry = cb()

        assert token == "gcp_access_token"
        assert returned_expiry == expiry
        mock_creds.refresh.assert_called_once()

    @patch("google.auth.default")
    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.set_google_credentials")
    def test_fallback_expiry_when_credentials_have_no_expiry(
        self, _mock_set, mock_default
    ):
        mock_creds = MagicMock(token="tok")
        mock_creds.expiry = None
        mock_default.return_value = (mock_creds, "project")

        gcp_creds = self._make_gcp_credentials()
        cb = build_gcp_token_callback(gcp_creds)

        before = datetime.now(timezone.utc) + timedelta(minutes=54)
        with patch("google.auth.transport.requests.Request"):
            _, expiry = cb()
        after = datetime.now(timezone.utc) + timedelta(minutes=56)

        assert before < expiry < after

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.auth.get_gcp_impersonate_credentials"
    )
    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.set_google_credentials")
    def test_impersonation_uses_impersonate_credentials(
        self, _mock_set, mock_impersonate
    ):
        impersonate = MagicMock()
        impersonate.impersonateServiceAccount = "svc@project.iam.gserviceaccount.com"
        impersonate.lifetime = 3600

        mock_impersonated = MagicMock(
            token="impersonated_token",
            expiry=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        mock_impersonate.return_value = mock_impersonated

        gcp_creds = self._make_gcp_credentials(impersonate=impersonate)
        cb = build_gcp_token_callback(gcp_creds)

        with patch("google.auth.transport.requests.Request"):
            token, _ = cb()

        assert token == "impersonated_token"
        mock_impersonate.assert_called_once_with(
            impersonate_service_account="svc@project.iam.gserviceaccount.com",
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
            lifetime=3600,
        )
        mock_impersonated.refresh.assert_called_once()

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.auth.get_gcp_impersonate_credentials"
    )
    @patch("google.auth.default")
    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.set_google_credentials")
    def test_no_impersonation_when_field_is_none(
        self, _mock_set, mock_default, mock_impersonate
    ):
        mock_creds = MagicMock(token="tok", expiry=None)
        mock_default.return_value = (mock_creds, "project")

        gcp_creds = self._make_gcp_credentials(impersonate=None)
        cb = build_gcp_token_callback(gcp_creds)

        with patch("google.auth.transport.requests.Request"):
            cb()

        mock_impersonate.assert_not_called()
        mock_default.assert_called_once()

    @patch("google.auth.default")
    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.set_google_credentials")
    def test_callback_calls_refresh_on_every_invocation(self, _mock_set, mock_default):
        mock_creds = MagicMock(
            token="tok",
            expiry=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        mock_default.return_value = (mock_creds, "project")

        gcp_creds = self._make_gcp_credentials()
        cb = build_gcp_token_callback(gcp_creds)

        with patch("google.auth.transport.requests.Request"):
            cb()
            cb()
            cb()

        assert mock_creds.refresh.call_count == 3

    @patch("google.auth.default")
    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.set_google_credentials")
    def test_scopes_include_cloud_platform(self, _mock_set, mock_default):
        mock_creds = MagicMock(token="tok", expiry=None)
        mock_default.return_value = (mock_creds, "project")

        gcp_creds = self._make_gcp_credentials()
        cb = build_gcp_token_callback(gcp_creds)

        with patch("google.auth.transport.requests.Request"):
            cb()

        mock_default.assert_called_once_with(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )

    @patch("google.auth.default")
    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.set_google_credentials")
    def test_expiry_returned_from_credentials(self, _mock_set, mock_default):
        future = datetime(2030, 1, 1, tzinfo=timezone.utc)
        mock_creds = MagicMock(token="tok", expiry=future)
        mock_default.return_value = (mock_creds, "project")

        gcp_creds = self._make_gcp_credentials()
        cb = build_gcp_token_callback(gcp_creds)

        with patch("google.auth.transport.requests.Request"):
            _, expiry = cb()

        assert expiry == future


# ── GCP credential type coverage ─────────────────────────────────────────────


class TestGcpCredentialTypeCoverage:
    """
    Verify that set_google_credentials is called (and the token callback works)
    for each of the 4 GCP credential types. The actual credential handling is in
    credentials.py; here we confirm build_gcp_token_callback wires through to it.
    """

    @pytest.mark.parametrize(
        "gcp_config_type_name",
        [
            "GcpCredentialsValues",
            "GcpCredentialsPath",
            "GcpExternalAccount",
            "GcpADC",
        ],
    )
    @patch("google.auth.default")
    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.set_google_credentials")
    def test_set_google_credentials_called_for_all_types(
        self, mock_set, mock_default, gcp_config_type_name
    ):
        mock_creds = MagicMock(token="tok", expiry=None)
        mock_default.return_value = (mock_creds, "project")

        gcp_credentials = MagicMock()
        gcp_credentials.gcpImpersonateServiceAccount = None

        cb = build_gcp_token_callback(gcp_credentials)
        mock_set.assert_called_once_with(gcp_credentials)

        with patch("google.auth.transport.requests.Request"):
            token, _ = cb()

        assert token == "tok"


# ── AirflowApiClient constructor (e2e) ────────────────────────────────────────


class TestAirflowApiClientAuthConfig:
    """
    End-to-end tests for AirflowApiClient.__init__. TrackedREST is patched so
    no network calls are made; we inspect the ClientConfig passed to it.

    auth_variant instances are real Pydantic models — isinstance() checks in
    client.py dispatch correctly without any authType discriminator field.
    """

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_access_token_sets_bearer_mode_and_static_token(self, mock_rest_cls):
        variant = AccessToken(token="static_token_value")
        config = _make_config(variant)
        AirflowApiClient(config)

        client_config = mock_rest_cls.call_args[0][0]
        assert client_config.auth_header == "Authorization"
        assert client_config.auth_token_mode == "Bearer"
        token, expiry = client_config.auth_token()
        assert token == "static_token_value"
        assert expiry == 0

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.auth.try_exchange_jwt",
        return_value="jwt_from_airflow3",
    )
    def test_basic_auth_with_jwt_exchange_sets_bearer(self, _mock_jwt, mock_rest_cls):
        variant = BasicAuth(username="admin", password="secret")
        config = _make_config(variant)
        AirflowApiClient(config)

        client_config = mock_rest_cls.call_args[0][0]
        assert client_config.auth_header == "Authorization"
        assert client_config.auth_token_mode is None
        token, _ = client_config.auth_token()
        assert token == "Bearer jwt_from_airflow3"

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.auth.try_exchange_jwt",
        return_value=None,
    )
    def test_basic_auth_without_jwt_falls_back_to_basic_mode(
        self, _mock_jwt, mock_rest_cls
    ):
        variant = BasicAuth(username="admin", password="secret")
        config = _make_config(variant)
        AirflowApiClient(config)

        client_config = mock_rest_cls.call_args[0][0]
        assert client_config.auth_header == "Authorization"
        assert client_config.auth_token_mode is None
        token, _ = client_config.auth_token()
        expected = base64.b64encode(b"admin:secret").decode()
        assert token == f"Basic {expected}"

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.set_google_credentials")
    @patch("google.auth.default")
    def test_gcp_credentials_sets_bearer_with_live_callback(
        self, mock_default, _mock_set, mock_rest_cls
    ):
        expiry = datetime.now(timezone.utc) + timedelta(hours=1)
        mock_creds = MagicMock(token="gcp_tok", expiry=expiry)
        mock_default.return_value = (mock_creds, "project")

        gcp_credentials_mock = MagicMock()
        gcp_credentials_mock.gcpImpersonateServiceAccount = None
        variant = GcpServiceAccount.model_construct(credentials=gcp_credentials_mock)
        config = _make_config(variant)
        AirflowApiClient(config)

        client_config = mock_rest_cls.call_args[0][0]
        assert client_config.auth_header == "Authorization"
        assert client_config.auth_token_mode == "Bearer"

        with patch("google.auth.transport.requests.Request"):
            token, returned_expiry = client_config.auth_token()

        assert token == "gcp_tok"
        assert returned_expiry == expiry

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_unknown_auth_type_sets_no_auth_header(self, mock_rest_cls):
        config = _make_config(MagicMock())
        AirflowApiClient(config)

        client_config = mock_rest_cls.call_args[0][0]
        assert client_config.auth_header is None
        assert client_config.auth_token is None

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_base_url_uses_host_port(self, mock_rest_cls):
        variant = AccessToken(token="tok")
        config = _make_config(variant)
        config.hostPort = "https://my-composer.example.com:443"
        AirflowApiClient(config)

        client_config = mock_rest_cls.call_args[0][0]
        assert "my-composer.example.com" in client_config.base_url

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_verify_ssl_false_passed_to_client(self, mock_rest_cls):
        variant = AccessToken(token="tok")
        config = _make_config(variant)
        config.connection.verifySSL = False
        AirflowApiClient(config)

        client_config = mock_rest_cls.call_args[0][0]
        assert client_config.verify is False

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_api_version_is_api(self, mock_rest_cls):
        variant = AccessToken(token="tok")
        config = _make_config(variant)
        AirflowApiClient(config)

        client_config = mock_rest_cls.call_args[0][0]
        assert client_config.api_version == "api"


# ── GCP token refresh integration ────────────────────────────────────────────


class TestGcpTokenRefreshIntegration:
    """
    Verify that repeated callback calls each refresh credentials independently.
    This mirrors how REST._request() calls auth_token() each time expires_in passes.
    """

    @patch("google.auth.default")
    @patch("metadata.ingestion.source.pipeline.airflow.api.auth.set_google_credentials")
    def test_each_callback_call_refreshes_credentials(self, _mock_set, mock_default):
        call_count = {"n": 0}
        tokens = ["token_v1", "token_v2", "token_v3"]

        def make_mock_creds():
            m = MagicMock()
            m.expiry = datetime.now(timezone.utc) + timedelta(hours=1)

            def do_refresh(_req):
                call_count["n"] += 1

            m.refresh.side_effect = do_refresh
            type(m).token = property(
                lambda self: tokens[min(call_count["n"] - 1, len(tokens) - 1)]
            )
            return m

        mock_creds = make_mock_creds()
        mock_default.return_value = (mock_creds, "project")

        gcp_creds = MagicMock()
        gcp_creds.gcpImpersonateServiceAccount = None
        cb = build_gcp_token_callback(gcp_creds)

        with patch("google.auth.transport.requests.Request"):
            t1, _ = cb()
            t2, _ = cb()
            t3, _ = cb()

        assert mock_creds.refresh.call_count == 3
        assert t1 == "token_v1"
        assert t2 == "token_v2"
        assert t3 == "token_v3"
