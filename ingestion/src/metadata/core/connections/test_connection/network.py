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
TCP reachability preflight, and the network diagnosis pack folded in with
``ErrorPack.including``. Matches by exception type, so it stays driver-agnostic.
"""

from __future__ import annotations

import socket

from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.classifier import (
    ErrorPack,
    Matchers,
    when,
)
from metadata.core.connections.test_connection.constants import (
    NETWORK_PROBE_TIMEOUT_SECONDS,
)
from metadata.core.connections.test_connection.records import Evidence


class NetworkUnreachableError(OSError):
    """A TCP preflight to a host:port failed before the driver was contacted."""


def tcp_probe(host: str, port: int, timeout: float = NETWORK_PROBE_TIMEOUT_SECONDS) -> None:
    """Prove host:port is reachable, raising ``NetworkUnreachableError``.

    Chains the socket error so the classifier can match its type.
    """
    try:
        with socket.create_connection((host, port), timeout=timeout):
            pass
    except OSError as cause:
        raise NetworkUnreachableError(f"{host}:{port} is not reachable: {cause}") from cause


def probe_or_fail(host: str, port: int) -> None:
    """TCP-probe host:port, raising ``CheckError`` with the attempted command."""
    try:
        tcp_probe(host, port)
    except NetworkUnreachableError as error:
        raise CheckError(error, Evidence(command=f"TCP connect {host}:{port}")) from error


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
