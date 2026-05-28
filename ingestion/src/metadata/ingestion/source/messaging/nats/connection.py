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
import contextlib
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
    NatsConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.generated.schema.security.ssl.validateSSLClientConfig import (
    ValidateSslClientConfig,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

_JS_STREAM_NAMES = "$JS.API.STREAM.NAMES"


def _write_temp_cert(secret_value: str, temp_files: list[str]) -> str:
    fd, path = tempfile.mkstemp(suffix=".pem")
    try:
        os.write(fd, secret_value.encode())
    finally:
        os.close(fd)
    temp_files.append(path)
    return path


def _cleanup_temp_certs(temp_files: list[str]) -> None:
    for path in temp_files:
        with contextlib.suppress(OSError):
            Path(path).unlink()
    temp_files.clear()


@dataclass
class NatsClient:
    nc: Any
    is_jetstream_enabled: bool
    _loop: asyncio.AbstractEventLoop = field(repr=False)
    _temp_cert_files: list[str] = field(default_factory=list)

    def request(self, subject: str, payload: bytes = b"{}", timeout: float = 5.0) -> dict:
        async def _req() -> dict:
            msg = await self.nc.request(subject, payload, timeout=timeout)
            return json.loads(msg.data.decode())

        return self._loop.run_until_complete(_req())

    def close(self) -> None:
        async def _drain() -> None:
            await self.nc.drain()

        try:
            if not self._loop.is_closed():
                self._loop.run_until_complete(_drain())
        except Exception as exc:
            logger.debug(f"Error draining NATS connection: {exc}")
        finally:
            if not self._loop.is_closed():
                self._loop.close()
            _cleanup_temp_certs(self._temp_cert_files)


def _build_tls_context(ssl_cfg: ValidateSslClientConfig, temp_files: list[str]) -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    if ssl_cfg.caCertificate:
        ctx.load_verify_locations(cadata=ssl_cfg.caCertificate.get_secret_value())
    if ssl_cfg.sslCertificate and ssl_cfg.sslKey:
        cert_path = _write_temp_cert(ssl_cfg.sslCertificate.get_secret_value(), temp_files)
        key_path = _write_temp_cert(ssl_cfg.sslKey.get_secret_value(), temp_files)
        ctx.load_cert_chain(certfile=cert_path, keyfile=key_path)
    return ctx


def _build_connect_opts(connection: NatsConnection, temp_cert_files: list[str]) -> dict:
    servers = [s.strip() for s in connection.natsServers.split(",")]
    opts: dict = {"servers": servers}

    if connection.additionalConfig:
        opts.update(connection.additionalConfig)

    if connection.username and connection.password:
        opts["user"] = connection.username
        opts["password"] = connection.password.get_secret_value()
    elif connection.token:
        opts["token"] = connection.token.get_secret_value()

    if connection.nkeySeed:
        opts["nkeys_seed_str"] = connection.nkeySeed.get_secret_value()

    if connection.tlsConfig and connection.tlsConfig.root:
        opts["tls"] = _build_tls_context(connection.tlsConfig.root, temp_cert_files)

    return opts


def get_connection(connection: NatsConnection) -> NatsClient:
    loop = asyncio.new_event_loop()
    temp_cert_files: list[str] = []
    opts = _build_connect_opts(connection, temp_cert_files)

    async def _connect() -> Any:
        return await nats.connect(**opts)

    nc = loop.run_until_complete(_connect())
    return NatsClient(
        nc=nc,
        is_jetstream_enabled=bool(connection.jetStreamEnabled),
        _loop=loop,
        _temp_cert_files=temp_cert_files,
    )


def test_connection(
    metadata: OpenMetadata,
    client: NatsClient,
    service_connection: NatsConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
    timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
) -> TestConnectionResult:
    def get_streams() -> None:
        if not client.is_jetstream_enabled:
            raise ConnectionError(
                "JetStream is disabled. Enable JetStream on the NATS server "
                "and set jetStreamEnabled=true to ingest streams as topics."
            )
        resp = client.request(_JS_STREAM_NAMES)
        if "error" in resp:
            raise ConnectionError(f"JetStream API error: {resp['error'].get('description', resp['error'])}")

    def check_schema_kv_bucket() -> None:
        bucket = service_connection.schemaKvBucket
        if not bucket:
            raise ConnectionError("Schema KV bucket not configured. Provide schemaKvBucket to enable schema ingestion.")
        resp = client.request(f"$JS.API.STREAM.INFO.KV_{bucket}")
        if "error" in resp:
            raise ConnectionError(
                f"Schema KV bucket '{bucket}' not found: {resp['error'].get('description', resp['error'])}"
            )

    test_fn = {
        "GetTopics": get_streams,
        "CheckSchemaKvBucket": check_schema_kv_bucket,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
