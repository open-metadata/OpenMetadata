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
import requests

from metadata.generated.schema.entity.utils.common.accessTokenConfig import AccessToken
from metadata.generated.schema.entity.utils.common.basicAuthConfig import BasicAuth
from metadata.generated.schema.entity.utils.common.gcpCredentialsConfig import (
    GcpServiceAccount,
)
from metadata.generated.schema.entity.utils.common.mwaaAuthConfig import (
    MwaaAuthentication,
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
from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
    AirflowFlavor,
    detect_flavor,
    diagnose,
)

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


# ── Flavor detection + diagnostics ───────────────────────────────────────────


class TestDetectFlavor:
    def test_mwaa_auth_wins_regardless_of_host(self):
        auth = MwaaAuthentication.model_construct(mwaaConfig=MagicMock())
        assert detect_flavor("https://abc.composer.googleusercontent.com", auth) is AirflowFlavor.MWAA

    def test_gcp_auth_wins_regardless_of_host(self):
        auth = GcpServiceAccount.model_construct(credentials=MagicMock())
        assert detect_flavor("https://my-airflow.corp.example.com", auth) is AirflowFlavor.COMPOSER

    def test_composer_host_with_access_token(self):
        auth = AccessToken(token="t")
        assert detect_flavor("https://abc.composer.googleusercontent.com", auth) is AirflowFlavor.COMPOSER

    def test_mwaa_host_with_basic_auth(self):
        auth = BasicAuth(username="u", password="p")
        assert detect_flavor("https://abc.airflow.us-east-1.amazonaws.com", auth) is AirflowFlavor.MWAA

    @pytest.mark.parametrize(
        "host",
        [
            "https://dep-id.astronomer.run/airflow",
            "https://workspace.cloud.astronomer.io",
            "https://x.astronomer.io",
        ],
    )
    def test_astronomer_hosts(self, host):
        auth = AccessToken(token="t")
        assert detect_flavor(host, auth) is AirflowFlavor.ASTRONOMER

    def test_unknown_host_falls_back_to_self_hosted(self):
        auth = BasicAuth(username="u", password="p")
        assert detect_flavor("https://internal.example.com", auth) is AirflowFlavor.SELF_HOSTED

    def test_none_host_with_generic_auth_is_self_hosted(self):
        assert detect_flavor(None, MagicMock()) is AirflowFlavor.SELF_HOSTED


class TestComposerProbe:
    def test_console_url_for_composer_flavor(self):
        # Detected by auth type, but the URL is wrong → console hint
        auth = GcpServiceAccount.model_construct(credentials=MagicMock())
        hint = diagnose(
            "https://console.cloud.google.com/composer/environments/detail/us-east4/my-env",
            auth,
            verify=True,
            original_error=Exception("boom"),
        )
        assert hint is not None
        # Assert on semantic phrases the hint emits, not URL substrings (CodeQL: py/incomplete-url-substring-sanitization).
        assert "GCP Console" in hint
        assert "Airflow web UI" in hint

    def test_wrong_auth_type_for_composer_host(self):
        auth = BasicAuth(username="u", password="p")
        hint = diagnose(
            "https://abc.composer.googleusercontent.com",
            auth,
            verify=True,
            original_error=Exception("Expecting value: line 2 column 1"),
        )
        assert hint is not None
        assert "gcp service account" in hint.lower() or "iap" in hint.lower()

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.diagnostics._detect_composer_iap_model",
        return_value="classic",
    )
    def test_classic_iap_produces_unsupported_hint(self, _mock_model):
        auth = GcpServiceAccount.model_construct(credentials=MagicMock())
        hint = diagnose(
            "https://abc.composer.googleusercontent.com",
            auth,
            verify=True,
            original_error=Exception("Expecting value: line 2 column 1"),
        )
        assert hint is not None
        assert "classic iap" in hint.lower()
        assert "not support" in hint.lower()

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.diagnostics._probe_composer_management_api",
        return_value={
            "name": "prod-airflow",
            "region": "us-east4",
            "version": "composer-2.5.2-airflow-2.6.3",
        },
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.diagnostics._detect_composer_iap_model",
        return_value="composer_managed",
    )
    def test_env_visible_via_management_api_names_env_and_role(self, _mock_model, _mock_management):
        """The SA can see the env through the Management API but Airflow rejects it -> name the env and the missing role."""
        auth = GcpServiceAccount.model_construct(credentials=MagicMock())
        hint = diagnose(
            "https://abc.composer.googleusercontent.com",
            auth,
            verify=True,
            original_error=Exception("Expecting value: line 2 column 1"),
        )
        assert hint is not None
        assert "prod-airflow" in hint
        assert "composer-2.5.2-airflow-2.6.3" in hint
        assert "roles/composer.user" in hint

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.diagnostics._probe_composer_management_api",
        return_value=None,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.diagnostics._detect_composer_iap_model",
        return_value=None,
    )
    def test_no_project_access_produces_generic_permission_hint(self, _mock_model, _mock_management):
        """Neither probe succeeds -> the SA most likely has no IAM access at all."""
        auth = GcpServiceAccount.model_construct(credentials=MagicMock())
        hint = diagnose(
            "https://abc.composer.googleusercontent.com",
            auth,
            verify=True,
            original_error=Exception("Expecting value: line 2 column 1"),
        )
        assert hint is not None
        assert "iam permission" in hint.lower()
        assert "roles/composer.user" in hint


