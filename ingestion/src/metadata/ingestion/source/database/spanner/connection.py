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

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.spannerConnection import (
    SpannerConnection,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
)
from metadata.ingestion.connections.test_connections import test_connection_db_common


def get_connection_url(connection: SpannerConnection) -> str:
    """
    Build the connection URL and set the project
    environment variable when needed
    """
    # NOTE 'python-spanner-sqlalchemy' requires all of a project ID, an instance ID and a database ID.
    #      For instance, it is impossible to get a list of databases only by connecting to an instance.
    schema = connection.schema.value
    project_id = connection.credentials.gcsConfig.projectId.__root__
    instance_id = connection.instanceId
    database_id = connection.databaseId
    return f"{schema}:///projects/{project_id}/instances/{instance_id}/databases/{database_id}"


def get_connection(connection: SpannerConnection) -> Engine:
    """
    Prepare the engine and the GCS credentials
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
