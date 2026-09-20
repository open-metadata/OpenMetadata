#  Copyright 2026 Collate
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
Shared NATS connection helpers.

Used by the NATS messaging connector and by the OpenLineage pipeline connector, which
consumes OpenLineage events from a JetStream stream.
"""

import ssl
from typing import Any

from metadata.generated.schema.entity.services.connections.messaging.natsConnection import (
    BasicAuth,
    NkeyAuth,
    TokenAuth,
)
from metadata.generated.schema.security.ssl.validateSSLClientConfig import (
    ValidateSslClientConfig,
)
from metadata.utils.secure_tempfile import (
    remove_secret_temp_file,
    write_secret_temp_file,
)

# nats.connect() options that the connection config owns; a user-supplied override would
# silently replace the configured servers, credentials or TLS context
RESERVED_CONNECT_OPTIONS = frozenset(
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


def write_temp_secret(secret_value: str, temp_files: list[str], suffix: str = ".pem") -> str:
    """
    Materialise a secret for the connection's lifetime.

    ``ssl.SSLContext.load_cert_chain`` and nats-py's ``user_credentials`` only take paths,
    and both outlive a context manager, so the caller cleans the files up on close.
    """
    path = str(write_secret_temp_file(secret_value, suffix=suffix))
    temp_files.append(path)
    return path


def cleanup_temp_secrets(temp_files: list[str]) -> None:
    """Remove the materialised secrets, keeping track of any that could not be deleted."""
    temp_files[:] = [path for path in temp_files if not remove_secret_temp_file(path)]


def build_tls_context(ssl_cfg: ValidateSslClientConfig, temp_files: list[str]) -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    if ssl_cfg.caCertificate:
        ctx.load_verify_locations(cadata=ssl_cfg.caCertificate.get_secret_value())
    if bool(ssl_cfg.sslCertificate) != bool(ssl_cfg.sslKey):
        raise ValueError("Both the TLS client certificate and key must be configured together")
    if ssl_cfg.sslCertificate and ssl_cfg.sslKey:
        cert_path = write_temp_secret(ssl_cfg.sslCertificate.get_secret_value(), temp_files)
        key_path = write_temp_secret(ssl_cfg.sslKey.get_secret_value(), temp_files)
        ctx.load_cert_chain(certfile=cert_path, keyfile=key_path)
    return ctx


def build_connect_options(
    *,
    servers: str,
    auth: Any = None,
    tls_config: Any = None,
    additional_config: dict[str, Any] | None = None,
    temp_files: list[str],
) -> dict[str, Any]:
    """Map a connection config onto nats.connect() keyword arguments."""
    opts: dict[str, Any] = dict(additional_config or {})
    reserved = RESERVED_CONNECT_OPTIONS.intersection(opts)
    if reserved:
        raise ValueError(f"Additional NATS config contains reserved connection options: {', '.join(sorted(reserved))}")
    server_list = [server.strip() for server in servers.split(",")]
    if any(not server for server in server_list):
        raise ValueError("NATS servers must be non-empty comma-separated URLs")
    opts["servers"] = server_list

    match auth:
        case None:
            pass
        case BasicAuth():
            opts["user"] = auth.username
            opts["password"] = auth.password.get_secret_value()
        case TokenAuth():
            opts["token"] = auth.token.get_secret_value()
        case NkeyAuth():
            opts["nkeys_seed_str"] = auth.nkeySeed.get_secret_value()
        # The credentials variant is declared per connector, so match on its shape
        case _ if hasattr(auth, "credentials"):
            opts["user_credentials"] = write_temp_secret(
                auth.credentials.get_secret_value(), temp_files, suffix=".creds"
            )
        case _:
            raise ValueError(f"Unsupported NATS authentication type: {type(auth).__name__}")

    if tls_config and tls_config.root:
        opts["tls"] = build_tls_context(tls_config.root, temp_files)

    return opts
