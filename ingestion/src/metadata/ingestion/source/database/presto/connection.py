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
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
)
from metadata.ingestion.connections.test_connections import (
    TestConnectionResult,
    test_connection_engine_step,
    test_connection_steps,
    test_query,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.presto.queries import PRESTO_SHOW_CATALOGS


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
) -> TestConnectionResult:
    """
    Test connection
    """
    inspector = inspect(engine)

    def custom_executor_for_table():
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
        "GetSchemas": inspector.get_schema_names,
        "GetTables": custom_executor_for_table,
        "GetViews": inspector.get_view_names,
    }

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_fqn=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
