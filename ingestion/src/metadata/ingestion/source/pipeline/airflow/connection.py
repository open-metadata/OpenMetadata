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
import os
from functools import partial, singledispatch
from typing import Optional
from urllib.parse import quote

from airflow import __version__ as airflow_version
from airflow import settings
from airflow.models.serialized_dag import SerializedDagModel
from packaging import version
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection as MysqlConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection as PostgresConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.backendConnection import (
    BackendConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_engine_step,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

ORM_ACCESS_BLOCKED_ERROR = "Direct database access via the ORM"

try:
    IS_AIRFLOW_3 = version.parse(airflow_version).major >= 3
except Exception:  # pylint: disable=broad-except
    # Be conservative and keep the Airflow 2.x code path if we can't detect the version
    IS_AIRFLOW_3 = False


# Only import when needed
# pylint: disable=import-outside-toplevel
@singledispatch
def _get_connection(airflow_connection) -> Engine:
    """
    Internal call for Airflow connection build
    """
    raise NotImplementedError(f"Not support connection type {airflow_connection}")


@_get_connection.register
def _(_: BackendConnection) -> Engine:
    if IS_AIRFLOW_3:
        return _get_engine_from_env_vars()

    engine = _get_backend_engine_from_session()
    if not engine:
        raise SourceConnectionException(
            "Could not create an Airflow metadata DB engine using airflow.settings. "
            "If you are running Airflow >= 3, ensure the required DB_* environment "
            "variables are set."
        )
    return engine


def _get_backend_engine_from_session() -> Optional[Engine]:
    """
    Try to get the Airflow metadata engine via airflow.settings.Session.
    This is allowed on Airflow 2.x but raises a RuntimeError on Airflow 3.x.
    """
    try:
        with settings.Session() as session:
            return session.get_bind()
    except RuntimeError as exc:
        if ORM_ACCESS_BLOCKED_ERROR in str(exc):
            logger.info(
                "Airflow prevented direct ORM access (likely Airflow 3.x). "
                "Switching to the environment-based connection builder."
            )
            return None
        raise


def _get_engine_from_env_vars() -> Engine:
    """
    Build the Airflow metadata database URL based on the DB_* variables that
    ingestion_dependency.sh sets to keep docker + tests working.
    """

    scheme = os.environ.get("DB_SCHEME")
    user = os.environ.get("DB_USER")
    password = os.environ.get("DB_PASSWORD")
    host = os.environ.get("DB_HOST")
    port = os.environ.get("DB_PORT")
    database = os.environ.get("AIRFLOW_DB")
    properties = os.environ.get("DB_PROPERTIES")

    missing = [
        name
        for name, value in (
            ("DB_SCHEME", scheme),
            ("DB_USER", user),
            ("DB_PASSWORD", password),
            ("DB_HOST", host),
            ("DB_PORT", port),
            ("AIRFLOW_DB", database),
        )
        if not value
    ]
    if missing:
        raise SourceConnectionException(
            "Airflow 3.x execution environments must define the following environment "
            f"variables to allow OpenMetadata to build the metadata DB connection: "
            f"{', '.join(missing)}"
        )

    encoded_user = quote(user, safe="")
    encoded_password = quote(password, safe="")
    properties = properties or ""

    sql_alchemy_conn = (
        f"{scheme}://{encoded_user}:{encoded_password}"
        f"@{host}:{port}/{database}{properties}"
    )

    try:
        return create_engine(sql_alchemy_conn, pool_pre_ping=True)
    except Exception as exc:  # pylint: disable=broad-except
        raise SourceConnectionException(
            "Failed to create SQLAlchemy engine using the DB_* environment variables. "
            "Double check the credentials and scheme."
        ) from exc


@_get_connection.register
def _(airflow_connection: MysqlConnectionConfig) -> Engine:
    from metadata.ingestion.source.database.mysql.connection import MySQLConnection

    return MySQLConnection(airflow_connection)._get_client()


@_get_connection.register
def _(airflow_connection: PostgresConnectionConfig) -> Engine:
    from metadata.ingestion.source.database.postgres.connection import (
        PostgresConnection,
    )

    return PostgresConnection(airflow_connection)._get_client()


@_get_connection.register
def _(airflow_connection: SQLiteConnection) -> Engine:
    from metadata.ingestion.source.database.sqlite.connection import (
        get_connection as get_sqlite_connection,
    )

    return get_sqlite_connection(airflow_connection)


def get_connection(connection: AirflowConnection) -> Engine:
    """
    Create connection
    """
    try:
        return _get_connection(connection.connection)
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


class AirflowPipelineDetailsAccessError(Exception):
    """
    Raise when Pipeline information is not retrieved
    """


class AirflowTaskDetailsAccessError(Exception):
    """
    Raise when Task detail information is not retrieved
    """


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: AirflowConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    session_maker = sessionmaker(bind=engine)
    session = session_maker()

    def test_pipeline_details_access(session):
        try:
            # Query only the dag_id column to avoid version compatibility issues
            # The data_compressed column doesn't exist in Airflow 2.2.5
            result = session.query(SerializedDagModel.dag_id).first()
            return result
        except Exception as e:
            raise AirflowPipelineDetailsAccessError(
                f"Pipeline details access error: {e}"
            )

    def test_task_detail_access(session):
        try:
            json_data_column = (
                SerializedDagModel._data  # For 2.3.0 onwards # pylint: disable=protected-access
                if hasattr(SerializedDagModel, "_data")
                else SerializedDagModel.data  # For 2.2.5 and 2.1.4
            )
            result = session.query(json_data_column).first()

            retrieved_tasks = result[0]["dag"]["tasks"]
            return retrieved_tasks
        except Exception as e:
            raise AirflowTaskDetailsAccessError(f"Task details access error : {e}")

    test_fn = {
        "CheckAccess": partial(test_connection_engine_step, engine),
        "PipelineDetailsAccess": partial(test_pipeline_details_access, session),
        "TaskDetailAccess": partial(test_task_detail_access, session),
    }
    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
