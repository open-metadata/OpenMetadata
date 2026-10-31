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
Source connection handler
"""

from functools import partial
from urllib.parse import urlparse

from sqlalchemy import text
from sqlalchemy.engine import URL, Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.dremio.cloudAuth import (
    DremioCloudAuthentication,
    Region,
)
from metadata.generated.schema.entity.services.connections.database.dremio.softwareAuth import (
    DremioSoftwareAuthentication,
)
from metadata.generated.schema.entity.services.connections.database.dremioConnection import (
    DremioConnection as DremioConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL
from metadata.ingestion.connections.builders import create_generic_db_connection
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    test_connection_engine_step,
    test_connection_steps,
    test_query,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections_utils import kill_active_connections
from metadata.ingestion.source.database.dremio import dialect  # noqa: F401  registers dremio+flight
from metadata.ingestion.source.database.dremio.dialect import PROJECT_ID_PROPERTY
from metadata.ingestion.source.database.dremio.queries import (
    DREMIO_GET_DATABASES,
    DREMIO_JOBS_TABLES,
    DREMIO_TEST_GET_JOBS,
    DREMIO_TEST_GET_SCHEMAS,
    DREMIO_TEST_GET_TABLES,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import SSLManager

logger = ingestion_logger()

DREMIO_DIALECT = "dremio+flight"

# Dremio Software serves Arrow Flight on its own port, next to the REST API
# that `hostPort` points to. ADR:2026-10-24-dremio-software-flight-endpoint-is-the-host-of-the-rest-url-on-port-32010
SOFTWARE_FLIGHT_PORT = 32010

# Dremio Cloud serves Arrow Flight over TLS on the regional data endpoint.
CLOUD_FLIGHT_HOSTS = {
    Region.US: "data.dremio.cloud",
    Region.EU: "data.eu.dremio.cloud",
}
CLOUD_FLIGHT_PORT = 443


class DremioConnection(BaseConnection[DremioConnectionConfig, Engine]):
    """
    Owns the SQLAlchemy engine used to read Dremio through Arrow Flight.
    """

    def _write_ca_certificate(self) -> str | None:
        """
        Dremio Software only: write the CA certificate of the SSL config to a
        file, which the driver reads, and remove it when the connection closes.
        """
        auth = self.service_connection.authType
        if (
            isinstance(auth, DremioSoftwareAuthentication)
            and auth.verifySSL == VerifySSL.validate
            and auth.sslConfig
            and auth.sslConfig.root.caCertificate
        ):
            ssl_manager = SSLManager(ca=auth.sslConfig.root.caCertificate)
            self._on_close(ssl_manager.cleanup_temp_files)
            return ssl_manager.ca_file_path
        return None

    def _get_client(self) -> Engine:
        engine = create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=partial(get_connection_url, ca_file=self._write_ca_certificate()),
            # The Dremio connection has no `connectionArguments` to forward.
            get_connection_args_fn=lambda _: {},
        )
        self._on_close(engine.dispose)
        return engine

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
        engine = self.client

        # The steps come from the `dremio` test connection definition of the
        # server: every step it lists needs a function here.
        test_fn = {
            "CheckAccess": partial(test_connection_engine_step, engine),
            "GetDatabases": partial(test_query, engine=engine, statement=DREMIO_GET_DATABASES),
            "GetSchemas": partial(test_query, engine=engine, statement=DREMIO_TEST_GET_SCHEMAS),
            "GetTables": partial(test_query, engine=engine, statement=DREMIO_TEST_GET_TABLES),
            "GetQueries": partial(get_jobs_table, engine),
        }

        result = test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=self.service_connection.type.value,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )

        kill_active_connections(engine)

        return result


def get_jobs_table(engine: Engine) -> str:
    """
    Return the system table that holds the job history of this Dremio.

    The table depends on the edition (see DREMIO_JOBS_TABLES), so each candidate
    is probed in turn. Raises if none can be read, which is the case when the
    edition has no such table or when the user is not allowed to read it.
    """
    with engine.connect() as connection:
        for jobs_table in DREMIO_JOBS_TABLES:
            try:
                connection.execute(text(DREMIO_TEST_GET_JOBS.format(jobs_table=jobs_table))).fetchone()
            except Exception as exc:
                # sqlalchemy-dremio lets the raw pyarrow error through (e.g.
                # ArrowInvalid: Object 'project' not found within 'sys'), so any
                # failure means this candidate is not usable.
                logger.debug("Dremio job history is not readable from [%s]: %s", jobs_table, exc)
            else:
                return jobs_table

    raise RuntimeError(f"None of the Dremio job history tables can be read: {', '.join(DREMIO_JOBS_TABLES)}")


def get_tls_options(auth: DremioSoftwareAuthentication, ca_file: str | None) -> dict[str, str]:
    """
    The options of the driver for the certificate of a Dremio Software with TLS:
    - `no-ssl` (the default): checked against the authorities of the system,
    - `ignore`: not checked, for a self-signed certificate,
    - `validate`: checked against the CA certificate, which is read from `ca_file`.

    ADR:2026-10-24-dremio-verify-ssl-chooses-how-the-certificate-is-checked-not-whether-tls-is-used
    """
    if auth.verifySSL == VerifySSL.ignore:
        logger.warning("The certificate of the Dremio server is not verified (Verify SSL is 'ignore')")
        return {"DisableCertificateVerification": "True"}
    if auth.verifySSL == VerifySSL.validate:
        if ca_file:
            return {"TrustedCerts": ca_file}
        logger.warning(
            "Verify SSL is 'validate' without a CA certificate: the certificate is checked against the system"
        )
    return {}


def get_connection_url(connection: DremioConnectionConfig, ca_file: str | None = None) -> URL:
    """
    Build the SQLAlchemy URL for the `sqlalchemy-dremio` Arrow Flight dialect.

    Dremio Software authenticates with a username and a password. Dremio Cloud
    authenticates with a Personal Access Token, sent as the `Token` option.

    `ca_file` is the path of the CA certificate that a Dremio Software with TLS
    is checked against, see `get_tls_options`.
    """
    auth = connection.authType

    if isinstance(auth, DremioSoftwareAuthentication):
        # `hostPort` is the URL of the REST API (e.g. http://dremio:9047),
        # while the driver talks to the Arrow Flight port of the same host.
        rest_url = urlparse(str(auth.hostPort))
        use_tls = rest_url.scheme == "https"
        return URL.create(
            drivername=DREMIO_DIALECT,
            username=auth.username,
            password=auth.password.get_secret_value(),
            host=rest_url.hostname,
            port=SOFTWARE_FLIGHT_PORT,
            query={"UseEncryption": str(use_tls), **(get_tls_options(auth, ca_file) if use_tls else {})},
        )

    if isinstance(auth, DremioCloudAuthentication):
        return URL.create(
            drivername=DREMIO_DIALECT,
            host=CLOUD_FLIGHT_HOSTS[auth.region],
            port=CLOUD_FLIGHT_PORT,
            query={
                "UseEncryption": "True",
                "Token": auth.personalAccessToken.get_secret_value(),
                PROJECT_ID_PROPERTY: auth.projectId,
            },
        )

    raise ValueError(f"Unsupported Dremio authentication type: {type(auth).__name__}")
