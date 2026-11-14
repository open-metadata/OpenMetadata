"""A small OpenMetadata REST client on the standard library — no venv, no `metadata` package.

One keep-alive connection per thread (a 2M-asset load is millions of requests, and a fresh TCP
connection per request would cost more than many of them), retries with backoff on overload,
and a re-login on 401 when running with credentials rather than a bot token.
"""

from __future__ import annotations

import base64
import http.client
import json
import random
import threading
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote, urlencode, urlsplit

RETRYABLE_STATUSES = frozenset({429, 500, 502, 503, 504})
MAX_ATTEMPTS = 6
BACKOFF_SECONDS = 0.5
MAX_BACKOFF_SECONDS = 20.0
TIMEOUT_SECONDS = 300


class ApiError(RuntimeError):
    def __init__(self, method: str, path: str, status: int, message: str) -> None:
        super().__init__(f"{method} {path} -> {status}: {message[:500]}")
        self.status = status


@dataclass(frozen=True)
class Credentials:
    token: str | None = None
    email: str | None = None
    password: str | None = None


def encode_fqn(fqn: str) -> str:
    """For an FQN in a URL path segment."""
    return quote(fqn, safe="")


class OpenMetadataClient:
    def __init__(self, server: str, credentials: Credentials) -> None:
        parts = urlsplit(server.rstrip("/"))
        if parts.scheme not in ("http", "https") or not parts.hostname:
            raise ValueError(f"--server must be an http(s) URL, got {server!r}")
        self.scheme = parts.scheme
        self.host = parts.hostname
        self.port = parts.port or (443 if parts.scheme == "https" else 80)
        base = parts.path.rstrip("/")
        self.api_root = base if base.endswith("/api") else f"{base}/api"
        self.ui_root = f"{parts.scheme}://{parts.netloc}{base.removesuffix('/api')}"
        self.credentials = credentials
        self._token = credentials.token
        self._token_lock = threading.Lock()
        self._local = threading.local()

    # ------------------------------------------------------------ public verbs

    def get(self, path: str, query: dict[str, Any] | None = None) -> Any:
        return self.request("GET", path, query=query)

    def put(self, path: str, body: Any, query: dict[str, Any] | None = None) -> Any:
        return self.request("PUT", path, body=body, query=query)

    def delete(self, path: str, query: dict[str, Any] | None = None) -> Any:
        return self.request("DELETE", path, query=query)

    def request(self, method: str, path: str, body: Any = None, query: dict[str, Any] | None = None) -> Any:
        target = self.api_root + path + (f"?{urlencode(query)}" if query else "")
        payload = None if body is None else json.dumps(body).encode()
        for attempt in range(1, MAX_ATTEMPTS + 1):
            token = self._token
            status, data = self._attempt(method, target, payload)
            if status < 400:
                return json.loads(data) if data else None
            if status == 401 and self._can_login():
                self._login(stale_token=token)
                continue
            if status not in RETRYABLE_STATUSES or attempt == MAX_ATTEMPTS:
                raise ApiError(method, path, status, data.decode(errors="replace"))
            _backoff(attempt)
        raise ApiError(method, path, 0, "retries exhausted")

    def ensure_authenticated(self) -> None:
        if self._token is None:
            if not self._can_login():
                raise ValueError("Pass --token, or --email and --password for basic auth")
            self._login(stale_token=None)

    # ------------------------------------------------------------ transport

    def _attempt(self, method: str, target: str, payload: bytes | None) -> tuple[int, bytes]:
        """One round trip. A dropped keep-alive connection is reopened and reported as a 503."""
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        connection = self._connection()
        try:
            connection.request(method, target, body=payload, headers=headers)
            response = connection.getresponse()
            return response.status, response.read()
        except (TimeoutError, http.client.HTTPException, ConnectionError, OSError) as error:
            connection.close()
            self._local.connection = None
            return 503, str(error).encode()

    def _connection(self) -> http.client.HTTPConnection:
        connection = getattr(self._local, "connection", None)
        if connection is None:
            factory = http.client.HTTPSConnection if self.scheme == "https" else http.client.HTTPConnection
            connection = factory(self.host, self.port, timeout=TIMEOUT_SECONDS)
            self._local.connection = connection
        return connection

    # ------------------------------------------------------------ auth

    def _can_login(self) -> bool:
        return bool(self.credentials.email and self.credentials.password)

    def _login(self, stale_token: str | None) -> None:
        """Logs in unless another thread already replaced `stale_token` while this one waited."""
        with self._token_lock:
            if self._token is not None and self._token != stale_token:
                return
            encoded = base64.b64encode(self.credentials.password.encode()).decode()
            body = json.dumps({"email": self.credentials.email, "password": encoded}).encode()
            self._token = None
            status, data = self._attempt("POST", self.api_root + "/v1/users/login", body)
            if status >= 400:
                raise ApiError("POST", "/v1/users/login", status, data.decode(errors="replace"))
            self._token = json.loads(data)["accessToken"]


def _backoff(attempt: int) -> None:
    delay = min(MAX_BACKOFF_SECONDS, BACKOFF_SECONDS * 2 ** (attempt - 1))
    time.sleep(delay * (0.5 + random.random()))
