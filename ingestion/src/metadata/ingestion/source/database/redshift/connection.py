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
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.sql import text

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.common.iamAuthConfig import (
    IamAuthConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
    get_connection_url_common,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    execute_inspector_func,
    test_connection_engine_step,
    test_connection_steps,
    test_query,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections_utils import kill_active_connections
from metadata.ingestion.source.database.redshift.models import RedshiftInstanceType
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_GET_ALL_RELATIONS,
    REDSHIFT_GET_DATABASE_NAMES,
    REDSHIFT_TEST_GET_QUERIES_MAP,
    REDSHIFT_TEST_PARTITION_DETAILS,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def _is_serverless_host(host: str) -> bool:
    return "redshift-serverless" in host


def _get_serverless_workgroup(host: str) -> str:
    """
    Extract the workgroup name from a Redshift Serverless host.
    Serverless hosts follow: workgroup-name.account-id.region.redshift-serverless.amazonaws.com
    """
    return host.split(".")[0]


def _get_provisioned_cluster_identifier(host: str) -> str:
    """
    Extract the cluster identifier from a Redshift Provisioned host.
    Provisioned hosts follow: cluster-id.xxxxx.region.redshift.amazonaws.com
    """
    return host.split(".")[0]


def _get_serverless_iam_credentials(connection: RedshiftConnection, host: str) -> tuple:
    workgroup = _get_serverless_workgroup(host)
    try:
        aws_client = AWSClient(
            config=connection.authType.awsConfig
        ).get_redshift_serverless_client()

        kwargs = {"workgroupName": workgroup, "dbName": connection.database or "dev"}

        response = aws_client.get_credentials(**kwargs)
        return response["dbUser"], response["dbPassword"]
    except Exception as exc:
        raise SourceConnectionException(
            f"Failed to retrieve IAM credentials for Redshift Serverless "
            f"workgroup '{workgroup}': {exc}"
        ) from exc


def _get_provisioned_iam_credentials(
    connection: RedshiftConnection, host: str
) -> tuple:
    cluster_identifier = _get_provisioned_cluster_identifier(host)
    try:
        aws_client = AWSClient(
            config=connection.authType.awsConfig
        ).get_redshift_client()

        kwargs = {
            "DbUser": connection.username,
            "ClusterIdentifier": cluster_identifier,
            "AutoCreate": False,
        }
        if connection.database:
            kwargs["DbName"] = connection.database

        response = aws_client.get_cluster_credentials(**kwargs)
        return response["DbUser"], response["DbPassword"]
    except Exception as exc:
        raise SourceConnectionException(
            f"Failed to retrieve IAM credentials for Redshift cluster "
            f"'{cluster_identifier}': {exc}"
        ) from exc


def _get_redshift_iam_credentials(connection: RedshiftConnection) -> tuple:
    """
    Get temporary credentials for Redshift using IAM authentication.
    Detects Serverless vs Provisioned from the host and uses the appropriate API.
    """
    host = connection.hostPort.split(":")[0]

    if _is_serverless_host(host):
        return _get_serverless_iam_credentials(connection, host)
    return _get_provisioned_iam_credentials(connection, host)


def get_redshift_connection_url(connection: RedshiftConnection) -> str:
    """
    Build the Redshift connection URL.
    Handles both basic auth and IAM auth.
    """
    if (
        hasattr(connection, "authType")
        and connection.authType
        and isinstance(connection.authType, IamAuthConfigurationSource)
    ):
        username, password = _get_redshift_iam_credentials(connection)

        url = f"{connection.scheme.value}://"
        url += f"{quote_plus(username)}:{quote_plus(password)}@"
        url += connection.hostPort
        url += f"/{connection.database}" if connection.database else ""

        options = get_connection_options_dict(connection)
        if options:
            if not connection.database:
                url += "/"
            params = "&".join(
                f"{key}={quote_plus(value)}"
                for (key, value) in options.items()
                if value
            )
            url = f"{url}?{params}"

        return url

    return get_connection_url_common(connection)


def get_connection(connection: RedshiftConnection) -> Engine:
    """
    Create connection
    """
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_redshift_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def get_redshift_instance_type(engine: Engine) -> RedshiftInstanceType:
    """
    Detect whether the connected Amazon Redshift deployment is Provisioned
    or Serverless by probing for STL system table availability.

    Serverless deployments do not have access to STL_* system tables due to
    their architecture. Use SYS_* views instead for Serverless compatibility.

    Reference: https://docs.aws.amazon.com/redshift/latest/dg/cm_chap_system-tables.html#sys_view_migration-use_cases

    Args:
        engine (Engine): SQLAlchemy engine connected to a Redshift endpoint.

    Returns:
        RedshiftInstanceType: PROVISIONED if STL tables are accessible,
                              SERVERLESS otherwise.
    """
    probe_query = text("SELECT 1 FROM pg_catalog.stl_query LIMIT 1")

    try:
        with engine.connect() as conn:
            conn.execute(probe_query)

        logger.info(
            "Redshift instance type detected: PROVISIONED (STL tables accessible)"
        )
        return RedshiftInstanceType.PROVISIONED

    except ProgrammingError:
        logger.info(
            "Redshift instance type detected: SERVERLESS "
            "(STL tables not accessible, will use SYS_* views)"
        )
        return RedshiftInstanceType.SERVERLESS


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: RedshiftConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    table_and_view_query = REDSHIFT_GET_ALL_RELATIONS.format(
        schema_clause="", table_clause="", limit_clause="LIMIT 1"
    )

    def test_partition_details(engine_: Engine):
        """Check if we have the right permissions to get partition details"""
        with engine_.connect() as conn:
            res = conn.execute(text(REDSHIFT_TEST_PARTITION_DETAILS)).fetchone()
            if not all(res):
                raise SourceConnectionException(
                    f"We don't have the right permissions to get partition details - {res}"
                )

    def test_get_queries_permissions(engine_: Engine):
        """Check if we have the right permissions to list queries"""
        redshift_instance_type = get_redshift_instance_type(engine_)

        with engine_.connect() as conn:
            res = conn.execute(
                text(REDSHIFT_TEST_GET_QUERIES_MAP[redshift_instance_type])
            ).fetchone()
            if not all(res):
                raise SourceConnectionException(
                    f"We don't have the right permissions to list queries from sys views (Redshift Serverless) - {res}"
                    if redshift_instance_type == RedshiftInstanceType.SERVERLESS
                    else f"We don't have the right permissions to list queries from stl views (Redshift Provisioned) - {res}"  # noqa: E501
                )

    test_fn = {
        "CheckAccess": partial(test_connection_engine_step, engine),
        "GetSchemas": partial(execute_inspector_func, engine, "get_schema_names"),
        "GetTables": partial(test_query, statement=table_and_view_query, engine=engine),
        "GetViews": partial(test_query, statement=table_and_view_query, engine=engine),
        "GetQueries": partial(test_get_queries_permissions, engine),
        "GetDatabases": partial(
            test_query, statement=REDSHIFT_GET_DATABASE_NAMES, engine=engine
        ),
        "GetPartitionTableDetails": partial(test_partition_details, engine),
    }

    result = test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )

    kill_active_connections(engine)

    return result
