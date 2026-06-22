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
"""Unit tests for the TCP reachability preflight and its diagnosis pack."""

import socket

import pytest

from metadata.core.connections.test_connection.network import (
    NETWORK_ERRORS,
    NetworkUnreachableError,
    tcp_probe,
)


@pytest.fixture()
def listening_port():
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    sock.listen(1)
    yield sock.getsockname()[1]
    sock.close()


@pytest.fixture()
def closed_port():
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


def test_tcp_probe_succeeds_against_a_listening_socket(listening_port):
    assert tcp_probe("127.0.0.1", listening_port) is None


def test_tcp_probe_raises_network_error_when_port_is_closed(closed_port):
    with pytest.raises(NetworkUnreachableError) as exc:
        tcp_probe("127.0.0.1", closed_port)
    assert f"127.0.0.1:{closed_port}" in str(exc.value)
    assert isinstance(exc.value.__cause__, ConnectionRefusedError)


def test_network_errors_classifies_connection_refused():
    error = NetworkUnreachableError("h:1 is not reachable")
    error.__cause__ = ConnectionRefusedError(61, "Connection refused")
    assert NETWORK_ERRORS.classify(error).title == "Connection refused"


def test_network_errors_classifies_dns_failure():
    error = NetworkUnreachableError("h:1 is not reachable")
    error.__cause__ = socket.gaierror(-2, "Name or service not known")
    assert NETWORK_ERRORS.classify(error).title == "Host could not be resolved"


def test_network_errors_classifies_timeout():
    error = NetworkUnreachableError("h:1 is not reachable")
    error.__cause__ = TimeoutError("timed out")
    assert NETWORK_ERRORS.classify(error).title == "Connection timed out"


def test_network_errors_falls_back_to_generic_unreachable():
    error = NetworkUnreachableError("h:1 is not reachable")
    error.__cause__ = OSError("No route to host")
    assert NETWORK_ERRORS.classify(error).title == "Cannot reach the host"
