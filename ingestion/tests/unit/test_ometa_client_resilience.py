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
Transport-resilience behavior of the OMeta REST client, exercised against a
real localhost socket that fails-then-succeeds. Failure is injected at the
network boundary (not by mocking the session) so the genuine urllib3 Retry
path through KeepAliveRetryAdapter is what's under test.
"""

import contextlib
import json
import socket
import threading
import time

import pytest
from urllib3.util.retry import Retry

from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import REST, ClientConfig, RestTransportError
from metadata.ingestion.ometa.http_adapter import KeepAliveRetryAdapter

_HANG_SECONDS = 1.3  # > client read timeout below
_CLIENT_TIMEOUT = (2, 1)  # (connect, read) — read=1s keeps the hang test fast


class FlakyServer:
    """Localhost server applying a per-connection behavior: close | hang | ok."""

    def __init__(self, behaviors: list[str], tail: str = "ok") -> None:
        self._behaviors = list(behaviors)
        self._tail = tail
        self._lock = threading.Lock()
        self.attempts = 0
        self._stop = False
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind(("127.0.0.1", 0))
        self._sock.listen(16)
        self.port = self._sock.getsockname()[1]
        self._thread = threading.Thread(target=self._accept_loop, daemon=True)

    def __enter__(self) -> "FlakyServer":
        self._thread.start()
        return self

    def __exit__(self, *_exc: object) -> None:
        self._stop = True
        with contextlib.suppress(OSError):
            self._sock.close()

    def _next_behavior(self) -> str:
        with self._lock:
            self.attempts += 1
            return self._behaviors.pop(0) if self._behaviors else self._tail

    def _accept_loop(self) -> None:
        while not self._stop:
            try:
                conn, _ = self._sock.accept()
            except OSError:
                return
            threading.Thread(target=self._handle, args=(conn, self._next_behavior()), daemon=True).start()

    def _handle(self, conn: socket.socket, behavior: str) -> None:
        with conn:
            if behavior == "close":
                return
            conn.settimeout(2)
            with contextlib.suppress(OSError):
                conn.recv(65535)
            if behavior == "hang":
                time.sleep(_HANG_SECONDS)
                return
            body = json.dumps({"ok": True}).encode()
            conn.sendall(
                b"HTTP/1.1 200 OK\r\n"
                b"Content-Type: application/json\r\n"
                b"Content-Length: " + str(len(body)).encode() + b"\r\n"
                b"Connection: close\r\n\r\n" + body
            )


def _rest(port: int) -> REST:
    return REST(ClientConfig(base_url=f"http://127.0.0.1:{port}", timeout=_CLIENT_TIMEOUT))


def test_rest_and_tracked_rest_carry_keepalive_retry_adapter():
    rest = REST(ClientConfig(base_url="http://localhost:8585"))
    tracked = TrackedREST(ClientConfig(base_url="http://localhost:8585"))
    for client in (rest, tracked):
        adapter = client._session.get_adapter("https://localhost:8585")
        assert isinstance(adapter, KeepAliveRetryAdapter)
        assert isinstance(adapter.max_retries, Retry)


def test_read_timeout_is_retried_and_recovers():
    with FlakyServer(["hang", "ok"]) as srv:
        out = _rest(srv.port).get("/anything")
    assert out == {"ok": True}
    assert srv.attempts >= 2


def test_connection_abort_is_retried_and_recovers():
    with FlakyServer(["close", "ok"]) as srv:
        out = _rest(srv.port).get("/anything")
    assert out == {"ok": True}
    assert srv.attempts >= 2


def test_connection_failure_exhausts_to_transport_error():
    with FlakyServer([], tail="close") as srv, pytest.raises(RestTransportError):
        _rest(srv.port).get("/anything")
    assert srv.attempts >= 2
