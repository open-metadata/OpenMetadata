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
import ssl
from dataclasses import dataclass, field
from typing import Any

import nats
from metadata.clients.nats_client import (
    build_connect_options,
    build_tls_context,
    cleanup_temp_secrets,
    write_temp_secret,
)
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
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


class NatsApiError(ConnectionError):
    """Raised when the NATS JetStream API returns an error response."""


class SchemaKvBucketNotConfiguredError(ConnectionError):
    """Raised when the optional schema test has no configured KV bucket."""


def _write_temp_cert(secret_value: str, temp_files: list[str]) -> str:
    return write_temp_secret(secret_value, temp_files)


def _cleanup_temp_certs(temp_files: list[str]) -> None:
    cleanup_temp_secrets(temp_files)


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
    return build_tls_context(ssl_cfg, temp_files)


def _build_connect_opts(connection: NatsConnectionConfig, temp_cert_files: list[str]) -> dict:
    return build_connect_options(
        servers=connection.natsServers,
        auth=connection.authType,
        tls_config=connection.tlsConfig,
        additional_config=connection.additionalConfig,
        temp_files=temp_cert_files,
    )


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
    automation_workflow: AutomationWorkflow | None = None,
    timeout_seconds: int | None = THREE_MIN,
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
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
    ) -> TestConnectionResult:
        return test_connection(
            metadata,
            self.client,
            self.service_connection,
            automation_workflow,
            timeout_seconds,
        )
