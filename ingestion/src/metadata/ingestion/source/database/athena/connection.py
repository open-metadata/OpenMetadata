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
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
)
from metadata.ingestion.connections.test_connections import (
    execute_inspector_func,
    test_connection_engine_step,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


def get_connection_url(connection: AthenaConnection) -> str:
    """
    Method to get connection url
    """
    aws_access_key_id = connection.awsConfig.awsAccessKeyId
    aws_secret_access_key = connection.awsConfig.awsSecretAccessKey
    aws_session_token = connection.awsConfig.awsSessionToken
    if connection.awsConfig.assumeRoleArn:
        assume_configs = AWSClient.get_assume_role_config(connection.awsConfig)
        if assume_configs:
            aws_access_key_id = assume_configs.accessKeyId
            aws_secret_access_key = assume_configs.secretAccessKey
            aws_session_token = assume_configs.sessionToken

    url = f"{connection.scheme.value}://"
    if aws_access_key_id:
        url += aws_access_key_id
        if aws_secret_access_key:
            url += f":{aws_secret_access_key.get_secret_value()}"
    else:
        url += ":"
    url += f"@athena.{connection.awsConfig.awsRegion}.amazonaws.com:443"

    url += f"?s3_staging_dir={quote_plus(str(connection.s3StagingDir))}"
    if connection.workgroup:
        url += f"&work_group={connection.workgroup}"
    if aws_session_token:
        url += f"&aws_session_token={quote_plus(aws_session_token)}"

    return url


def get_connection(connection: AthenaConnection) -> Engine:
    """
    Create connection
    """
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def get_lake_formation_client(connection: AthenaConnection):
    """
    Get the lake formation client
    """
    return AWSClient(connection.awsConfig).get_lake_formation_client()


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: AthenaConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def get_test_schema(inspector: Inspector):
        all_schemas = inspector.get_schema_names()
        return all_schemas[0] if all_schemas else None

    def custom_executor_for_table():
        inspector = inspect(engine)
        test_schema = get_test_schema(inspector)
        return inspector.get_table_names(test_schema) if test_schema else []

    def custom_executor_for_view():
        inspector = inspect(engine)
        test_schema = get_test_schema(inspector)
        return inspector.get_view_names(test_schema) if test_schema else []

    test_fn = {
        "CheckAccess": partial(test_connection_engine_step, engine),
        "GetSchemas": partial(execute_inspector_func, engine, "get_schema_names"),
        "GetTables": custom_executor_for_table,
        "GetViews": custom_executor_for_view,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
