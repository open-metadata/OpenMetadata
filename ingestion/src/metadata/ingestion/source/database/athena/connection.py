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
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
)
from metadata.ingestion.connections.test_connections import test_connection_db_common


def get_connection_url(connection: AthenaConnection) -> str:
    url = f"{connection.scheme.value}://"
    if connection.awsConfig.awsAccessKeyId:
        url += connection.awsConfig.awsAccessKeyId
        if connection.awsConfig.awsSecretAccessKey:
            url += f":{connection.awsConfig.awsSecretAccessKey.get_secret_value()}"
    else:
        url += ":"
    url += f"@athena.{connection.awsConfig.awsRegion}.amazonaws.com:443"

    url += f"?s3_staging_dir={quote_plus(connection.s3StagingDir)}"
    if connection.workgroup:
        url += f"&work_group={connection.workgroup}"
    if connection.awsConfig.awsSessionToken:
        url += f"&aws_session_token={quote_plus(connection.awsConfig.awsSessionToken)}"

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


def test_connection(engine: Engine) -> None:
    """
    Test connection
    """
    test_connection_db_common(engine)
