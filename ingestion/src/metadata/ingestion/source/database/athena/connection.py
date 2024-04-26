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
from typing import Optional

from sqlalchemy.engine import Engine

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection,
)
from metadata.ingestion.connections.builders import (
    get_connection_args_common,
)
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.connections.sql.builders.url import SqlAlchemyUrlBuilder
from metadata.ingestion.connections.sql.builders.engine import default_engine_builder
from metadata.ingestion.ometa.ometa_api import OpenMetadata


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

    url = SqlAlchemyUrlBuilder.from_driver(connection.scheme.value)
    url.with_username(aws_access_key_id or "")
    url.with_password(aws_secret_access_key or "")
    url.with_hostport(f"athena.{connection.awsConfig.awsRegion}.amazonaws.com:443")

    query_params = {
        "s3_staging_dir": connection.s3StagingDir,
        "work_group": connection.workgroup,
        "aws_session_token": aws_session_token
    }

    query_params = {key: value for key, value in query_params.items() if value}

    url.with_query_params(query_params)

    return url.build()


def get_connection(connection: AthenaConnection) -> Engine:
    """
    Create connection
    """
    return default_engine_builder(
        get_connection_url(connection),
        get_connection_args_common(connection)
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
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    test_connection_db_common(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
    )
