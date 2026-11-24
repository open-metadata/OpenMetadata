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
"""Fixtures for the Druid connector integration tests.

The official Druid image runs one service per container -- the all-in-one quickstart
scripts it ships need Perl and Python, neither of which is in the image -- so the
smallest deployment that answers Druid SQL is ZooKeeper plus a broker. That is enough
for metadata extraction: INFORMATION_SCHEMA and the sys tables live on the broker and
need no coordinator, historical or middle manager.

The broker serves plaintext and TLS at the same time so one cluster covers every value
of DruidScheme, with druid+https talking to Druid's own Jetty TLS listener rather than
to a proxy standing in for it.
"""

import datetime
import ipaddress
import uuid
from dataclasses import dataclass
from pathlib import Path

import pytest
import requests
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID
from tenacity import retry, stop_after_delay, wait_fixed
from testcontainers.core.container import DockerContainer
from testcontainers.core.network import Network
from testcontainers.core.waiting_utils import wait_for_logs

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.druidConnection import (
    DruidConnection,
    DruidScheme,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)

DRUID_IMAGE = "apache/druid:30.0.0"
ZOOKEEPER_IMAGE = "zookeeper:3.9.5"
BROKER_PLAINTEXT_PORT = 8082
BROKER_TLS_PORT = 8282
KEYSTORE_ALIAS = "druid"
KEYSTORE_PASSWORD = "openmetadata"
# The broker boots a JVM and waits on ZooKeeper; a cold CI runner takes a few minutes.
BROKER_STARTUP_TIMEOUT = 420


@dataclass(frozen=True)
class TlsMaterial:
    """Two views of one self-signed identity: what Druid serves, what the client trusts."""

    keystore_dir: Path
    ca_certificate: Path


def _generate_tls_material(directory: Path) -> TlsMaterial:
    """Write a PKCS12 keystore for Druid's Jetty and the matching PEM for the client."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    now = datetime.datetime.now(datetime.timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=365))
        .add_extension(
            x509.SubjectAlternativeName(
                [
                    x509.DNSName("localhost"),
                    x509.DNSName("druid-broker"),
                    x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
                ]
            ),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )

    keystore = directory / "keystore.p12"
    keystore.write_bytes(
        pkcs12.serialize_key_and_certificates(
            name=KEYSTORE_ALIAS.encode(),
            key=key,
            cert=certificate,
            cas=None,
            encryption_algorithm=serialization.BestAvailableEncryption(KEYSTORE_PASSWORD.encode()),
        )
    )
    ca_certificate = directory / "ca.crt"
    ca_certificate.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))

    # The image runs as uid 1000, so the mounted keystore has to be world readable.
    keystore.chmod(0o644)
    directory.chmod(0o755)
    return TlsMaterial(keystore_dir=directory, ca_certificate=ca_certificate)


@retry(wait=wait_fixed(5), stop=stop_after_delay(BROKER_STARTUP_TIMEOUT), reraise=True)
def _wait_for_broker(url: str, verify) -> None:
    response = requests.get(url, timeout=(5, 10), verify=verify)
    response.raise_for_status()
    assert response.text.strip() == "true", f"{url} reported {response.text!r}"


@pytest.fixture(scope="module")
def druid_tls(tmp_path_factory) -> TlsMaterial:
    return _generate_tls_material(tmp_path_factory.mktemp("druid-tls"))


@pytest.fixture(scope="module")
def druid_network():
    with Network() as network:
        yield network


@pytest.fixture(scope="module")
def zookeeper_container(druid_network):
    container = (
        DockerContainer(ZOOKEEPER_IMAGE)
        .with_network(druid_network)
        .with_network_aliases("zookeeper")
        # The image defaults to a 1 GB heap; a single-node ensemble holding one
        # broker's announcements needs a fraction of that, and shard-3 is shared.
        .with_env("ZK_SERVER_HEAP", "256")
    )
    with container:
        wait_for_logs(container, "binding to port", timeout=180)
        yield container


@pytest.fixture(scope="module")
def druid_container(druid_network, zookeeper_container, druid_tls):
    """A Druid broker listening on plaintext 8082 and TLS 8282.

    /druid.sh turns every druid_* environment variable into a runtime property with
    underscores rewritten as dots, which is how the TLS listener is configured here.
    """
    container = (
        DockerContainer(DRUID_IMAGE)
        .with_network(druid_network)
        .with_network_aliases("druid-broker")
        .with_exposed_ports(BROKER_PLAINTEXT_PORT, BROKER_TLS_PORT)
        .with_volume_mapping(str(druid_tls.keystore_dir), "/tls", "ro")
        .with_command("broker")
        .with_env("DRUID_SINGLE_NODE_CONF", "nano-quickstart")
        .with_env("ZOOKEEPER", "zookeeper")
        .with_env("druid_enablePlaintextPort", "true")
        .with_env("druid_enableTlsPort", "true")
        .with_env("druid_tlsPort", str(BROKER_TLS_PORT))
        .with_env("druid_server_https_keyStorePath", "/tls/keystore.p12")
        .with_env("druid_server_https_keyStoreType", "PKCS12")
        .with_env("druid_server_https_certAlias", KEYSTORE_ALIAS)
        .with_env("druid_server_https_keyStorePassword", KEYSTORE_PASSWORD)
        # nano-quickstart sizes the broker for a real workload (512m heap, 400m direct)
        # and derives numThreads from the core count. This suite queries INFORMATION_SCHEMA
        # and sys, so one processing thread is plenty; direct memory only has to cover
        # buffer.sizeBytes (50MiB) * (numThreads + numMergeBuffers + 1).
        .with_env("druid_processing_numThreads", "1")
        .with_env("DRUID_XMS", "256m")
        .with_env("DRUID_XMX", "384m")
        .with_env("DRUID_MAXDIRECTMEMORYSIZE", "320m")
    )

    with container:
        _wait_for_broker(
            f"http://localhost:{container.get_exposed_port(BROKER_PLAINTEXT_PORT)}/status/health",
            verify=True,
        )
        _wait_for_broker(
            f"https://localhost:{container.get_exposed_port(BROKER_TLS_PORT)}/status/health",
            verify=str(druid_tls.ca_certificate),
        )
        yield container


@pytest.fixture(scope="module", params=list(DruidScheme), ids=lambda scheme: scheme.value)
def create_service_request(request, druid_container, druid_tls):
    """Run the whole module once per scheme the connection schema accepts.

    Parametrising over DruidScheme rather than a hardcoded list means a scheme added to
    the schema without a working dialect fails here instead of at a user's first ingestion.
    """
    scheme: DruidScheme = request.param
    if scheme.value.endswith("https"):
        host_port = f"localhost:{druid_container.get_exposed_port(BROKER_TLS_PORT)}"
        # pydruid forwards ssl_verify_cert to requests' verify, so pointing it at the CA
        # asserts the certificate is actually validated instead of waved through.
        connection_arguments = {"ssl_verify_cert": str(druid_tls.ca_certificate)}
    else:
        host_port = f"localhost:{druid_container.get_exposed_port(BROKER_PLAINTEXT_PORT)}"
        connection_arguments = None

    return CreateDatabaseServiceRequest(
        name=f"docker_test_druid_{scheme.name}_{uuid.uuid4().hex[:8]}",
        serviceType=DatabaseServiceType.Druid,
        connection=DatabaseConnection(
            config=DruidConnection(
                scheme=scheme,
                hostPort=host_port,
                connectionArguments=connection_arguments,
            )
        ),
    )