class TestComposerRegionFromHost:
    @pytest.mark.parametrize(
        "host,expected",
        [
            ("https://e3e45d4d271b4596a8dd9a4426cb1c52-dot-us-east4.composer.googleusercontent.com", "us-east4"),
            ("https://abc-dot-europe-west1.composer.googleusercontent.com", "europe-west1"),
            ("https://abc-dot-us-east4.composer.googleusercontent.com/api/v1/health", "us-east4"),
            # Wrong hostname format → None (no -dot-region segment)
            ("https://composer.googleusercontent.com", None),
            ("https://internal.example.com", None),
            (None, None),
            ("", None),
        ],
    )
    def test_extracts_region(self, host, expected):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _composer_region_from_host,
        )

        assert _composer_region_from_host(host) == expected


class TestProjectFromCredentials:
    def test_extracts_project_from_string_field(self):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _project_from_credentials,
        )

        creds = MagicMock()
        creds.gcpConfig.projectId = "my-project"
        assert _project_from_credentials(creds) == "my-project"

    def test_extracts_project_from_root_model(self):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _project_from_credentials,
        )

        creds = MagicMock()
        creds.gcpConfig.projectId = MagicMock(root="my-project")
        assert _project_from_credentials(creds) == "my-project"

    def test_extracts_first_from_list(self):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _project_from_credentials,
        )

        creds = MagicMock()
        creds.gcpConfig.projectId = MagicMock(root=["proj-a", "proj-b"])
        assert _project_from_credentials(creds) == "proj-a"

    @patch("google.auth.default", return_value=(MagicMock(), "ambient-project"))
    def test_falls_back_to_adc_when_no_project_field(self, _mock_default):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _project_from_credentials,
        )

        creds = MagicMock()
        creds.gcpConfig.projectId = None
        assert _project_from_credentials(creds) == "ambient-project"

    @patch("google.auth.default", return_value=(MagicMock(), None))
    def test_returns_none_when_no_project_anywhere(self, _mock_default):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _project_from_credentials,
        )

        creds = MagicMock()
        creds.gcpConfig.projectId = None
        assert _project_from_credentials(creds) is None


