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
from typing import Any, Optional
from urllib.parse import quote_plus

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from pydantic import BaseModel, SecretStr
from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.test_connections import (
    test_connection_engine_step,
    test_connection_steps,
    test_query,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_GET_DATABASES,
    SNOWFLAKE_TEST_FETCH_TAG,
    SNOWFLAKE_TEST_GET_QUERIES,
    SNOWFLAKE_TEST_GET_TABLES,
    SNOWFLAKE_TEST_GET_VIEWS,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SnowflakeEngineWrapper(BaseModel):
    service_connection: SnowflakeConnection
    engine: Any
    database_name: Optional[str] = None


def get_connection_url(connection: SnowflakeConnection) -> str:
    """
    Set the connection URL
    """
    url = f"{connection.scheme.value}://"

    if connection.username:
        url += f"{quote_plus(connection.username)}"
        if not connection.password:
            connection.password = SecretStr("")
        url += (
            f":{quote_plus(connection.password.get_secret_value())}"
            if connection
            else ""
        )
        url += "@"

    url += connection.account
    url += f"/{connection.database}" if connection.database else ""

    options = get_connection_options_dict(connection)
    if options:
        if not connection.database:
            url += "/"
        params = "&".join(
            f"{key}={quote_plus(value)}" for (key, value) in options.items() if value
        )
        url = f"{url}?{params}"
    options = {
        "account": connection.account,
        "warehouse": connection.warehouse,
        "role": connection.role,
    }
    params = "&".join(f"{key}={value}" for (key, value) in options.items() if value)
    if params:
        url = f"{url}?{params}"
    return url


def get_connection(connection: SnowflakeConnection) -> Engine:
    """
    Create connection
    """
    if not connection.connectionArguments:
        connection.connectionArguments = init_empty_connection_arguments()

    if connection.privateKey:
        snowflake_private_key_passphrase = (
            connection.snowflakePrivatekeyPassphrase.get_secret_value()
            if connection.snowflakePrivatekeyPassphrase
            else ""
        )

        if not snowflake_private_key_passphrase:
            logger.warning(
                "Snowflake Private Key Passphrase not found, replacing it with empty string"
            )
        p_key = serialization.load_pem_private_key(
            bytes(connection.privateKey.get_secret_value(), "utf-8"),
            password=snowflake_private_key_passphrase.encode() or None,
            backend=default_backend(),
        )
        pkb = p_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

        connection.connectionArguments.root["private_key"] = pkb

    if connection.clientSessionKeepAlive:
        connection.connectionArguments.root[
            "client_session_keep_alive"
        ] = connection.clientSessionKeepAlive

    engine = create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )
    if connection.connectionArguments.root and connection.connectionArguments.root.get(
        "private_key"
    ):
        del connection.connectionArguments.root["private_key"]
    return engine


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: SnowflakeConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow.

    Note how we run a custom GetTables query:

        The default inspector `get_table_names` runs a SHOW which
        has a limit on 10000 rows in the result set:
        https://github.com/open-metadata/OpenMetadata/issues/12798

        This can cause errors if we are running tests against schemas
        with more tables than that. There is no issues during the metadata
        ingestion since in metadata.py we are overriding the default
        `get_table_names` function with our custom queries.
    """
    engine_wrapper = SnowflakeEngineWrapper(
        service_connection=service_connection, engine=engine, database_name=None
    )
    test_fn = {
        "CheckAccess": partial(test_connection_engine_step, engine),
        "GetDatabases": partial(
            test_query, statement=SNOWFLAKE_GET_DATABASES, engine=engine
        ),
        "GetSchemas": partial(
            execute_inspector_func, engine_wrapper, "get_schema_names"
        ),
        "GetTables": partial(
            test_table_query,
            statement=SNOWFLAKE_TEST_GET_TABLES,
            engine_wrapper=engine_wrapper,
        ),
        "GetViews": partial(
            test_table_query,
            statement=SNOWFLAKE_TEST_GET_VIEWS,
            engine_wrapper=engine_wrapper,
        ),
        "GetQueries": partial(
            test_query,
            statement=SNOWFLAKE_TEST_GET_QUERIES.format(
                account_usage=service_connection.accountUsageSchema
            ),
            engine=engine,
        ),
        "GetTags": partial(
            test_query,
            statement=SNOWFLAKE_TEST_FETCH_TAG.format(
                account_usage=service_connection.accountUsageSchema
            ),
            engine=engine,
        ),
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )


def _init_database(engine_wrapper: SnowflakeEngineWrapper):
    """
    Initialize database
    """
    if not engine_wrapper.service_connection.database:
        if not engine_wrapper.database_name:
            databases = engine_wrapper.engine.execute(SNOWFLAKE_GET_DATABASES)
            for database in databases:
                engine_wrapper.database_name = database.name
                break
    else:
        engine_wrapper.database_name = engine_wrapper.service_connection.database


def execute_inspector_func(engine_wrapper: SnowflakeEngineWrapper, func_name: str):
    """
    Method to test connection via inspector functions,
    this function creates the inspector object and fetches
    the function with name `func_name` and executes it
    """
    _init_database(engine_wrapper)
    engine_wrapper.engine.execute(f'USE DATABASE "{engine_wrapper.database_name}"')
    inspector = inspect(engine_wrapper.engine)
    inspector_fn = getattr(inspector, func_name)
    inspector_fn()


def test_table_query(engine_wrapper: SnowflakeEngineWrapper, statement: str):
    """
    Test Table queries
    """
    _init_database(engine_wrapper)
    test_query(
        engine=engine_wrapper.engine,
        statement=statement.format(database_name=engine_wrapper.database_name),
    )
