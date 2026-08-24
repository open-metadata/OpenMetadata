#  Copyright 2026 Collate
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
Test the OpenBao secrets manager
"""

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from unittest.mock import patch

import pytest

from metadata.generated.schema.security.credentials.openBaoCredentials import (
    OpenBaoCredentials,
)
from metadata.generated.schema.security.secrets.secretsManagerClientLoader import (
    SecretsManagerClientLoader,
)
from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.utils.secrets.external_secrets_manager import SecretsManagerConfigException
from metadata.utils.secrets.openbao_secrets_manager import OpenBaoSecretsManager
from metadata.utils.secrets.secrets_manager_factory import SecretsManagerFactory
from metadata.utils.singleton import Singleton

ROUTES = {}
SEEN_HEADERS = {}
LOGIN_COUNT = []
GET_STATUSES = []


class _StubHandler(BaseHTTPRequestHandler):
    """Serves canned KV v2 responses so the real requests path is exercised."""

    def do_GET(self):
        SEEN_HEADERS.clear()
        SEEN_HEADERS.update(dict(self.headers))
        if GET_STATUSES:
            status, body = GET_STATUSES.pop(0)
        else:
            status, body = ROUTES.get(self.path, (404, {"errors": []}))
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        SEEN_HEADERS.clear()
        SEEN_HEADERS.update(dict(self.headers))
        LOGIN_COUNT.append(1)
        status, body = ROUTES.get(self.path, (404, {"errors": []}))
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        """Silence the default stderr request log."""


@pytest.fixture(name="address", scope="module")
def address_fixture():
    server = HTTPServer(("127.0.0.1", 0), _StubHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


@pytest.fixture(autouse=True)
def _clean_state():
    Singleton.clear_all()
    ROUTES.clear()
    SEEN_HEADERS.clear()
    LOGIN_COUNT.clear()
    GET_STATUSES.clear()
    yield
    Singleton.clear_all()


def build_approle_manager(address: str, namespace: str | None = None) -> OpenBaoSecretsManager:
    credentials = OpenBaoCredentials(
        address=address,
        mount="openmetadata",
        namespace=namespace,
        authMethod="approle",
        roleId="role",
        secretId="s3cret-id",
    )
    with patch.object(OpenBaoSecretsManager, "load_credentials", return_value=credentials):
        return OpenBaoSecretsManager(SecretsManagerClientLoader.env)


def build_manager(address: str, namespace: str | None = None) -> OpenBaoSecretsManager:
    credentials = OpenBaoCredentials(
        address=address,
        mount="openmetadata",
        namespace=namespace,
        authMethod="token",
        token="t0ken",
    )
    with patch.object(OpenBaoSecretsManager, "load_credentials", return_value=credentials):
        return OpenBaoSecretsManager(SecretsManagerClientLoader.env)


class TestOpenBaoSecretsManager:
    def test_reads_the_stored_value(self, address):
        ROUTES["/v1/openmetadata/data/svc/password"] = (
            200,
            {"data": {"data": {"value": "s3cret"}, "metadata": {"version": 1}}},
        )
        assert build_manager(address).get_string_value("/svc/password") == "s3cret"

    def test_missing_secret_raises_naming_the_path(self, address):
        """A connector must never receive a null credential in place of an error."""
        ROUTES["/v1/openmetadata/data/svc/absent"] = (404, {"errors": []})
        with pytest.raises(SecretsManagerConfigException) as error:
            build_manager(address).get_string_value("/svc/absent")
        assert "svc/absent" in str(error.value)

    def test_forbidden_raises_rather_than_returning_none(self, address):
        ROUTES["/v1/openmetadata/data/svc/denied"] = (403, {"errors": ["permission denied"]})
        with pytest.raises(SecretsManagerConfigException):
            build_manager(address).get_string_value("/svc/denied")

    def test_namespace_header_is_omitted_when_blank(self, address):
        ROUTES["/v1/openmetadata/data/svc/p"] = (200, {"data": {"data": {"value": "v"}}})
        build_manager(address).get_string_value("/svc/p")
        assert "X-Vault-Namespace" not in SEEN_HEADERS

    def test_namespace_header_is_sent_when_configured(self, address):
        ROUTES["/v1/openmetadata/data/svc/p"] = (200, {"data": {"data": {"value": "v"}}})
        build_manager(address, namespace="team-a").get_string_value("/svc/p")
        assert SEEN_HEADERS.get("X-Vault-Namespace") == "team-a"

    def test_noop_loader_fails_with_an_actionable_message(self):
        """
        The noop loader cannot supply an address. Returning None would surface much later as an
        AttributeError on `self.credentials`, far from the actual misconfiguration.
        """
        with pytest.raises(SecretsManagerConfigException) as error:
            OpenBaoSecretsManager(SecretsManagerClientLoader.noop)
        assert "noop" in str(error.value)

    @pytest.mark.parametrize(
        "provider",
        [SecretsManagerProvider.openbao, SecretsManagerProvider.managed_openbao],
    )
    def test_factory_dispatches_both_enum_values(self, address, provider):
        credentials = OpenBaoCredentials(address=address, mount="openmetadata", authMethod="token", token="t0ken")
        with patch.object(OpenBaoSecretsManager, "load_credentials", return_value=credentials):
            manager = SecretsManagerFactory(provider, SecretsManagerClientLoader.env).get_secrets_manager()
        assert isinstance(manager, OpenBaoSecretsManager)


class TestOpenBaoAppRole:
    """The documented production auth mode; previously uncovered because the stub only spoke GET."""

    def test_login_exchanges_role_and_secret_for_a_token(self, address):
        ROUTES["/v1/auth/approle/login"] = (200, {"auth": {"client_token": "tok-1", "lease_duration": 1200}})
        assert build_approle_manager(address).token == "tok-1"
        assert len(LOGIN_COUNT) == 1

    def test_login_sends_the_namespace_header(self, address):
        ROUTES["/v1/auth/approle/login"] = (200, {"auth": {"client_token": "tok-1"}})
        build_approle_manager(address, namespace="team-a")
        assert SEEN_HEADERS.get("X-Vault-Namespace") == "team-a"

    def test_login_failure_names_the_parameters_to_check(self, address):
        ROUTES["/v1/auth/approle/login"] = (400, {"errors": ["invalid role or secret id"]})
        with pytest.raises(SecretsManagerConfigException) as error:
            build_approle_manager(address)
        assert "roleId" in str(error.value)

    def test_expired_token_is_refreshed_once_and_the_read_retried(self, address):
        """
        AppRole tokens are short-lived (the shipped dev role uses token_ttl=20m). Without this
        retry a long ingestion run gets a 403, and CustomSecretStr.get_secret_value swallows the
        error - handing the connector the literal `secret:/...` reference as its password.
        """
        ROUTES["/v1/auth/approle/login"] = (200, {"auth": {"client_token": "tok-1"}})
        manager = build_approle_manager(address)
        assert len(LOGIN_COUNT) == 1

        GET_STATUSES.append((403, {"errors": ["permission denied"]}))
        GET_STATUSES.append((200, {"data": {"data": {"value": "recovered"}}}))
        assert manager.get_string_value("/svc/password") == "recovered"
        assert len(LOGIN_COUNT) == 2, "exactly one re-authentication, never a loop"

    def test_token_auth_does_not_retry(self, address):
        GET_STATUSES.append((403, {"errors": ["permission denied"]}))
        with pytest.raises(SecretsManagerConfigException):
            build_manager(address).get_string_value("/svc/password")
        assert not LOGIN_COUNT, "token auth has no login to repeat"

    def test_missing_secret_id_is_named_before_the_login_request(self, address):
        """Matches the Java client: name the parameter instead of a generic HTTP 400."""
        credentials = OpenBaoCredentials(address=address, mount="openmetadata", authMethod="approle", roleId="role")
        with (
            patch.object(OpenBaoSecretsManager, "load_credentials", return_value=credentials),
            pytest.raises(SecretsManagerConfigException) as error,
        ):
            OpenBaoSecretsManager(SecretsManagerClientLoader.env)
        assert "secretId" in str(error.value)
        assert not LOGIN_COUNT, "must fail before issuing the login request"

    def test_timeouts_come_from_the_credentials(self, address):
        credentials = OpenBaoCredentials(
            address=address,
            mount="openmetadata",
            authMethod="token",
            token="t0ken",
            connectTimeoutMs=1500,
            readTimeoutMs=2500,
        )
        with patch.object(OpenBaoSecretsManager, "load_credentials", return_value=credentials):
            manager = OpenBaoSecretsManager(SecretsManagerClientLoader.env)
        assert manager.timeout == (1.5, 2.5)
