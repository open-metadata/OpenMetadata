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
"""Wiring/config assertions for the resilient OMeta HTTP adapter."""

import socket

import requests
from urllib3.util.retry import Retry

from metadata.ingestion.ometa.http_adapter import (
    KeepAliveRetryAdapter,
    build_keepalive_socket_options,
    build_transport_retry,
    mount_resilient_adapter,
)


def test_keepalive_options_enable_so_keepalive():
    assert (socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1) in build_keepalive_socket_options()


def test_transport_retry_is_transport_only_and_idempotent_safe():
    retry = build_transport_retry()
    assert (retry.total, retry.connect, retry.read, retry.status) == (3, 2, 1, 0)
    assert retry.raise_on_status is False
    assert "POST" not in retry.allowed_methods
    assert "GET" in retry.allowed_methods


def test_mount_resilient_adapter_wires_keepalive_and_retry():
    session = requests.Session()
    mount_resilient_adapter(session)

    for scheme in ("https://", "http://"):
        adapter = session.get_adapter(f"{scheme}example.com")
        assert isinstance(adapter, KeepAliveRetryAdapter)
        assert isinstance(adapter.max_retries, Retry)
        assert adapter.max_retries.read == 1

    pooled = session.get_adapter("https://x").poolmanager.connection_pool_kw["socket_options"]
    assert (socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1) in pooled
