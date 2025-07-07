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
from functools import partial
from typing import Optional
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.prestoConnection import (
    PrestoConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.test_connections import (
    execute_inspector_func,
    test_connection_engine_step,
    test_connection_steps,
    test_query,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.presto.queries import PRESTO_SHOW_CATALOGS
from metadata.utils.constants import THREE_MIN


def get_connection_url(connection: PrestoConnection) -> str:
    url = f"{connection.scheme.value}://"
    if connection.username:
        url += f"{quote_plus(connection.username)}"
        if connection.password:
            url += f":{quote_plus(connection.password.get_secret_value())}"
        url += "@"
    url += f"{connection.hostPort}"
    if connection.catalog:
        url += f"/{connection.catalog}"
    if connection.databaseSchema:
        url += f"?schema={quote_plus(connection.databaseSchema)}"
    return url


def get_connection(connection: PrestoConnection) -> Engine:
    """
    Create connection
    """
    connection.connectionArguments = (
        connection.connectionArguments or init_empty_connection_arguments()
    )
    if connection.protocol:
        connection.connectionArguments.root["protocol"] = connection.protocol
    if connection.verify:
        connection.connectionArguments = (
            connection.connectionArguments or init_empty_connection_arguments()
        )
        connection.connectionArguments.root["requests_kwargs"] = {
            "verify": connection.verify
        }

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: PrestoConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def custom_executor_for_table():
        inspector = inspect(engine)
        schema_name = inspector.get_schema_names()
        if schema_name:
            for schema in schema_name:
                table_name = inspector.get_table_names(schema)
                return table_name
        return None

    test_fn = {
        "CheckAccess": partial(test_connection_engine_step, engine),
        "GetDatabases": partial(
            test_query, engine=engine, statement=PRESTO_SHOW_CATALOGS
        ),
        "GetSchemas": partial(execute_inspector_func, engine, "get_schema_names"),
        "GetTables": custom_executor_for_table,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