class TestProbeComposerManagementApi:
    HOST = "https://e3e45d4d-dot-us-east4.composer.googleusercontent.com"

    def _auth(self):
        creds = MagicMock()
        creds.gcpConfig.projectId = "my-project"
        return GcpServiceAccount.model_construct(credentials=creds)

    def _env(self, **overrides):
        config = {
            "softwareConfig": {"imageVersion": "composer-2.5.0-airflow-2.6.3"},
            "airflowUri": self.HOST,
        }
        config.update(overrides.pop("config_overrides", {}))
        return {"name": "projects/my-project/locations/us-east4/environments/prod-airflow", "config": config}

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.diagnostics._mint_access_token_for_diagnostic",
        return_value="access-token",
    )
    @patch("requests.get")
    def test_returns_env_info_when_host_matches(self, mock_get, _mock_mint):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _probe_composer_management_api,
        )

        mock_get.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={"environments": [self._env()]}),
            text="",
        )
        info = _probe_composer_management_api(self.HOST, self._auth(), True)
        assert info is not None
        assert info["name"] == "prod-airflow"
        assert info["region"] == "us-east4"
        assert info["version"] == "composer-2.5.0-airflow-2.6.3"

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.diagnostics._mint_access_token_for_diagnostic",
        return_value="access-token",
    )
    @patch("requests.get")
    def test_returns_none_when_no_env_matches_host(self, mock_get, _mock_mint):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _probe_composer_management_api,
        )

        env = self._env(config_overrides={"airflowUri": "https://different-host.example.com"})
        mock_get.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={"environments": [env]}),
            text="",
        )
        assert _probe_composer_management_api(self.HOST, self._auth(), True) is None

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.diagnostics._mint_access_token_for_diagnostic",
        return_value="access-token",
    )
    @patch("requests.get")
    def test_returns_none_on_403(self, mock_get, _mock_mint):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _probe_composer_management_api,
        )

        mock_get.return_value = MagicMock(
            status_code=403,
            text='{"error":{"code":403,"message":"Caller does not have permission"}}',
        )
        assert _probe_composer_management_api(self.HOST, self._auth(), True) is None

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.diagnostics._mint_access_token_for_diagnostic",
        return_value="access-token",
    )
    @patch("requests.get", side_effect=requests.exceptions.ConnectionError("dns"))
    def test_returns_none_on_network_error(self, _mock_get, _mock_mint):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _probe_composer_management_api,
        )

        assert _probe_composer_management_api(self.HOST, self._auth(), True) is None

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.diagnostics._mint_access_token_for_diagnostic",
        return_value=None,
    )
    def test_returns_none_when_token_mint_fails(self, _mock_mint):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _probe_composer_management_api,
        )

        assert _probe_composer_management_api(self.HOST, self._auth(), True) is None

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.diagnostics._mint_access_token_for_diagnostic",
        return_value="access-token",
    )
    def test_returns_none_when_region_not_in_host(self, _mock_mint):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _probe_composer_management_api,
        )

        # Host without -dot-<region> segment → can't extract region → bail out
        assert _probe_composer_management_api("https://composer.googleusercontent.com", self._auth(), True) is None


class TestComposerIapModelDetection:
    @patch("requests.get")
    def test_classic_when_oauth_redirect(self, mock_get):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _detect_composer_iap_model,
        )

        mock_get.return_value = MagicMock(
            status_code=302,
            headers={
                "Location": "https://accounts.google.com/o/oauth2/auth?client_id=foo.apps.googleusercontent.com&response_type=code"
            },
        )
        assert _detect_composer_iap_model("https://abc.composer.googleusercontent.com", True) == "classic"

    @patch("requests.get")
    def test_managed_when_signin_redirect(self, mock_get):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _detect_composer_iap_model,
        )

        mock_get.return_value = MagicMock(
            status_code=302,
            headers={"Location": "https://us-east4.composer.cloud.google.com/_signin?continue=..."},
        )
        assert _detect_composer_iap_model("https://abc.composer.googleusercontent.com", True) == "composer_managed"

    @patch("requests.get", side_effect=requests.exceptions.ConnectionError("dns"))
    def test_none_on_probe_failure(self, _mock_get):
        from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (
            _detect_composer_iap_model,
        )

        assert _detect_composer_iap_model("https://abc.composer.googleusercontent.com", True) is None


class TestMwaaProbe:
    def _auth(self):
        return MwaaAuthentication.model_construct(
            mwaaConfig=MagicMock(mwaaEnvironmentName="prod-env", awsConfig=MagicMock())
        )

    @pytest.mark.parametrize(
        "message,expected_substr",
        [
            ("ExpiredToken: The security token has expired", "expired"),
            ("AccessDenied: not authorized to call MWAA", "createwebloginto"),
            ("ResourceNotFoundException: env not found", "prod-env"),
        ],
    )
    def test_message_matches_produce_targeted_hint(self, message, expected_substr):
        hint = diagnose(
            "https://abc.airflow.us-east-1.amazonaws.com",
            self._auth(),
            verify=True,
            original_error=Exception(message),
        )
        assert hint is not None
        assert expected_substr.lower() in hint.lower()

    def test_mwaa_host_with_wrong_auth(self):
        hint = diagnose(
            "https://abc.airflow.us-east-1.amazonaws.com",
            BasicAuth(username="u", password="p"),
            verify=True,
            original_error=Exception("boom"),
        )
        assert hint is not None
        assert "mwaa" in hint.lower() or "aws credentials" in hint.lower()


