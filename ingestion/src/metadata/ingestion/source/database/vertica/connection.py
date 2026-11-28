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
Source connection handler
"""

import ipaddress
import json
import math
from copy import deepcopy
from typing import Any

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.verticaConnection import (
    VerticaConnection as VerticaConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import get_connection_options_dict
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.secrets import connection_with_options_secrets
from metadata.ingestion.connections.strategies import BasicAuthStrategy
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_db_common,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.vertica.queries import (
    VERTICA_LIST_DATABASES,
    VERTICA_TEST_GET_QUERIES,
)
from metadata.utils.constants import THREE_MIN

DEFAULT_VERTICA_PORT = 5433
_MAX_PORT = 65535

# Typed options parsed by vertica_python.parse_dsn: passing raw URI strings into
# vertica_python.connect(**kw) raises TypeError on ssl/connection_timeout and
# turns non-empty "false" strings into truthy flags for connection_load_balance.
_VERTICA_BOOL_OPTIONS = frozenset(
    {
        "ssl",
        "connection_load_balance",
        "use_prepared_statements",
        "disable_copy_local",
        "binary_transfer",
        "request_complex_types",
        "autocommit",
    }
)
_VERTICA_FLOAT_OPTIONS = frozenset({"connection_timeout"})
_VERTICA_LOG_LEVEL_NAMES = frozenset(
    {
        "CRITICAL",
        "FATAL",
        "ERROR",
        "WARN",
        "WARNING",
        "INFO",
        "DEBUG",
        "NOTSET",
    }
)
_TRUE_STRINGS = frozenset({"true", "on", "1"})
_FALSE_STRINGS = frozenset({"false", "off", "0"})


def _parse_port(port_str: str) -> int:
    if not port_str or not port_str.isascii() or not port_str.isdigit():
        raise SourceConnectionException(
            "Vertica hostPort has a non-numeric port, so the table diff cannot connect. "
            f"Set 'Host and Port' to 'host:port', or to 'host' alone to use the default {DEFAULT_VERTICA_PORT}."
        )
    port = int(port_str)
    if port <= 0 or port > _MAX_PORT:
        raise SourceConnectionException(f"Vertica hostPort port must be between 1 and {_MAX_PORT}.")
    return port


def _parse_host_port(host_port: str | None) -> tuple[str, int]:
    """Parse Vertica hostPort into (host, port), raising SourceConnectionException on invalid input.

    Raises SourceConnectionException rather than ValueError because
    BaseTableParameter._get_service_connection_config catches ValueError and
    silently falls back to the rendered SQLAlchemy URL.
    """
    if not host_port or not host_port.strip():
        raise SourceConnectionException(
            "Vertica connection has no hostPort configured, so the table diff has nothing "
            "to connect to. Set 'Host and Port' on the service connection."
        )

    raw = host_port.strip()
    if raw.startswith("["):
        close_idx = raw.find("]")
        if close_idx == -1:
            raise SourceConnectionException(
                "Vertica hostPort has an unclosed IPv6 bracket. "
                f"Use '[host]:port' or '[host]' to default to port {DEFAULT_VERTICA_PORT}."
            )
        host = raw[1:close_idx]
        if not host or any(ch.isspace() for ch in host):
            raise SourceConnectionException(
                "Vertica hostPort has an empty or whitespace-containing host inside IPv6 brackets."
            )
        remainder = raw[close_idx + 1 :]
        if not remainder:
            return host, DEFAULT_VERTICA_PORT
        if not remainder.startswith(":"):
            raise SourceConnectionException(
                "Vertica hostPort has unexpected characters after the closing IPv6 bracket."
            )
        return host, _parse_port(remainder[1:])

    colon_count = raw.count(":")
    if colon_count == 0:
        if any(ch.isspace() for ch in raw):
            raise SourceConnectionException("Vertica hostPort hostname must not contain whitespace.")
        return raw, DEFAULT_VERTICA_PORT
    if colon_count > 1:
        raise SourceConnectionException(
            "Vertica hostPort has multiple colons. Wrap IPv6 addresses in brackets, "
            f"for example '[::1]:{DEFAULT_VERTICA_PORT}'."
        )

    host, _, port_str = raw.partition(":")
    if not host or any(ch.isspace() for ch in host):
        raise SourceConnectionException("Vertica hostPort has a missing or whitespace-containing hostname before ':'.")
    return host, _parse_port(port_str)


def _coerce_bool_option(key: str, value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in _TRUE_STRINGS:
            return True
        if normalized in _FALSE_STRINGS:
            return False
    raise SourceConnectionException(
        f"Invalid boolean value for Vertica connection option '{key}'. Expected one of true/false, on/off, or 1/0."
    )


def _coerce_float_option(key: str, value: Any) -> float:
    if isinstance(value, bool):
        raise SourceConnectionException(f"Invalid numeric value for Vertica connection option '{key}'.")
    if isinstance(value, (int, float)):
        parsed = float(value)
    elif isinstance(value, str):
        try:
            parsed = float(value.strip())
        except ValueError:
            raise SourceConnectionException(f"Invalid numeric value for Vertica connection option '{key}'.") from None
    else:
        raise SourceConnectionException(f"Invalid numeric value for Vertica connection option '{key}'.")
    if not math.isfinite(parsed) or parsed < 0:
        raise SourceConnectionException(
            f"Invalid numeric value for Vertica connection option '{key}': must be a finite non-negative number."
        )
    return parsed


def _coerce_log_level_option(value: Any) -> int | str:
    if isinstance(value, bool):
        raise SourceConnectionException("Invalid log_level value for Vertica connection option 'log_level'.")
    if isinstance(value, int):
        if value < 0:
            raise SourceConnectionException("Invalid log_level value for Vertica connection option 'log_level'.")
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.isascii() and stripped.isdigit():
            return int(stripped)
        upper = stripped.upper()
        if upper in _VERTICA_LOG_LEVEL_NAMES:
            return upper
    raise SourceConnectionException("Invalid log_level value for Vertica connection option 'log_level'.")


def _is_valid_bare_host(host: str) -> bool:
    if not host or any(ch.isspace() for ch in host):
        return False
    try:
        ipaddress.ip_address(host)
    except ValueError:
        return ":" not in host and "[" not in host and "]" not in host
    return True


def _coerce_backup_server_node(value: Any) -> list[str]:
    if not isinstance(value, (list, tuple)):
        raise SourceConnectionException(
            "Invalid Vertica connection option 'backup_server_node': must be a list of bare hostname strings."
        )
    nodes: list[str] = []
    for entry in value:
        if isinstance(entry, (list, tuple)):
            raise SourceConnectionException(
                "Invalid Vertica connection option 'backup_server_node': tableDiff JSON serialization only supports "
                "bare hostname strings (host/port pairs become lists after JSON round-trip and are rejected by "
                "vertica-python)."
            )
        if not isinstance(entry, str) or not _is_valid_bare_host(entry):
            raise SourceConnectionException(
                "Invalid Vertica connection option 'backup_server_node': each entry must be a non-empty bare "
                "hostname or IP address without a port."
            )
        nodes.append(entry)
    return nodes


def _coerce_vertica_option(key: str, value: Any) -> Any:
    if key in _VERTICA_BOOL_OPTIONS:
        return _coerce_bool_option(key, value)
    if key in _VERTICA_FLOAT_OPTIONS:
        return _coerce_float_option(key, value)
    if key == "log_level":
        return _coerce_log_level_option(value)
    if key == "backup_server_node":
        return _coerce_backup_server_node(value)
    return value


@connection_with_options_secrets
def _resolve_options_and_arguments(
    connection: VerticaConnectionConfig,
) -> tuple[dict[str, Any], dict[str, Any]]:
    options = dict(get_connection_options_dict(connection) or {})
    arguments = (
        dict(connection.connectionArguments.root)
        if connection.connectionArguments and connection.connectionArguments.root
        else {}
    )
    return options, arguments


class VerticaConnection(BaseConnection[VerticaConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        """
        Return the SQLAlchemy Engine for Vertica.
        """
        return BasicAuthStrategy(self.service_connection).build()

    def get_connection_dict(self) -> dict[str, Any]:
        """Return structured connection parameters for data-diff.

        Bypassing URI parsing keeps credentials verbatim, preserves native
        connectionArguments (TLS, backup_server_node, OAuth), and coerces
        string-typed connectionOptions to the native types vertica_python expects.
        """
        connection = deepcopy(self.service_connection)
        host, port = _parse_host_port(connection.hostPort)
        options, arguments = _resolve_options_and_arguments(connection)

        connection_dict: dict[str, Any] = {}
        for source in (options, arguments):
            for key, value in source.items():
                if value is not None:
                    connection_dict[key] = _coerce_vertica_option(key, value)
                elif key == "log_path":
                    # vertica-python treats log_path=None as "do not write vertica_python.log".
                    connection_dict[key] = None

        # Strip dsn and assign canonical fields last so options/arguments cannot spoof them.
        connection_dict.pop("dsn", None)
        connection_dict["driver"] = "vertica"
        connection_dict["host"] = host
        connection_dict["port"] = port
        if connection.username is not None:
            connection_dict["user"] = connection.username
        else:
            connection_dict.pop("user", None)
        if connection.password is not None:
            connection_dict["password"] = connection.password.get_secret_value()
        else:
            connection_dict.pop("password", None)
        if connection.database:
            connection_dict["database"] = connection.database
        else:
            connection_dict.pop("database", None)

        try:
            # data-diff hashes connection dicts via json.dumps in Connect.__make_cache_key.
            json.dumps(connection_dict, allow_nan=False)
        except (TypeError, ValueError):
            raise SourceConnectionException(
                "Vertica connection parameters for table diff must be JSON-serializable."
            ) from None

        return connection_dict

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        queries = {
            "GetQueries": VERTICA_TEST_GET_QUERIES,
            "GetDatabases": VERTICA_LIST_DATABASES,
        }
        return test_connection_db_common(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            queries=queries,
            timeout_seconds=timeout_seconds,
        )
