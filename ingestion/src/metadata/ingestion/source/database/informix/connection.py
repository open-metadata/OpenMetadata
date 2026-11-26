#  Copyright 2026 OpenMetadata
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

from urllib.parse import quote, quote_plus

from sqlalchemy import event
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.informixConnection import (
    InformixConnection as InformixConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.informixConnection import (
    InformixScheme,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
    get_password_secret,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata

# Importing the dialect also registers it: the module body calls
# sqlalchemy.dialects.registry.register("informix", ...), without which nothing
# maps the "informix" URL scheme and create_engine() raises NoSuchModuleError.
from metadata.ingestion.source.database.informix.dialect import (
    TRUSTSTORE_PASSWORD,
    build_truststore,
)
from metadata.ingestion.source.database.informix.queries import (
    INFORMIX_TEST_GET_STORED_PROCEDURES,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# The driver has one SSL switch and verifies the server against a Java truststore.
# How each sslMode maps onto it: ADR:2026-11-26-informix-overloads-keep-the-oldest-bare-name-and-ssl-modes-map-to-one-driver-switch
# Without a CA certificate it verifies against the JVM's default one.
_SSL_VERIFY_MODES = {SslMode.verify_ca, SslMode.verify_full}
# Encrypted without verifying the certificate. The driver has no opportunistic
# negotiation, so "allow" and "prefer" encrypt as well rather than fall back to
# plaintext.
_SSL_UNVERIFIED_MODES = {SslMode.require, SslMode.allow, SslMode.prefer}


def _ssl_params(connection: InformixConnectionConfig) -> dict[str, str]:
    """The driver's SSL properties for the configured sslMode.

    verify-full checks the certificate chain against the CA like verify-ca; the
    driver does not match the server's host name.
    """
    if connection.sslMode not in _SSL_VERIFY_MODES | _SSL_UNVERIFIED_MODES:
        return {}
    params = {"SSLCONNECTION": "true"}
    if connection.sslMode == SslMode.verify_full:
        logger.warning(
            "Informix sslMode 'verify-full' verifies the certificate chain like 'verify-ca': "
            "the JDBC driver does not match the server host name."
        )
    ca_certificate = connection.sslConfig.root.caCertificate if connection.sslConfig else None
    if connection.sslMode in _SSL_VERIFY_MODES and ca_certificate:
        params["SSL_TRUSTSTORE"] = build_truststore(ca_certificate.get_secret_value())
        params["SSL_TRUSTSTORE_PASSWORD"] = TRUSTSTORE_PASSWORD
    return params


def get_connection_args(connection: InformixConnectionConfig) -> dict:
    """Connection arguments, plus the dialect's flag for an unverified SSL session."""
    args = dict(get_connection_args_common(connection))
    if connection.sslMode in _SSL_UNVERIFIED_MODES:
        args["trust_server_certificate"] = True
    return args


def get_connection_url(connection: InformixConnectionConfig) -> str:
    """
    Build the SQLAlchemy URL our Informix dialect parses.

    Everything after '?' is handed to the dialect as url.query; it pops
    INFORMIXSERVER and re-emits the rest with Informix's ':'/';' property
    separators. See informix/dialect.py.
    """
    url = f"{(connection.scheme or InformixScheme.informix).value}://"
    if connection.username:
        # Not quote_plus: SQLAlchemy decodes credentials with unquote, so a space would reach the driver as '+'.
        url += quote(connection.username, safe="")
        password = get_password_secret(connection)
        if password and password.get_secret_value():
            url += f":{quote(password.get_secret_value(), safe='')}"
        url += "@"
    url += connection.hostPort
    url += f"/{connection.database}"

    params = {"INFORMIXSERVER": connection.serverName, **_ssl_params(connection)}
    params.update(get_connection_options_dict(connection) or {})
    url += "?" + "&".join(f"{key}={quote_plus(str(value))}" for key, value in params.items() if value)
    return url


def _use_committed_read(engine: Engine) -> None:
    """Stop read-only connections holding locks for their whole lifetime.

    We chose committed read instead of autocommit to prevent accidental writes
    """

    @event.listens_for(engine, "connect")
    def _(dbapi_connection, _):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("SET ISOLATION TO COMMITTED READ")
            cursor.close()
        except Exception as exc:
            logger.warning("Could not set Committed Read; reads may hold locks until the connection closes: %s", exc)


class InformixConnection(BaseConnection[InformixConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        """
        Return the SQLAlchemy Engine for Informix.
        """
        engine = create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=get_connection_url,
            get_connection_args_fn=get_connection_args,
        )
        _use_committed_read(engine)
        return engine

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow.

        CheckAccess, GetSchemas, GetTables and GetViews are covered by the common
        inspector steps; only GetStoredProcedures needs an Informix query. The
        five step names must match testConnections/database/informix.json.
        """
        return test_connection_db_common(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
            queries={
                "GetStoredProcedures": INFORMIX_TEST_GET_STORED_PROCEDURES,
            },
        )
