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

from typing import Optional
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.exasolConnection import (
    ExasolConnection as ExasolConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.exasolConnection import (
    ExasolScheme,
    Tls,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.exasol.queries import EXASOL_TEST_GET_QUERIES
from metadata.utils.constants import THREE_MIN

TLS_SETTINGS = {
    "validate-certificate": {},
    "ignore-certificate": {"SSLCertificate": "SSL_VERIFY_NONE"},
    "disable-tls": {"SSLCertificate": "SSL_VERIFY_NONE", "ENCRYPTION": "no"},
}


class ExasolConnection(BaseConnection[ExasolConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        """
        Return the SQLAlchemy Engine for Exasol.
        """
        return create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=self.get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )

    @staticmethod
    def get_connection_url(connection: ExasolConnectionConfig) -> str:
        scheme = connection.scheme.value if connection.scheme else ExasolScheme.exa_websocket.value
        url = f"{scheme}://"
        if connection.username:
            url += f"{quote_plus(connection.username)}"
            password = connection.password.get_secret_value() if connection.password else ""
            url += f":{quote_plus(password)}"
            url += "@"
        url += connection.hostPort

        tls = connection.tls.value if connection.tls else Tls.validate_certificate.value
        options = TLS_SETTINGS[tls]
        if options:
            params = "&".join(f"{key}={quote_plus(value)}" for (key, value) in options.items() if value)
            url = f"{url}?{params}"
        return url

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        queries = {
            "GetQueries": EXASOL_TEST_GET_QUERIES,
        }
        return test_connection_db_common(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            queries=queries,
            timeout_seconds=timeout_seconds,
        )
