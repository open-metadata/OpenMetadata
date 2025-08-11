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
from typing import Callable, Dict, Optional
from urllib.parse import quote_plus

from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.sapHana.sapHanaHDBConnection import (
    SapHanaHDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.sapHana.sapHanaSQLConnection import (
    SapHanaSQLConnection,
)
from metadata.generated.schema.entity.services.connections.database.sapHanaConnection import (
    SapHanaConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
)
from metadata.ingestion.connections.test_connections import (
    execute_inspector_func,
    test_connection_engine_step,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


def get_database_connection_url(connection: SapHanaConnection) -> str:
    """
    Build the SQLConnection URL for the database connection
    """

    conn = connection.connection

    if not isinstance(conn, SapHanaSQLConnection):
        raise ValueError("Database Connection requires the SQL connection details")

    url = (
        f"{connection.scheme.value}://"
        f"{quote_plus(conn.username)}:"
        f"{quote_plus(conn.password.get_secret_value())}@"
        f"{conn.hostPort}"
    )

    if hasattr(connection, "database"):
        url += f"/{connection.database}" if connection.database else ""

    options = get_connection_options_dict(connection)
    if options:
        if hasattr(conn, "database") and not conn.database:
            url += "/"
        params = "&".join(
            f"{key}={quote_plus(value)}" for (key, value) in options.items() if value
        )
        url = f"{url}?{params}"
    return url


def get_hdb_connection_url(connection: SapHanaConnection) -> str:
    """
    Build the SQLConnection URL for the database connection
    """

    if not isinstance(connection.connection, SapHanaHDBConnection):
        raise ValueError("Database Connection requires the SQL connection details")

    return f"{connection.scheme.value}://userkey={connection.connection.userKey}"


def get_connection(connection: SapHanaConnection) -> Engine:
    """
    Create connection
    """

    if isinstance(connection.connection, SapHanaSQLConnection):
        return create_generic_db_connection(
            connection=connection,
            get_connection_url_fn=get_database_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )

    if isinstance(connection.connection, SapHanaHDBConnection):
        return create_generic_db_connection(
            connection=connection,
            get_connection_url_fn=get_hdb_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )

    raise ValueError("Unrecognized SAP Hana connection type!")


def _build_test_fn_dict(
    engine: Engine, service_connection: SapHanaConnection
) -> Dict[str, Callable]:
    """
    Build the test connection steps dict
    """

    def custom_executor(engine_: Engine, inspector_fn_str: str):
        """
        Check if we can list tables or views from a given schema
        or a random one
        """

        inspector = inspect(engine_)
        inspector_fn = getattr(inspector, inspector_fn_str)

        # HDB connection won't have a databaseSchema
        if getattr(service_connection.connection, "databaseSchema"):
            inspector_fn(service_connection.connection.databaseSchema)
        else:
            schema_name = inspector.get_schema_names() or []
            for schema in schema_name:
                inspector_fn(schema)
                break

    if isinstance(service_connection.connection, SapHanaSQLConnection):
        return {
            "CheckAccess": partial(test_connection_engine_step, engine),
            "GetSchemas": partial(execute_inspector_func, engine, "get_schema_names"),
            "GetTables": partial(custom_executor, engine, "get_table_names"),
            "GetViews": partial(custom_executor, engine, "get_view_names"),
        }

    if isinstance(service_connection.connection, SapHanaHDBConnection):
        return {
            "CheckAccess": partial(test_connection_engine_step, engine),
            "GetSchemas": partial(execute_inspector_func, engine, "get_schema_names"),
            "GetTables": partial(custom_executor, engine, "get_table_names"),
            "GetViews": partial(custom_executor, engine, "get_view_names"),
        }

    raise ValueError(f"Unknown connection type for {service_connection.connection}")


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: SapHanaConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    return test_connection_steps(
        metadata=metadata,
        test_fn=_build_test_fn_dict(engine, service_connection),
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
