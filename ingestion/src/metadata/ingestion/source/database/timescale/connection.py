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
Source connection handler for TimescaleDB
"""

from typing import Optional

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.common.azureConfig import (
    AzureConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.timescaleConnection import (
    TimescaleConnection as TimescaleConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.strategies import AzureAdStrategy, BasicAuthStrategy
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.postgres.queries import (
    POSTGRES_GET_DATABASE,
    POSTGRES_TEST_GET_QUERIES,
    POSTGRES_TEST_GET_TAGS,
)
from metadata.ingestion.source.database.postgres.utils import (
    get_postgres_time_column_name,
)
from metadata.utils.constants import THREE_MIN


class TimescaleConnection(BaseConnection[TimescaleConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        """
        Return the SQLAlchemy Engine for TimescaleDB.
        TimescaleDB is a PostgreSQL extension, so we use the same connection logic.
        """
        match self.service_connection.authType:
            case AzureConfigurationSource() as azure_auth:
                return AzureAdStrategy(self.service_connection, azure_auth).build()
            case _:
                return BasicAuthStrategy(self.service_connection).build()

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
            "GetQueries": POSTGRES_TEST_GET_QUERIES.format(
                time_column_name=get_postgres_time_column_name(engine=self.client),
                query_statement_source=self.service_connection.queryStatementSource or "pg_stat_statements",
            ),
            "GetDatabases": POSTGRES_GET_DATABASE,
            "GetTags": POSTGRES_TEST_GET_TAGS,
        }
        return test_connection_db_common(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
            queries=queries,
        )
