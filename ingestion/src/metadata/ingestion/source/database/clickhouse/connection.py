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

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection as ClickhouseConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
    init_empty_connection_arguments,
    init_empty_connection_options,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_SQL_STATEMENT_TEST,
)
from metadata.utils.constants import THREE_MIN

HTTPS_PROTOCOL = "https"


class ClickhouseConnection(BaseConnection[ClickhouseConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        """
        Return the SQLAlchemy Engine for Clickhouse.
        """
        connection = self.service_connection
        if connection.secure or connection.keyfile:
            arguments = connection.connectionArguments or init_empty_connection_arguments()
            connection.connectionArguments = arguments
            root = arguments.root if arguments.root is not None else {}
            arguments.root = root
            if connection.secure:
                root["secure"] = connection.secure
            if connection.keyfile:
                root["keyfile"] = connection.keyfile
        if connection.https:
            options = connection.connectionOptions or init_empty_connection_options()
            connection.connectionOptions = options
            option_root = options.root if options.root is not None else {}
            options.root = option_root
            option_root["protocol"] = HTTPS_PROTOCOL
        return create_generic_db_connection(
            connection=connection,
            get_connection_url_fn=get_connection_url_common,
            get_connection_args_fn=get_connection_args_common,
        )

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
        queries = {"GetQueries": CLICKHOUSE_SQL_STATEMENT_TEST}
        return test_connection_db_common(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            queries=queries,
            timeout_seconds=timeout_seconds,
        )
