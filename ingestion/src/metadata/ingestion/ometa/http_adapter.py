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
Resilient HTTP transport for the OpenMetadata REST client: TCP keepalive plus
one urllib3 Retry for transient transport failures.
"""

import socket
from typing import Any

import requests
from requests.adapters import DEFAULT_POOLBLOCK, HTTPAdapter
from urllib3.connection import HTTPConnection
from urllib3.poolmanager import PoolManager
from urllib3.util.retry import Retry

_KEEPALIVE_IDLE_SECONDS = 60
_KEEPALIVE_INTERVAL_SECONDS = 30
_KEEPALIVE_PROBE_COUNT = 5


def _socket_optname(name: str) -> int:
    """Resolve a platform-conditional socket constant (caller guards presence)."""
    return getattr(socket, name, -1)


def build_keepalive_socket_options() -> list[tuple[int, int, int | bytes]]:
    """TCP keepalive socket options, guarded for platform differences."""
    options = list(HTTPConnection.default_socket_options) + [(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)]

    if hasattr(socket, "TCP_KEEPIDLE"):
        options.append((socket.IPPROTO_TCP, _socket_optname("TCP_KEEPIDLE"), _KEEPALIVE_IDLE_SECONDS))
    elif hasattr(socket, "TCP_KEEPALIVE"):
        options.append((socket.IPPROTO_TCP, _socket_optname("TCP_KEEPALIVE"), _KEEPALIVE_IDLE_SECONDS))

    if hasattr(socket, "TCP_KEEPINTVL"):
        options.append((socket.IPPROTO_TCP, _socket_optname("TCP_KEEPINTVL"), _KEEPALIVE_INTERVAL_SECONDS))

    if hasattr(socket, "TCP_KEEPCNT"):
        options.append((socket.IPPROTO_TCP, _socket_optname("TCP_KEEPCNT"), _KEEPALIVE_PROBE_COUNT))

    return options


def build_transport_retry() -> Retry:
    """urllib3 Retry for transient transport failures, idempotent methods only."""
    return Retry(
        total=3,
        connect=2,
        read=1,
        status=0,
        backoff_factor=1,
        allowed_methods=Retry.DEFAULT_ALLOWED_METHODS,
        raise_on_status=False,
    )


_KEEPALIVE_SOCKET_OPTIONS: list[tuple[int, int, int | bytes]] = build_keepalive_socket_options()


class KeepAliveRetryAdapter(HTTPAdapter):
    """HTTPAdapter that enables TCP keepalive on every pooled connection."""

    def init_poolmanager(
        self, connections: int, maxsize: int, block: bool = DEFAULT_POOLBLOCK, **pool_kwargs: Any
    ) -> None:
        """Build the pool manager with keepalive socket options applied."""
        pool_kwargs["socket_options"] = _KEEPALIVE_SOCKET_OPTIONS
        self.poolmanager = PoolManager(num_pools=connections, maxsize=maxsize, block=block, **pool_kwargs)

    def proxy_manager_for(self, proxy: str, **proxy_kwargs: object) -> PoolManager:
        """Apply keepalive socket options to proxied connections too."""
        proxy_kwargs["socket_options"] = _KEEPALIVE_SOCKET_OPTIONS
        return super().proxy_manager_for(proxy, **proxy_kwargs)


def mount_resilient_adapter(session: requests.Session) -> None:
    """Mount the keepalive + transport-retry adapter for http and https."""
    adapter = KeepAliveRetryAdapter(max_retries=build_transport_retry())
    session.mount("https://", adapter)
    session.mount("http://", adapter)
