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
from unittest.mock import MagicMock, patch

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


def test_tcp_probe_connects_once_to_the_first_resolved_address():
    # Connecting to only the first resolved address means one connect attempt at
    # the given timeout, so a multi-address host on a dead port cannot multiply
    # the wait. The first address (here IPv6) is the one dialed.
    v6 = (socket.AF_INET6, socket.SOCK_STREAM, 0, "", ("::1", 443, 0, 0))
    v4 = (socket.AF_INET, socket.SOCK_STREAM, 0, "", ("10.0.0.5", 443))
    sock = MagicMock()
    sock.__enter__.return_value = sock
    with (
        patch("socket.getaddrinfo", return_value=[v6, v4]) as resolve,
        patch("socket.socket", return_value=sock) as make_socket,
    ):
        tcp_probe("dual-stack.example.com", 443, timeout=20)

    resolve.assert_called_once_with("dual-stack.example.com", 443, socket.AF_UNSPEC, socket.SOCK_STREAM)
    make_socket.assert_called_once_with(socket.AF_INET6, socket.SOCK_STREAM, 0)
    sock.settimeout.assert_called_once_with(20)
    sock.connect.assert_called_once_with(("::1", 443, 0, 0))


def test_tcp_probe_supports_an_ipv6_only_host():
    # An IPv6-only host resolves to an AF_INET6 address; the probe must dial it
    # rather than read it as unreachable.
    v6 = (socket.AF_INET6, socket.SOCK_STREAM, 0, "", ("2001:db8::1", 443, 0, 0))
    sock = MagicMock()
    sock.__enter__.return_value = sock
    with (
        patch("socket.getaddrinfo", return_value=[v6]),
        patch("socket.socket", return_value=sock),
    ):
        assert tcp_probe("ipv6-only.example.com", 443) is None

    sock.connect.assert_called_once_with(("2001:db8::1", 443, 0, 0))


def test_tcp_probe_raises_when_the_name_cannot_be_resolved():
    with (
        patch("socket.getaddrinfo", side_effect=socket.gaierror(-2, "Name or service not known")),
        pytest.raises(NetworkUnreachableError) as exc,
    ):
        tcp_probe("nope.example.com", 443)
    assert isinstance(exc.value.__cause__, socket.gaierror)


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


def test_network_errors_ignores_unrelated_oserror_outside_the_preflight():
    # A later step (e.g. GetTables) failing with a generic OSError must not be
    # diagnosed as a reachability problem: only preflight failures qualify.
    assert NETWORK_ERRORS.classify(BrokenPipeError("broken pipe")) is None
    assert NETWORK_ERRORS.classify(PermissionError("denied")) is None
