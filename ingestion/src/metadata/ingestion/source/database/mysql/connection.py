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
from typing import Callable, Optional

from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
    TestConnectionDefinition,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
    init_empty_connection_options,
)
from metadata.ingestion.connections.test_connections import (
    TestConnectionResult,
    TestConnectionStep,
    test_connection_engine_step,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def get_connection(connection: MysqlConnection) -> Engine:
    """
    Create connection
    """
    if connection.sslCA or connection.sslCert or connection.sslKey:
        if not connection.connectionOptions:
            connection.connectionOptions = init_empty_connection_options()
        if connection.sslCA:
            connection.connectionOptions.__root__["ssl_ca"] = connection.sslCA
        if connection.sslCert:
            connection.connectionOptions.__root__["ssl_cert"] = connection.sslCert
        if connection.sslKey:
            connection.connectionOptions.__root__["ssl_key"] = connection.sslKey

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url_common,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: MysqlConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    inspector = inspect(engine)

    def custom_executor(inspector_fn: Callable):
        """
        Check if we can list tables or views from a given schema
        or a random one
        """
        if service_connection.databaseSchema:
            inspector.get_table_names(service_connection.databaseSchema)
        else:
            schema_name = inspector.get_schema_names() or []
            for schema in schema_name:
                if schema not in ("information_schema", "performance_schema"):
                    inspector_fn(schema)
        return None

    test_connection_definition: TestConnectionDefinition = metadata.get_by_name(
        entity=TestConnectionDefinition, fqn=service_connection.type.value
    )

    test_fn = {
        "CheckAccess": partial(test_connection_engine_step, engine),
        "GetSchemas": inspector.get_schema_names,
        "GetTables": partial(custom_executor, inspector.get_table_names),
        "GetViews": partial(custom_executor, inspector.get_view_names),
    }

    steps = [
        TestConnectionStep(
            name=step.name,
            description=step.description,
            mandatory=step.mandatory,
            function=test_fn[step.name],
        )
        for step in test_connection_definition.steps
    ]

    test_connection_steps(
        metadata=metadata,
        steps=steps,
        automation_workflow=automation_workflow,
    )
