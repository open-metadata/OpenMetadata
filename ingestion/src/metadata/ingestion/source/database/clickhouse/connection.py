#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
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
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.test_connections import (
    TestConnectionResult,
    TestConnectionStep,
    test_connection_db_common,
    test_connection_db_schema_sources,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_SQL_STATEMENT_TEST,
)


def get_connection(connection: ClickhouseConnection) -> Engine:
    """
    Create Clickhouse connection
    """
    if connection.secure or connection.keyfile:
        if connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        if connection.secure:
            connection.connectionArguments.__root__["secure"] = connection.secure
        if connection.keyfile:
            connection.connectionArguments.__root__["keyfile"] = connection.keyfile

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url_common,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: ClickhouseConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> TestConnectionResult:
    """
    Test Clickhouse connection
    """
    queries = {"GetQueries": CLICKHOUSE_SQL_STATEMENT_TEST}

    test_connection_db_common(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        queries=queries,
    )
