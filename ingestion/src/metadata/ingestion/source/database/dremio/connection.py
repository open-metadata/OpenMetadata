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

from urllib.parse import quote

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
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
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.dremio.client import DremioClient
from metadata.ingestion.source.database.dremio.queries import (
    CLOUD_JOBS,
    SOFTWARE_JOBS,
    TEST_GET_JOBS,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import SSLManager
from metadata.utils.ssl_registry import get_verify_ssl_fn

logger = ingestion_logger()

NAMESPACE_TYPES = ("SOURCE", "SPACE")
# ADR:2026-11-23-dremio-connector-reads-the-rest-api-not-arrow-flight
TEST_SQL_TIMEOUT_SECONDS = 30


class DremioConnection(BaseConnection[DremioConnectionConfig, DremioClient]):
    """Owns the client of the Dremio REST API"""

    def _get_client(self) -> DremioClient:
        client = DremioClient(self.service_connection, verify=self._resolve_verify())
        self._on_close(client.close)
        return client

    def _resolve_verify(self) -> bool | str:
        """
        `no-ssl` checks the certificate against the system authorities, `ignore`
        does not check it, `validate` checks it against the inline CA, written to
        a file that lives as long as the connection.
        ADR:2026-10-24-dremio-verify-ssl-chooses-how-the-certificate-is-checked-not-whether-tls-is-used
        """
        auth = self.service_connection.authType
        if not isinstance(auth, DremioSoftwareAuthentication):
            return True
        ssl_config = auth.sslConfig if auth.sslConfig and auth.sslConfig.root.caCertificate else None
        # Raises InvalidSSLVerificationException for `validate` without a CA, as the other REST connectors do
        verify = get_verify_ssl_fn(auth.verifySSL or VerifySSL.no_ssl)(ssl_config)
        if verify is False:
            logger.warning("The certificate of the Dremio server is not verified (Verify SSL is 'ignore')")
            return False
        if isinstance(verify, str) and ssl_config:
            ssl_manager = SSLManager(ca=ssl_config.root.caCertificate)
            self._on_close(ssl_manager.cleanup_temp_files)
            return ssl_manager.ca_file_path or True
        return True

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
    ) -> TestConnectionResult:
        """The steps come from the `dremio` test connection definition of the server"""
        client = self.client
        test_fn = {
            "CheckAccess": lambda: check_access(client),
            "GetDatabases": lambda: get_namespaces(client),
            "GetSchemas": lambda: get_schemas(client),
            "GetTables": lambda: get_tables(client),
            "GetQueries": lambda: get_queries(client),
        }
        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=self.service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )


def get_catalog(client: DremioClient) -> list[dict]:
    response = client.get("/catalog")
    response.raise_for_status()
    return response.json().get("data", [])


def get_namespaces(client: DremioClient) -> list[str]:
    """The top-level sources and spaces, which are the databases"""
    namespaces = [
        item["path"][0]
        for item in get_catalog(client)
        if item.get("containerType") in NAMESPACE_TYPES and item.get("path")
    ]
    if not namespaces:
        raise ConnectionError("No sources or spaces found in Dremio")
    return namespaces


def get_children(client: DremioClient, path: list[str]) -> list[dict]:
    response = client.get(f"/catalog/by-path/{'/'.join(quote(part, safe='') for part in path)}")
    response.raise_for_status()
    return response.json().get("children", [])


def check_access(client: DremioClient) -> None:
    get_catalog(client)


def get_schemas(client: DremioClient) -> None:
    get_children(client, [get_namespaces(client)[0]])


def get_tables(client: DremioClient) -> None:
    """Reads the first folder that holds datasets, or the root of a namespace that does"""
    for namespace in get_namespaces(client):
        children = get_children(client, [namespace])
        if any(child.get("type") == "DATASET" for child in children):
            return
        folder = next((child for child in children if child.get("containerType") == "FOLDER"), None)
        if folder:
            get_children(client, folder["path"])
            return


def get_queries(client: DremioClient) -> None:
    jobs = CLOUD_JOBS if client.is_cloud else SOFTWARE_JOBS
    client.execute_sql(TEST_GET_JOBS.format(jobs_table=jobs.name), timeout=TEST_SQL_TIMEOUT_SECONDS)
