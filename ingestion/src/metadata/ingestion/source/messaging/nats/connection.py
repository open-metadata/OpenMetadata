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
import os
import ssl
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import nats
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.messaging.natsConnection import (
    BasicAuth,
    NkeyAuth,
    TokenAuth,
)
from metadata.generated.schema.entity.services.connections.messaging.natsConnection import (
    NatsConnection as NatsConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.generated.schema.security.ssl.validateSSLClientConfig import (
    ValidateSslClientConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

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


class SchemaKvBucketNotConfiguredError(ConnectionError):
    """Raised when the optional schema test has no configured KV bucket."""


def _write_temp_cert(secret_value: str, temp_files: list[str]) -> str:
    fd, path = tempfile.mkstemp(suffix=".pem")
    temp_files.append(path)
    try:
        try:
            payload = secret_value.encode()
            written = 0
            while written < len(payload):
                count = os.write(fd, payload[written:])
                if count == 0:
                    raise OSError("Could not write the temporary certificate")
                written += count
        finally:
            os.close(fd)
    except Exception:
        try:
            Path(path).unlink()
        except OSError as cleanup_exc:
            logger.warning(
                "Could not remove incomplete temporary NATS certificate %s: %s",
                path,
                cleanup_exc,
            )
        else:
            temp_files.remove(path)
        raise
    return path


def _cleanup_temp_certs(temp_files: list[str]) -> None:
    remaining = []
    for path in temp_files:
        try:
            Path(path).unlink(missing_ok=True)
        except OSError as exc:
            logger.warning("Could not remove temporary NATS certificate %s: %s", path, exc)
            remaining.append(path)
    temp_files[:] = remaining


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
    try:
        opts = _build_connect_opts(connection, temp_cert_files)

        async def _connect() -> Any:
            return await nats.connect(**opts)

        nc = loop.run_until_complete(_connect())
    except Exception:
        _cleanup_temp_certs(temp_cert_files)
        loop.close()
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
        raise SchemaKvBucketNotConfiguredError("Schema KV bucket is not configured")
    response = client.request(f"$JS.API.STREAM.INFO.KV_{bucket}")
    _raise_for_api_error(response, f"Schema KV bucket '{bucket}' is unavailable")


def test_connection(
    metadata: OpenMetadata,
    client: NatsClient,
    service_connection: NatsConnectionConfig,
    automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
    timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
) -> TestConnectionResult:
    def get_topics() -> None:
        _get_streams(client)

    def check_schema_kv_bucket() -> None:
        _check_schema_kv_bucket(client, service_connection)

    test_fn = {
        "GetTopics": get_topics,
        "CheckSchemaKvBucket": check_schema_kv_bucket,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )


class NatsConnection(BaseConnection[NatsConnectionConfig, NatsClient]):
    def _get_client(self) -> NatsClient:
        client = get_connection(self.service_connection)
        self._on_close(client.close)
        return client

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        return test_connection(
            metadata,
            self.client,
            self.service_connection,
            automation_workflow,
            timeout_seconds,
        )
