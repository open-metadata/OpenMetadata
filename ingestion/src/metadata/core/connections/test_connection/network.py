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
TCP reachability preflight for the test-connection engine.

Before a connector's gate check opens a real (driver, TLS, auth) connection, a
raw TCP connect to the resolved host:port separates a *network* failure - DNS, a
firewall, a wrong port - from an *auth/protocol* failure. ``NETWORK_ERRORS`` is
the diagnosis pack a connector folds into its own with ``ErrorPack.including``,
so a probe failure reads as an actionable network problem rather than a bare
socket error. The pack matches by exception *type*, so it is driver- and
platform-agnostic.
"""

from __future__ import annotations

import socket

from metadata.core.connections.test_connection.classifier import (
    ErrorPack,
    Matchers,
    when,
)
from metadata.core.connections.test_connection.constants import (
    NETWORK_PROBE_TIMEOUT_SECONDS,
)


class NetworkUnreachableError(OSError):
    """A TCP preflight to a host:port failed before the driver was contacted."""


def tcp_probe(host: str, port: int, timeout: float = NETWORK_PROBE_TIMEOUT_SECONDS) -> None:
    """Prove a host:port is reachable by opening and immediately closing a TCP connection.

    Raises ``NetworkUnreachableError`` - chaining the underlying socket error so
    the classifier can still match its type - when the connect fails or times out.
    """
    try:
        with socket.create_connection((host, port), timeout=timeout):
            pass
    except OSError as cause:
        raise NetworkUnreachableError(f"{host}:{port} is not reachable: {cause}") from cause


# Ordered specific-first. The catch-all matches our own ``NetworkUnreachableError``
# - which only ``tcp_probe`` raises - rather than a bare ``OSError``, so it can
# never misclassify an unrelated OS error (a dropped pipe, a permission error)
# from a later step as a reachability problem; those keep their raw errorLog.
NETWORK_ERRORS = ErrorPack(
    when(Matchers.exception(socket.gaierror)).diagnose(
        "Host could not be resolved",
        fix="Check hostPort for typos and that DNS can resolve it from where ingestion runs.",
    ),
    when(Matchers.exception(ConnectionRefusedError)).diagnose(
        "Connection refused",
        fix="The host answered but nothing is listening on that port; check the port in "
        "hostPort and that the service is running.",
    ),
    when(Matchers.exception(TimeoutError)).diagnose(
        "Connection timed out",
        fix="The host did not answer in time; check that a firewall, security group, or "
        "network ACL allows access to this host and port.",
    ),
    when(Matchers.exception(NetworkUnreachableError)).diagnose(
        "Cannot reach the host",
        fix="Check hostPort, the network route, and that the host is online and reachable from where ingestion runs.",
    ),
)
