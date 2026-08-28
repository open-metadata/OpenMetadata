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

from typing import Any, Optional
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.impalaConnection import (
    ImpalaConnection as ImpalaConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    test_connection_db_schema_sources,
)
from metadata.ingestion.models.custom_pydantic import _CustomSecretStr
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


class ImpalaConnection(BaseConnection[ImpalaConnectionConfig, Engine]):
    @staticmethod
    def get_connection_url(connection: ImpalaConnectionConfig) -> str:
        """
        Build the URL handling auth requirements
        """
        url = f"{connection.scheme.value}://"  # pyright: ignore[reportOptionalMemberAccess]
        if connection.username and connection.authMechanism and connection.authMechanism.value in ("LDAP", "CUSTOM"):
            url += quote_plus(connection.username)
            if not connection.password:
                connection.password = _CustomSecretStr("")
            url += f":{quote_plus(connection.password.get_secret_value())}"  # pyright: ignore[reportOptionalMemberAccess]
            url += "@"

        elif connection.username:
            url += quote_plus(connection.username)
            if connection.password:
                url += f":{quote_plus(connection.password.get_secret_value())}"
            url += "@"

        url += connection.hostPort
        url += f"/{connection.databaseSchema}" if connection.databaseSchema else ""

        options = get_connection_options_dict(connection)
        if options:
            params = "&".join(f"{key}={quote_plus(value)}" for (key, value) in options.items() if value)
            url = f"{url}?{params}"
        if connection.authOptions:
            url = f"{url};{connection.authOptions}"
        return url

    def _get_client(self) -> Engine:
        connection = self.service_connection

        if connection.authMechanism:
            self._connection_arguments_root(connection)["auth_mechanism"] = connection.authMechanism.value

        if connection.kerberosServiceName:
            self._connection_arguments_root(connection)["kerberos_service_name"] = connection.kerberosServiceName

        if connection.useSSL:
            self._connection_arguments_root(connection)["use_ssl"] = connection.useSSL

        return create_generic_db_connection(
            connection=connection,
            get_connection_url_fn=self.get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )

    @staticmethod
    def _connection_arguments_root(connection: ImpalaConnectionConfig) -> dict[str, Any]:
        """Get-or-create the connectionArguments root dict for in-place key injection."""
        arguments = connection.connectionArguments or init_empty_connection_arguments()
        connection.connectionArguments = arguments
        if arguments.root is None:
            arguments.root = {}
        return arguments.root

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
        return test_connection_db_schema_sources(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
