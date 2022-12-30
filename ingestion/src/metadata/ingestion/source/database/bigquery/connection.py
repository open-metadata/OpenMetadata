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

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.security.credentials.gcsCredentials import (
    GCSValues,
    MultipleProjectId,
    SingleProjectId,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
)
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.utils.credentials import set_google_credentials


def get_connection_url(connection: BigQueryConnection) -> str:
    """
    Build the connection URL and set the project
    environment variable when needed
    """

    if isinstance(connection.credentials.gcsConfig, GCSValues):
        if isinstance(  # pylint: disable=no-else-return
            connection.credentials.gcsConfig.projectId, SingleProjectId
        ):
            if not connection.credentials.gcsConfig.projectId.__root__:
                return f"{connection.scheme.value}://{connection.credentials.gcsConfig.projectId or ''}"
            if (
                not connection.credentials.gcsConfig.privateKey
                and connection.credentials.gcsConfig.projectId.__root__
            ):
                project_id = connection.credentials.gcsConfig.projectId.__root__
                os.environ["GOOGLE_CLOUD_PROJECT"] = project_id
            return f"{connection.scheme.value}://{connection.credentials.gcsConfig.projectId.__root__}"
        elif isinstance(connection.credentials.gcsConfig.projectId, MultipleProjectId):
            for project_id in connection.credentials.gcsConfig.projectId.__root__:
                if not connection.credentials.gcsConfig.privateKey and project_id:
                    # Setting environment variable based on project id given by user / set in ADC
                    os.environ["GOOGLE_CLOUD_PROJECT"] = project_id
                return f"{connection.scheme.value}://{project_id}"
            return f"{connection.scheme.value}://"

    return f"{connection.scheme.value}://"


def get_connection(connection: BigQueryConnection) -> Engine:
    """
    Prepare the engine and the GCS credentials
    """
    set_google_credentials(gcs_credentials=connection.credentials)
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
