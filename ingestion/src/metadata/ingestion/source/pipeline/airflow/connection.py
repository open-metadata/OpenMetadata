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
from functools import partial, singledispatch
from typing import Optional

from airflow import settings
from airflow.models.serialized_dag import SerializedDagModel
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
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
    with settings.Session() as session:
        return session.get_bind()


@_get_connection.register
def _(airflow_connection: MysqlConnection) -> Engine:
    from metadata.ingestion.source.database.mysql.connection import (
        get_connection as get_mysql_connection,
    )

    return get_mysql_connection(airflow_connection)


@_get_connection.register
def _(airflow_connection: PostgresConnection) -> Engine:
    from metadata.ingestion.source.database.postgres.connection import (
        get_connection as get_postgres_connection,
    )

    return get_postgres_connection(airflow_connection)


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
            result = session.query(SerializedDagModel).first()
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
