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
import os
import sys
from typing import Optional
from urllib.parse import quote_plus

import oracledb
from oracledb.exceptions import DatabaseError
from pydantic import SecretStr
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleConnection,
    OracleDatabaseSchema,
    OracleServiceName,
    OracleTNSConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
)
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.oracle.queries import CHECK_ACCESS_TO_ALL
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

CX_ORACLE_LIB_VERSION = "8.3.0"
LD_LIB_ENV = "LD_LIBRARY_PATH"

logger = ingestion_logger()


def get_connection_url(connection: OracleConnection) -> str:
    """
    Build the URL and handle driver version at system level
    """

    oracledb.version = CX_ORACLE_LIB_VERSION
    sys.modules["cx_Oracle"] = oracledb

    url = f"{connection.scheme.value}://"
    if connection.username:
        url += f"{quote_plus(connection.username)}"
        if not connection.password:
            connection.password = SecretStr("")
        url += f":{quote_plus(connection.password.get_secret_value())}"
        url += "@"

    url = _handle_connection_type(url=url, connection=connection)

    options = get_connection_options_dict(connection)
    if options:
        params = "&".join(
            f"{key}={quote_plus(value)}" for (key, value) in options.items() if value
        )
        if isinstance(connection.oracleConnectionType, OracleServiceName):
            url = f"{url}&{params}"
        else:
            url = f"{url}?{params}"

    return url


def _handle_connection_type(url: str, connection: OracleConnection) -> str:
    """
    Depending on the oracle connection type, we need to handle the URL differently
    """

    if isinstance(connection.oracleConnectionType, OracleTNSConnection):
        # ref https://stackoverflow.com/questions/14140902/using-oracle-service-names-with-sqlalchemy
        url += connection.oracleConnectionType.oracleTNSConnection
        return url

    # If not TNS, we add the hostPort
    url += connection.hostPort

    if isinstance(connection.oracleConnectionType, OracleDatabaseSchema):
        url += (
            f"/{connection.oracleConnectionType.databaseSchema}"
            if connection.oracleConnectionType.databaseSchema
            else ""
        )
        return url

    if isinstance(connection.oracleConnectionType, OracleServiceName):
        url = f"{url}/?service_name={connection.oracleConnectionType.oracleServiceName}"
        return url

    raise ValueError(f"Unknown connection type {connection.oracleConnectionType}")


def get_connection(connection: OracleConnection) -> Engine:
    """
    Create connection
    """
    try:
        if connection.instantClientDirectory:
            logger.info(
                f"Initializing Oracle thick client at {connection.instantClientDirectory}"
            )
            os.environ[LD_LIB_ENV] = connection.instantClientDirectory
            oracledb.init_oracle_client()
    except DatabaseError as err:
        logger.info(f"Could not initialize Oracle thick client: {err}")

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: OracleConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    test_conn_queries = {"CheckAccess": CHECK_ACCESS_TO_ALL}

    return test_connection_db_common(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        queries=test_conn_queries,
        timeout_seconds=timeout_seconds,
    )
