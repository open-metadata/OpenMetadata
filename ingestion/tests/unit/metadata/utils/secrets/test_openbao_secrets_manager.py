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


class _StubHandler(BaseHTTPRequestHandler):
    """Serves canned KV v2 responses so the real requests path is exercised."""

    def do_GET(self):
        SEEN_HEADERS.clear()
        SEEN_HEADERS.update(dict(self.headers))
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
    yield
    Singleton.clear_all()


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
