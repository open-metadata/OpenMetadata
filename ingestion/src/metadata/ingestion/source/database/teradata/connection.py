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

import enum
from typing import Optional
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.teradataConnection import (
    TeradataConnection as TeradataConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.teradataConnection import (
    TeradataScheme,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.teradata.queries import TERADATA_GET_DATABASE
from metadata.utils.constants import THREE_MIN


class TeradataConnection(BaseConnection[TeradataConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        """
        Return the SQLAlchemy Engine for Teradata.
        """
        return create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=self.get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )

    @staticmethod
    def get_connection_url(connection: TeradataConnectionConfig) -> str:
        scheme = connection.scheme.value if connection.scheme else TeradataScheme.teradatasql.value
        url = f"{scheme}://{connection.hostPort}/"
        url += f"?user={quote_plus(connection.username)}"
        if connection.password:
            url += f"&password={quote_plus(connection.password.get_secret_value())}"

        # add standard options
        params = "&".join(
            [
                f"{key}={quote_plus(str(getattr(connection, key) if not isinstance(getattr(connection, key), enum.Enum) else getattr(connection, key).value))}"
                for key in ["account", "logdata", "logmech", "tmode"]
                if getattr(connection, key, None)
            ]
        )
        url = f"{url}&{params}"

        # add additional options if specified
        options = get_connection_options_dict(connection)
        if options:
            params = "&".join(
                f"{key}={quote_plus(str(value if not isinstance(value, enum.Enum) else value.value))}"
                for (key, value) in options.items()
                if value
            )
            url = f"{url}&{params}"
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
        queries = {"GetDatabases": TERADATA_GET_DATABASE}
        return test_connection_db_common(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            queries=queries,
            timeout_seconds=timeout_seconds,
        )
