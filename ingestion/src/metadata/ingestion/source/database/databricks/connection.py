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
from copy import deepcopy
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
from metadata.ingestion.source.database.databricks.auth import get_auth_config
from metadata.ingestion.source.database.databricks.queries import (
    DATABRICKS_GET_CATALOGS,
    DATABRICKS_SQL_STATEMENT_TEST,
    TEST_CATALOG_TAGS,
    TEST_COLUMN_LINEAGE,
    TEST_COLUMN_TAGS,
    TEST_SCHEMA_TAGS,
    TEST_TABLE_LINEAGE,
    TEST_TABLE_TAGS,
    TEST_VIEW_DEFINITIONS,
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
        self.first_catalog = None

    def get_schemas(self, schema_name: Optional[str] = None):
        """Get schemas and cache them"""
        if schema_name is not None:
            with self.engine.connect() as connection:
                connection.execute(f"USE CATALOG `{self.first_catalog}`")
            self.first_schema = schema_name
            return [schema_name]
        if self.schemas is None:
            self.schemas = self.inspector.get_schema_names(database=self.first_catalog)
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
            with self.engine.connect() as connection:
                tables = connection.execute(
                    f"SHOW TABLES IN `{self.first_catalog}`.`{self.first_schema}`"
                )
            return tables
        return []

    def get_views(self):
        """Get views using the cached first schema"""
        if self.first_schema is None:
            self.get_schemas()  # This will set first_schema
        if self.first_schema:
            with self.engine.connect() as connection:
                views = connection.execute(
                    f"SHOW VIEWS IN `{self.first_catalog}`.`{self.first_schema}`"
                )
            return views
        return []

    def get_catalogs(self, catalog_name: Optional[str] = None):
        """Get catalogs"""
        catalogs = []
        if catalog_name is not None:
            self.first_catalog = catalog_name
            return [catalog_name]
        with self.engine.connect() as connection:
            catalogs = connection.execute(DATABRICKS_GET_CATALOGS).fetchall()
            for catalog in catalogs:
                if catalog[0] != "__databricks_internal":
                    self.first_catalog = catalog[0]
                    break
        return catalogs


def get_connection_url(connection: DatabricksConnection) -> str:
    return f"{connection.scheme.value}://{connection.hostPort}"


def get_connection(connection: DatabricksConnection) -> Engine:
    """
    Create connection
    """

    if not connection.connectionArguments:
        connection.connectionArguments = init_empty_connection_arguments()

    if connection.httpPath:
        connection.connectionArguments.root["http_path"] = connection.httpPath

    auth_args = get_auth_config(connection)

    original_connection_arguments = connection.connectionArguments
    connection.connectionArguments = deepcopy(original_connection_arguments)
    connection.connectionArguments.root.update(auth_args)

    engine = create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )

    connection.connectionArguments = original_connection_arguments
    return engine


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

    # Helper function to get first catalog for tag queries
    def get_first_catalog():
        catalogs = engine_wrapper.get_catalogs(catalog_name=service_connection.catalog)
        return catalogs[0] if catalogs else service_connection.catalog or "main"

    test_fn = {
        "CheckAccess": partial(test_connection_engine_step, connection),
        "GetSchemas": partial(
            engine_wrapper.get_schemas, schema_name=service_connection.databaseSchema
        ),
        "GetTables": engine_wrapper.get_tables,
        "GetViews": engine_wrapper.get_views,
        "GetDatabases": partial(
            engine_wrapper.get_catalogs, catalog_name=service_connection.catalog
        ),
        "GetQueries": partial(
            test_database_query,
            engine=connection,
            statement=DATABRICKS_SQL_STATEMENT_TEST.format(
                query_history=service_connection.queryHistoryTable
            ),
        ),
        "GetViewDefinitions": partial(
            test_database_query,
            engine=connection,
            statement=TEST_VIEW_DEFINITIONS,
        ),
        "GetCatalogTags": partial(
            test_database_query,
            engine=connection,
            statement=TEST_CATALOG_TAGS.format(database_name=get_first_catalog()),
        ),
        "GetSchemaTags": partial(
            test_database_query,
            engine=connection,
            statement=TEST_SCHEMA_TAGS.format(database_name=get_first_catalog()),
        ),
        "GetTableTags": partial(
            test_database_query,
            engine=connection,
            statement=TEST_TABLE_TAGS.format(database_name=get_first_catalog()),
        ),
        "GetColumnTags": partial(
            test_database_query,
            engine=connection,
            statement=TEST_COLUMN_TAGS.format(database_name=get_first_catalog()),
        ),
        "GetTableLineage": partial(
            test_database_query,
            engine=connection,
            statement=TEST_TABLE_LINEAGE,
        ),
        "GetColumnLineage": partial(
            test_database_query,
            engine=connection,
            statement=TEST_COLUMN_LINEAGE,
        ),
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=service_connection.connectionTimeout or timeout_seconds,
    )
