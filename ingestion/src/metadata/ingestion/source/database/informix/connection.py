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

from urllib.parse import quote_plus

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

# Imported for the side effect: the module body calls
# sqlalchemy.dialects.registry.register("informix", ...). Without this import
# nothing maps the "informix" URL scheme to our dialect and create_engine()
# raises NoSuchModuleError.
from metadata.ingestion.source.database.informix import dialect  # noqa: F401
from metadata.ingestion.source.database.informix.queries import (
    INFORMIX_TEST_GET_STORED_PROCEDURES,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# "verify-ca"/"verify-full" promise certificate verification. The driver reads a
# Java truststore (SSL_TRUSTSTORE), not the PEM this schema collects, so honouring
# them would take a PEM->JKS conversion we have not built. Refuse rather than
# silently downgrade to an unverified channel.
_SSL_VERIFY_MODES = {SslMode.verify_ca, SslMode.verify_full}
# The driver negotiates SSL or it does not; it has no opportunistic mode, so
# "allow" and "prefer" -- which both permit plaintext -- connect in plaintext.
_SSL_OPPORTUNISTIC_MODES = {SslMode.allow, SslMode.prefer}


def get_connection_url(connection: InformixConnectionConfig) -> str:
    """
    Build the SQLAlchemy URL our Informix dialect parses.

    Everything after '?' is handed to the dialect as url.query; it pops
    INFORMIXSERVER and re-emits the rest with Informix's ':'/';' property
    separators. See informix/dialect.py.
    """
    url = f"{(connection.scheme or InformixScheme.informix).value}://"
    if connection.username:
        url += quote_plus(connection.username)
        password = get_password_secret(connection)
        if password and password.get_secret_value():
            url += f":{quote_plus(password.get_secret_value())}"
        url += "@"
    url += connection.hostPort
    url += f"/{connection.database}"

    params = {"INFORMIXSERVER": connection.serverName}

    ssl_mode = connection.sslMode
    if ssl_mode in _SSL_VERIFY_MODES:
        raise NotImplementedError(
            f"Informix sslMode '{ssl_mode.value}' is not supported yet: the IBM Informix "
            "JDBC driver validates against a Java truststore rather than the PEM CA "
            "certificate this connection collects. Use 'require' for an encrypted "
            "connection without certificate verification, or 'disable' for plaintext."
        )
    if ssl_mode == SslMode.require:
        params["SSLCONNECTION"] = "true"
    elif ssl_mode in _SSL_OPPORTUNISTIC_MODES:
        logger.warning(
            "Informix sslMode '%s' connects in plaintext: the JDBC driver has no "
            "opportunistic SSL mode. Use 'require' to force an encrypted connection.",
            ssl_mode.value,
        )

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
            get_connection_args_fn=get_connection_args_common,
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