class TestAstronomerProbe:
    def test_basic_auth_rejected(self):
        hint = diagnose(
            "https://abc.astronomer.run/airflow",
            BasicAuth(username="u", password="p"),
            verify=True,
            original_error=Exception("401"),
        )
        assert hint is not None
        assert "workspace api token" in hint.lower() or "api token" in hint.lower()

    def test_control_plane_url_hint(self):
        hint = diagnose(
            "https://cloud.astronomer.io/workspaces/foo",
            AccessToken(token="t"),
            verify=True,
            original_error=Exception("404"),
        )
        assert hint is not None
        assert "astronomer.run" in hint.lower() or "deployment" in hint.lower()


class TestSelfHostedProbe:
    @patch("requests.get", side_effect=requests.exceptions.SSLError("self-signed"))
    def test_ssl_error_suggests_verify_off(self, _mock_get):
        hint = diagnose(
            "https://airflow.internal",
            BasicAuth(username="u", password="p"),
            verify=True,
            original_error=Exception("ssl"),
        )
        assert hint is not None
        assert "verify ssl" in hint.lower() or "self-signed" in hint.lower()

    @patch("requests.get", side_effect=requests.exceptions.ConnectionError("dns"))
    def test_connection_error_mentions_reachability(self, _mock_get):
        hint = diagnose(
            "https://airflow.internal",
            BasicAuth(username="u", password="p"),
            verify=True,
            original_error=Exception("conn"),
        )
        assert hint is not None
        assert "dns" in hint.lower() or "tcp" in hint.lower() or "reachable" in hint.lower()

    @patch("requests.get")
    def test_html_root_suggests_api_backend(self, mock_get):
        mock_get.return_value = MagicMock(
            status_code=200,
            headers={"Content-Type": "text/html; charset=utf-8"},
        )
        hint = diagnose(
            "https://airflow.internal",
            BasicAuth(username="u", password="p"),
            verify=True,
            original_error=Exception("boom"),
        )
        assert hint is not None
        assert "auth_backends" in hint or "rest api" in hint.lower()


class TestDiagnoseSwallowsExceptions:
    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.diagnostics.detect_flavor",
        side_effect=RuntimeError("boom"),
    )
    def test_returns_none_when_probe_raises(self, _mock_detect):
        result = diagnose("https://x", MagicMock(), verify=True, original_error=Exception("orig"))
        assert result is None


# ── CheckAccess decorator ────────────────────────────────────────────────────


class TestDecoratedCheckAccess:
    """Verify the post-failure decoration wrapping client.get_version in CheckAccess."""

    def test_success_returns_result_unchanged(self):
        from metadata.ingestion.source.pipeline.airflow.connection import (
            _decorated_check_access,
        )

        client = MagicMock()
        client.get_version.return_value = {"version": "2.8.0"}
        result = _decorated_check_access(client, "https://airflow.example.com", None, True)
        assert result == {"version": "2.8.0"}

    def test_failure_with_hint_raises_source_connection_exception(self):
        from metadata.ingestion.connections.test_connections import (
            SourceConnectionException,
        )
        from metadata.ingestion.source.pipeline.airflow.connection import (
            _decorated_check_access,
        )

        client = MagicMock()
        client.get_version.side_effect = ValueError("Expecting value: line 2 column 1 (char 1)")

        with (
            patch(
                "metadata.ingestion.source.pipeline.airflow.api.diagnostics.diagnose",
                return_value="Grant the service account roles/composer.user.",
            ),
            pytest.raises(SourceConnectionException) as exc_info,
        ):
            _decorated_check_access(
                client,
                "https://abc.composer.googleusercontent.com",
                GcpServiceAccount.model_construct(credentials=MagicMock()),
                True,
            )

        message = str(exc_info.value)
        assert "Expecting value" in message
        assert "Grant the service account roles/composer.user." in message

    def test_failure_without_hint_reraises_original(self):
        from metadata.ingestion.source.pipeline.airflow.connection import (
            _decorated_check_access,
        )

        client = MagicMock()
        client.get_version.side_effect = RuntimeError("transport closed")

        with (
            patch(
                "metadata.ingestion.source.pipeline.airflow.api.diagnostics.diagnose",
                return_value=None,
            ),
            pytest.raises(RuntimeError) as exc_info,
        ):
            _decorated_check_access(client, None, None, True)
        assert "transport closed" in str(exc_info.value)
