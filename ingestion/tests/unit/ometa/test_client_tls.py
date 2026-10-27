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
"""Verify ingestion client TLS settings against a real HTTPS endpoint."""

import ssl
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

import pytest
import requests
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from requests.exceptions import SSLError
from urllib3.exceptions import InsecureRequestWarning

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import OpenMetadataConnection
from metadata.ingestion.ometa.client import RestTransportError
from metadata.ingestion.ometa.ometa_api import OpenMetadata


@pytest.fixture
def metadata_endpoint(tmp_path):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=1))
        .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost")]), critical=False)
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    cert_path = tmp_path / "server.pem"
    key_path = tmp_path / "server.key"
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    )
    paths = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            paths.append(self.path)
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert_path, key_path)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    worker = Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
    worker.start()
    try:
        yield f"https://localhost:{server.server_port}", cert_path.read_text(), paths
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)
        assert not worker.is_alive()


def _client(url, mode, ca=None):
    config = {
        "hostPort": url,
        "authProvider": "openmetadata",
        "securityConfig": {"jwtToken": "test-token"},
        "enableVersionValidation": False,
        "verifySSL": mode,
    }
    if ca is not None:
        config["sslConfig"] = {"caCertificate": ca}
    return OpenMetadata(
        OpenMetadataConnection.model_validate(config),
        additional_client_config_arguments={"retry": 0, "timeout": 3},
    )


@pytest.mark.parametrize("mode", ["no-ssl", "validate"])
def test_ingestion_rejects_untrusted_certificates(metadata_endpoint, mode):
    url, _, paths = metadata_endpoint
    client = _client(url, mode, requests.certs.where())
    try:
        with pytest.raises(RestTransportError) as failure:
            client.client.get("/ping")
        assert isinstance(failure.value.__cause__, SSLError)
        assert paths == []
    finally:
        client.close()


def test_ingestion_uses_configured_ca(metadata_endpoint, tmp_path):
    url, ca, paths = metadata_endpoint
    ca_path = tmp_path / "trusted-ca.pem"
    ca_path.write_text(ca)
    client = _client(url, "validate", str(ca_path))
    try:
        assert client.client.get("/ping") == {"status": "ok"}
        assert paths == ["/v1/ping"]
    finally:
        client.close()


def test_ingestion_rejects_trusted_certificate_for_wrong_hostname(metadata_endpoint, tmp_path):
    url, ca, paths = metadata_endpoint
    ca_path = tmp_path / "trusted-ca.pem"
    ca_path.write_text(ca)
    client = _client(url.replace("localhost", "127.0.0.1"), "validate", str(ca_path))
    try:
        with pytest.raises(RestTransportError) as failure:
            client.client.get("/ping")
        assert isinstance(failure.value.__cause__, SSLError)
        assert paths == []
    finally:
        client.close()


def test_ingestion_only_bypasses_validation_with_explicit_ignore(metadata_endpoint):
    url, _, paths = metadata_endpoint
    client = _client(url, "ignore")
    try:
        with pytest.warns(InsecureRequestWarning):
            assert client.client.get("/ping") == {"status": "ok"}
        assert paths == ["/v1/ping"]
    finally:
        client.close()
