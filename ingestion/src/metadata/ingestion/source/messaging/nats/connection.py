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
NATS source connection handler
"""

import asyncio
import json
import socket
import ssl
from collections import deque
from contextlib import suppress
from dataclasses import dataclass, field
from typing import Any

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection.check import CheckSkippedError, ChecksProvider, StepName, check
from metadata.core.connections.test_connection.classifier import ErrorPack, Matchers, when
from metadata.core.connections.test_connection.constants import STEP_TIMEOUT_SECONDS
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.core.connections.test_connection.records import Evidence
from metadata.core.connections.test_connection.runner import TestConnectionRunner
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.messaging.natsConnection import (
    BasicAuth,
    NatsType,
    NkeyAuth,
    TokenAuth,
)
from metadata.generated.schema.entity.services.connections.messaging.natsConnection import (
    NatsConnection as NatsConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    SkipReason,
    TestConnectionResult,
)
from metadata.generated.schema.security.ssl.validateSSLClientConfig import (
    ValidateSslClientConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger
from metadata.utils.secure_tempfile import (
    remove_secret_temp_file,
    write_secret_temp_file,
)
from nats.aio.client import DEFAULT_MAX_RECONNECT_ATTEMPTS
from nats.aio.client import Client as NatsSdkClient
from nats.errors import NoServersError

logger = ingestion_logger()

_JS_STREAM_LIST = "$JS.API.STREAM.LIST"
_RESERVED_CONNECT_OPTIONS = frozenset(
    {
        "servers",
        "user",
        "password",
        "token",
        "nkeys_seed",
        "nkeys_seed_str",
        "tls",
        "user_credentials",
        "signature_cb",
        "user_jwt_cb",
    }
)


class NatsApiError(ConnectionError):
    """Raised when the NATS JetStream API returns an error response."""


def _write_temp_cert(secret_value: str, temp_files: list[str]) -> str:
    """
    Materialise a certificate for the connection's lifetime.

    ``ssl.SSLContext.load_cert_chain`` only takes paths, and the context outlives
    this call, so the file is tracked in ``temp_files`` and removed by
    :func:`_cleanup_temp_certs` on teardown rather than by a ``with`` block.
    """
    path = str(write_secret_temp_file(secret_value, suffix=".pem"))
    temp_files.append(path)

    return path


def _cleanup_temp_certs(temp_files: list[str]) -> None:
    temp_files[:] = [path for path in temp_files if not remove_secret_temp_file(path)]


@dataclass
class NatsClient:
    nc: Any
    _loop: asyncio.AbstractEventLoop = field(repr=False)
    _temp_cert_files: list[str] = field(default_factory=list)

    def request(self, subject: str, payload: bytes = b"{}", timeout: float = 5.0) -> dict:
        async def _req() -> dict:
            msg = await self.nc.request(subject, payload, timeout=timeout)
            try:
                response = json.loads(msg.data.decode())
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise NatsApiError(f"NATS returned invalid JSON for subject '{subject}'") from exc
            if not isinstance(response, dict):
                raise NatsApiError(f"NATS returned an invalid response for subject '{subject}'")
            return response

        return self._loop.run_until_complete(_req())

    def close(self) -> None:
        async def _drain() -> None:
            await self.nc.drain()

        try:
            if not self._loop.is_closed():
                self._loop.run_until_complete(_drain())
        except Exception as exc:
            logger.warning("Error draining NATS connection: %s", exc)
        finally:
            if not self._loop.is_closed():
                self._loop.close()
            _cleanup_temp_certs(self._temp_cert_files)


def _build_tls_context(ssl_cfg: ValidateSslClientConfig, temp_files: list[str]) -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    if ssl_cfg.caCertificate:
        ctx.load_verify_locations(cadata=ssl_cfg.caCertificate.get_secret_value())
    if bool(ssl_cfg.sslCertificate) != bool(ssl_cfg.sslKey):
        raise ValueError("Both the TLS client certificate and key must be configured together")
    if ssl_cfg.sslCertificate and ssl_cfg.sslKey:
        cert_path = _write_temp_cert(ssl_cfg.sslCertificate.get_secret_value(), temp_files)
        key_path = _write_temp_cert(ssl_cfg.sslKey.get_secret_value(), temp_files)
        ctx.load_cert_chain(certfile=cert_path, keyfile=key_path)
    return ctx


def _build_connect_opts(connection: NatsConnectionConfig, temp_cert_files: list[str]) -> dict:
    opts = dict(connection.additionalConfig or {})
    reserved = _RESERVED_CONNECT_OPTIONS.intersection(opts)
    if reserved:
        raise ValueError(f"Additional NATS config contains reserved connection options: {', '.join(sorted(reserved))}")
    servers = [server.strip() for server in connection.natsServers.split(",")]
    if any(not server for server in servers):
        raise ValueError("NATS servers must be non-empty comma-separated URLs")
    opts["servers"] = servers

    if isinstance(connection.authType, BasicAuth):
        opts["user"] = connection.authType.username
        opts["password"] = connection.authType.password.get_secret_value()
    elif isinstance(connection.authType, TokenAuth):
        opts["token"] = connection.authType.token.get_secret_value()
    elif isinstance(connection.authType, NkeyAuth):
        opts["nkeys_seed_str"] = connection.authType.nkeySeed.get_secret_value()

    if connection.tlsConfig and connection.tlsConfig.root:
        opts["tls"] = _build_tls_context(connection.tlsConfig.root, temp_cert_files)

    return opts


def get_connection(connection: NatsConnectionConfig) -> NatsClient:
    loop = asyncio.new_event_loop()
    temp_cert_files: list[str] = []
    nc = NatsSdkClient()
    connect_task = None
    connection_errors: deque[Exception] = deque(maxlen=1)
    try:
        opts = _build_connect_opts(connection, temp_cert_files)
        reconnect_attempts = opts.get("max_reconnect_attempts", DEFAULT_MAX_RECONNECT_ATTEMPTS)
        error_cb = opts.get("error_cb")

        async def record_error(error: Exception) -> None:
            connection_errors.append(error)
            if error_cb:
                await error_cb(error)
            else:
                logger.error("NATS connection error: %s", error)

        # Bound initial retries separately from the established client's reconnect policy.
        opts["max_reconnect_attempts"] = 1
        opts["error_cb"] = record_error

        async def _connect() -> None:
            await nc.connect(**opts)
            nc.options["max_reconnect_attempts"] = reconnect_attempts

        connect_task = loop.create_task(_connect())
        loop.run_until_complete(connect_task)
    except Exception as exc:
        try:
            if connect_task is not None and not connect_task.done():
                connect_task.cancel()
                with suppress(asyncio.CancelledError):
                    loop.run_until_complete(connect_task)
            loop.run_until_complete(nc.close())
        except Exception as close_error:
            logger.warning("Error closing failed NATS connection: %s", close_error)
        finally:
            _cleanup_temp_certs(temp_cert_files)
            loop.close()
        if connection_errors and isinstance(exc, (NoServersError, TimeoutError)):
            last_error = connection_errors[-1]
            if isinstance(last_error, TimeoutError) and not str(last_error):
                raise TimeoutError("NATS connection timed out") from exc
            if last_error is not exc:
                raise last_error from exc
        raise
    return NatsClient(
        nc=nc,
        _loop=loop,
        _temp_cert_files=temp_cert_files,
    )


def _raise_for_api_error(response: dict, action: str) -> None:
    error = response.get("error")
    if not error:
        return
    description = error.get("description", error)
    raise NatsApiError(f"{action}: {description}")


def _get_streams(client: NatsClient) -> None:
    response = client.request(_JS_STREAM_LIST)
    _raise_for_api_error(response, "JetStream API error")


def _check_schema_kv_bucket(client: NatsClient, service_connection: NatsConnectionConfig) -> None:
    bucket = service_connection.schemaKvBucket
    if not bucket:
        raise CheckSkippedError(SkipReason.NotConfigured)
    response = client.request(f"$JS.API.STREAM.INFO.KV_{bucket}")
    _raise_for_api_error(response, f"Schema KV bucket '{bucket}' is unavailable")


class NatsStep(StepName):
    CheckAccess = "CheckAccess"
    GetTopics = "GetTopics"
    CheckSchemaKvBucket = "CheckSchemaKvBucket"


class NatsChecks:
    errors = ErrorPack(
        when(Matchers.contains("Authorization Violation")).diagnose(
            "NATS authentication failed", fix="Check the configured NATS credentials."
        ),
        when(Matchers.exception(ConnectionRefusedError)).diagnose(
            "Connection refused", fix="Check natsServers and that a NATS server is listening on the configured port."
        ),
        when(Matchers.exception(socket.gaierror)).diagnose(
            "Host could not be resolved", fix="Check natsServers and DNS resolution from the ingestion environment."
        ),
        when(Matchers.exception(TimeoutError)).diagnose(
            "Connection timed out", fix="Check natsServers and network access from the ingestion environment."
        ),
    ).including(NETWORK_ERRORS)

    def __init__(self, client: Borrowed[NatsClient], config: NatsConnectionConfig) -> None:
        self._client = client
        self._config = config

    @check(NatsStep.CheckAccess)
    def check_access(self) -> Evidence:
        if not self._client.client.nc.is_connected:
            raise ConnectionError("NATS connection is not established")
        return Evidence(summary="NATS connection established")

    @check(NatsStep.GetTopics)
    def get_topics(self) -> None:
        _get_streams(self._client.client)

    @check(NatsStep.CheckSchemaKvBucket)
    def check_schema_kv_bucket(self) -> None:
        if not self._config.schemaKvBucket:
            raise CheckSkippedError(SkipReason.NotConfigured)
        _check_schema_kv_bucket(self._client.client, self._config)


def test_connection(
    metadata: OpenMetadata,
    client: NatsClient,
    service_connection: NatsConnectionConfig,
    automation_workflow: AutomationWorkflow | None = None,
    timeout_seconds: int | None = STEP_TIMEOUT_SECONDS,
) -> TestConnectionResult:
    return TestConnectionRunner(
        NatsChecks(Borrowed.of(client), service_connection), NatsType.Nats.value, timeout_seconds
    ).run(metadata, automation_workflow)


class NatsConnection(BaseConnection[NatsConnectionConfig, NatsClient]):
    def _get_client(self) -> NatsClient:
        client = get_connection(self.service_connection)
        self._on_close(client.close)
        return client

    def checks(self) -> ChecksProvider:
        return NatsChecks(self.borrow(), self.service_connection)
