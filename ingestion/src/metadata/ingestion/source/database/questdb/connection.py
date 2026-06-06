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

from urllib.parse import quote_plus

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.questdbConnection import (
    QuestDBConnection as QuestDBConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.questdbConnection import (
    QuestDBScheme,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
    get_password_secret,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.questdb.queries import (
    QUESTDB_TEST_GET_TABLES,
    QUESTDB_TEST_GET_VIEWS,
)
from metadata.ingestion.source.database.questdb.utils import patch_questdb_dialect
from metadata.utils.constants import THREE_MIN

QUESTDB_DEFAULT_DATABASE = "qdb"


def get_connection_url(connection: QuestDBConnectionConfig) -> str:
    """
    QuestDB exposes a single database named ``qdb`` over the PostgreSQL wire
    protocol. psycopg2 requires a dbname on the URL, so we always target ``qdb``.
    """
    scheme = connection.scheme or QuestDBScheme.postgresql_psycopg2
    url = f"{scheme.value}://"
    if connection.username:
        url += quote_plus(connection.username)
        password = get_password_secret(connection).get_secret_value()
        if password:
            url += f":{quote_plus(password)}"
        url += "@"
    url += connection.hostPort
    url += f"/{QUESTDB_DEFAULT_DATABASE}"

    options = get_connection_options_dict(connection)
    if options:
        params = "&".join(f"{key}={quote_plus(value)}" for (key, value) in options.items() if value)
        url = f"{url}?{params}"
    return url


class QuestDBConnection(BaseConnection[QuestDBConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        """
        Return the SQLAlchemy Engine for QuestDB.
        """
        engine = create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )
        return patch_questdb_dialect(engine)

    def get_connection_dict(self) -> dict:
        """
        Return the connection dictionary for this service.
        """
        raise NotImplementedError("get_connection_dict is not implemented for QuestDB")

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
        return test_connection_db_common(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
            queries={
                "GetTables": QUESTDB_TEST_GET_TABLES,
                "GetViews": QUESTDB_TEST_GET_VIEWS,
            },
        )
