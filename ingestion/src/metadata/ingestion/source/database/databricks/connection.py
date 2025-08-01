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

from sqlalchemy.engine import Engine
from sqlalchemy.exc import DatabaseError
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
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
    test_connection_engine_step,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.databricks.queries import (
    DATABRICKS_GET_CATALOGS,
    DATABRICKS_SQL_STATEMENT_TEST,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DatabricksEngineWrapper:
    """Wrapper to store engine and schemas to avoid multiple calls"""

    def __init__(self, engine: Engine):
        self.engine = engine
        self.inspector = inspect(engine)
        self.schemas = None
        self.first_schema = None

    def get_schemas(self):
        """Get schemas and cache them"""
        if self.schemas is None:
            self.schemas = self.inspector.get_schema_names()
            if self.schemas:
                # Find the first schema that's not a system schema
                for schema in self.schemas:
                    if schema.lower() not in (
                        "information_schema",
                        "performance_schema",
                        "sys",
                    ):
                        self.first_schema = schema
                        break
                # If no non-system schema found, use the first one
                if self.first_schema is None and self.schemas:
                    self.first_schema = self.schemas[0]
        return self.schemas

    def get_tables(self):
        """Get tables using the cached first schema"""
        if self.first_schema is None:
            self.get_schemas()  # This will set first_schema
        if self.first_schema:
            return self.inspector.get_table_names(self.first_schema)
        return []

    def get_views(self):
        """Get views using the cached first schema"""
        if self.first_schema is None:
            self.get_schemas()  # This will set first_schema
        if self.first_schema:
            return self.inspector.get_view_names(self.first_schema)
        return []


def get_connection_url(connection: DatabricksConnection) -> str:
    url = f"{connection.scheme.value}://token:{connection.token.get_secret_value()}@{connection.hostPort}"
    return url


def get_connection(connection: DatabricksConnection) -> Engine:
    """
    Create connection
    """

    if connection.httpPath:
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        connection.connectionArguments.root["http_path"] = connection.httpPath

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    connection: Engine,
    service_connection: DatabricksConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def test_database_query(engine: Engine, statement: str):
        """
        Method used to execute the given query and fetch a result
        to test if user has access to the tables specified
        in the sql statement
        """
        try:
            connection = engine.connect()
            connection.execute(statement).fetchone()
        except DatabaseError as soe:
            logger.debug(f"Failed to fetch catalogs due to: {soe}")

    # Create wrapper to avoid multiple schema calls
    engine_wrapper = DatabricksEngineWrapper(connection)

    test_fn = {
        "CheckAccess": partial(test_connection_engine_step, connection),
        "GetSchemas": engine_wrapper.get_schemas,
        "GetTables": engine_wrapper.get_tables,
        "GetViews": engine_wrapper.get_views,
        "GetDatabases": partial(
            test_database_query,
            engine=connection,
            statement=DATABRICKS_GET_CATALOGS,
        ),
        "GetQueries": partial(
            test_database_query,
            engine=connection,
            statement=DATABRICKS_SQL_STATEMENT_TEST.format(
                query_history=service_connection.queryHistoryTable
            ),
        ),
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=service_connection.connectionTimeout or timeout_seconds,
    )
