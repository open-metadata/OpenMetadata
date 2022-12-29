#  Copyright 2021 Collate #pylint: disable=too-many-lines
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
Build and document all supported Engines
"""
import json
import logging
from functools import singledispatch, wraps
from typing import Callable, Union

import pkg_resources
from pydantic import BaseModel
from sqlalchemy import create_engine
from sqlalchemy.engine.base import Engine
from sqlalchemy.event import listen
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import QueuePool

from metadata.clients.atlas_client import AtlasClient
from metadata.clients.connection_clients import (
    AirByteClient,
    AmundsenClient,
    DagsterClient,
    FivetranClient,
    GluePipelineClient,
    KinesisClient,
    MlflowClientWrapper,
    NifiClientWrapper,
    SageMakerClient,
)
from metadata.clients.nifi_client import NifiClient
from metadata.generated.schema.entity.services.connections.messaging.kinesisConnection import (
    KinesisConnection,
)
from metadata.generated.schema.entity.services.connections.messaging.redpandaConnection import (
    RedpandaConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.amundsenConnection import (
    AmundsenConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.atlasConnection import (
    AtlasConnection,
)
from metadata.generated.schema.entity.services.connections.mlmodel.mlflowConnection import (
    MlflowConnection,
)
from metadata.generated.schema.entity.services.connections.mlmodel.sageMakerConnection import (
    SageMakerConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
    AirbyteConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.backendConnection import (
    BackendConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.dagsterConnection import (
    DagsterConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.fivetranConnection import (
    FivetranConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.gluePipelineConnection import (
    GluePipelineConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.nifiConnection import (
    NifiConnection,
)
from metadata.orm_profiler.orm.functions.conn_test import ConnTestFn
from metadata.utils.sql_queries import NEO4J_AMUNDSEN_USER_QUERY
from metadata.utils.ssl_registry import get_verify_ssl_fn
from metadata.utils.timeout import timeout

logger = logging.getLogger("Utils")


# All imports are happening scoped in their own functions. This is fine here to not force any unused requirement
# pylint: disable=import-outside-toplevel
class SourceConnectionException(Exception):
    """
    Raised when we cannot connect to the source
    """


class TestConnectionStep(BaseModel):
    """
    Function and step name to test.

    The function should be ready to be called.

    If it needs arguments, use `partial` to send a pre-filled
    Callable. Example

    ```
    def suma(a, b):
        return a + b

    step_1 = TestConnectionStep(
        function=partial(suma, a=1, b=1),
        name="suma"
    )
    ```

    so that we can execute `step_1.function()`
    """

    function: Callable
    name: str


def render_query_header(ometa_version: str) -> str:
    """
    Render the query header for OpenMetadata Queries
    """

    header_obj = {"app": "OpenMetadata", "version": ometa_version}
    return f"/* {json.dumps(header_obj)} */"


def inject_query_header(
    conn, cursor, statement, parameters, context, executemany
):  # pylint: disable=unused-argument
    """
    Inject the query header for OpenMetadata Queries
    """

    version = pkg_resources.require("openmetadata-ingestion")[0].version
    statement_with_header = render_query_header(version) + "\n" + statement
    return statement_with_header, parameters


def create_generic_connection(connection, verbose: bool = False) -> Engine:
    """
    Generic Engine creation from connection object
    :param connection: JSON Schema connection model
    :param verbose: debugger or not
    :return: SQAlchemy Engine
    """
    engine = create_engine(
        get_connection_url(connection),
        connect_args=get_connection_args(connection),
        poolclass=QueuePool,
        pool_reset_on_return=None,  # https://docs.sqlalchemy.org/en/14/core/pooling.html#reset-on-return
        echo=verbose,
        max_overflow=-1,
    )

    if hasattr(connection, "supportsQueryComment"):
        listen(engine, "before_cursor_execute", inject_query_header, retval=True)

    return engine


def singledispatch_with_options_secrets_verbose(fn):
    """Decorator used for get any secret from the Secrets Manager that has been passed inside connection options
    or arguments.
    """

    @wraps(fn)
    @singledispatch
    def inner(connection, verbose: bool = False, **kwargs):
        update_connection_opts_args(connection)
        return fn(connection, verbose, **kwargs)

    return inner


@singledispatch_with_options_secrets_verbose
def get_connection(
    connection, verbose: bool = False
) -> Union[Engine, GluePipelineClient]:
    """
    Given an SQL configuration, build the SQLAlchemy Engine
    """
    return create_generic_connection(connection, verbose)


@get_connection.register
def _(
    connection: GluePipelineConnection,
    verbose: bool = False,  # pylint: disable=unused-argument
) -> GluePipelineConnection:
    from metadata.clients.aws_client import AWSClient

    glue_connection = AWSClient(connection.awsConfig).get_glue_pipeline_client()
    return glue_connection


@timeout(seconds=120)
@singledispatch_with_options_secrets
def test_connection(connection) -> None:
    """
    Default implementation is the engine to test.

    Test that we can connect to the source using the given engine
    :param connection: Engine to test
    :return: None or raise an exception if we cannot connect
    """
    try:
        with connection.connect() as conn:
            conn.execute(ConnTestFn())
    except OperationalError as err:
        msg = f"Connection error for {connection}: {err}. Check the connection details."
        raise SourceConnectionException(msg) from err
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


@test_connection.register
def _(connection: GluePipelineClient) -> None:
    """
    Test that we can connect to the source using the given aws resource
    :param engine: boto cliet to test
    :return: None or raise an exception if we cannot connect
    """
    from botocore.client import ClientError

    try:
        connection.client.list_workflows()
    except ClientError as err:
        msg = f"Connection error for {connection}: {err}. Check the connection details."
        raise SourceConnectionException(msg) from err
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


@test_connection.register
def _(connection: AirflowConnection) -> None:
    try:
        test_connection(connection.connection)
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


@get_connection.register
def _(connection: AirflowConnection) -> None:
    try:
        return get_connection(connection.connection)
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


@get_connection.register
def _(
    connection: AirbyteConnection, verbose: bool = False
):  # pylint: disable=unused-argument
    from metadata.clients.airbyte_client import AirbyteClient

    return AirByteClient(AirbyteClient(connection))


@test_connection.register
def _(connection: AirByteClient) -> None:
    try:
        connection.client.list_workspaces()
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


@get_connection.register
def _(
    connection: FivetranConnection, verbose: bool = False
):  # pylint: disable=unused-argument
    from metadata.clients.fivetran_client import FivetranClient as FivetranRestClient

    return FivetranClient(FivetranRestClient(connection))


@test_connection.register
def _(connection: FivetranClient) -> None:
    try:
        connection.client.list_groups()
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


@get_connection.register
def _(
    connection: MlflowConnection,
    verbose: bool = False,  # pylint: disable=unused-argument
):
    from mlflow.tracking import MlflowClient

    return MlflowClientWrapper(
        MlflowClient(
            tracking_uri=connection.trackingUri,
            registry_uri=connection.registryUri,
        )
    )


@test_connection.register
def _(connection: MlflowClientWrapper) -> None:
    try:
        connection.client.list_registered_models()
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


@get_connection.register
def _(
    connection: SageMakerConnection,
    verbose: bool = False,  # pylint: disable=unused-argument
) -> SageMakerClient:
    from metadata.clients.aws_client import AWSClient

    sagemaker_connection = AWSClient(connection.awsConfig).get_sagemaker_client()
    return sagemaker_connection


@test_connection.register
def _(connection: SageMakerClient) -> None:
    """
    Test that we can connect to the SageMaker source using the given aws resource
    :param engine: boto service resource to test
    :return: None or raise an exception if we cannot connect
    """
    from botocore.client import ClientError

    try:
        connection.client.list_models()
    except ClientError as err:
        msg = f"Connection error for {connection}: {err}. Check the connection details."
        raise SourceConnectionException(msg) from err
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


@get_connection.register
def _(
    connection: NifiConnection, verbose: bool = False
):  # pylint: disable=unused-argument

    return NifiClientWrapper(
        NifiClient(
            host_port=connection.hostPort,
            username=connection.username,
            password=connection.password.get_secret_value(),
            verify=connection.verifySSL,
        )
    )


@test_connection.register
def _(connection: NifiClientWrapper) -> None:
    try:
        connection.client.resources
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        ) from err


@get_connection.register
def _(_: BackendConnection, verbose: bool = False):  # pylint: disable=unused-argument
    """
    Let's use Airflow's internal connection for this
    """
    from airflow import settings

    with settings.Session() as session:
        return session.get_bind()


@test_connection.register
def _(connection: DagsterClient) -> None:
    from metadata.utils.graphql_queries import TEST_QUERY_GRAPHQL

    try:
        connection.client._execute(  # pylint: disable=protected-access
            TEST_QUERY_GRAPHQL
        )
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


@get_connection.register
def _(connection: DagsterConnection) -> DagsterClient:

    from dagster_graphql import DagsterGraphQLClient
    from gql.transport.requests import RequestsHTTPTransport

    url = connection.host
    dagster_connection = DagsterGraphQLClient(
        url,
        transport=RequestsHTTPTransport(
            url=f"{url}/graphql",
            headers={"Dagster-Cloud-Api-Token": connection.token.get_secret_value()}
            if connection.token
            else None,
        ),
    )
    return DagsterClient(dagster_connection)


@get_connection.register
def _(connection: AmundsenConnection) -> AmundsenClient:

    from metadata.clients.neo4j_client import Neo4JConfig, Neo4jHelper

    try:
        neo4j_config = Neo4JConfig(
            username=connection.username,
            password=connection.password.get_secret_value(),
            neo4j_url=connection.hostPort,
            max_connection_life_time=connection.maxConnectionLifeTime,
            neo4j_encrypted=connection.encrypted,
            neo4j_validate_ssl=connection.validateSSL,
        )
        return AmundsenClient(Neo4jHelper(neo4j_config))
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg)


@test_connection.register
def _(connection: AmundsenClient) -> None:
    try:
        connection.client.execute_query(query=NEO4J_AMUNDSEN_USER_QUERY)
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg)


@get_connection.register
def _(connection: AtlasConnection) -> AtlasClient:

    connection_client = AtlasClient(connection)
    return connection_client


@test_connection.register
def _(connection: AtlasClient) -> None:
    try:
        connection.list_entities()
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg)
