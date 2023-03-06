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
from functools import partial

from google import auth
from google.cloud.datacatalog_v1 import PolicyTagManagerClient
from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.security.credentials.gcsValues import (
    GcsCredentialsValues,
    MultipleProjectId,
    SingleProjectId,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
)
from metadata.ingestion.connections.test_connections import (
    TestConnectionResult,
    TestConnectionStep,
    test_connection_db_common,
)
from metadata.utils.credentials import set_google_credentials


def get_connection_url(connection: BigQueryConnection) -> str:
    """
    Build the connection URL and set the project
    environment variable when needed
    """

    if isinstance(connection.credentials.gcsConfig, GcsCredentialsValues):
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


def test_connection(engine: Engine, service_connection) -> TestConnectionResult:
    """
    Test connection
    """

    def get_tags(taxonomies):
        for taxonomy in taxonomies:
            policy_tags = PolicyTagManagerClient().list_policy_tags(
                parent=taxonomy.name
            )
            return policy_tags

    inspector = inspect(engine)

    def custom_executor():
        list_project_ids = auth.default()
        project_id = list_project_ids[1]

        if isinstance(project_id, str):
            taxonomies = PolicyTagManagerClient().list_taxonomies(
                parent=f"projects/{project_id}/locations/{service_connection.taxonomyLocation}"
            )
            return get_tags(taxonomies)

        if isinstance(project_id, list):
            taxonomies = PolicyTagManagerClient().list_taxonomies(
                parent=f"projects/{project_id[0]}/locations/{service_connection.taxonomyLocation}"
            )

            return get_tags(taxonomies)

        return None

    steps = [
        TestConnectionStep(
            function=inspector.get_schema_names,
            name="Get Schemas",
        ),
        TestConnectionStep(
            function=inspector.get_table_names,
            name="Get Tables",
        ),
        TestConnectionStep(
            function=inspector.get_view_names,
            name="Get Views",
            mandatory=False,
        ),
        TestConnectionStep(
            function=partial(
                custom_executor,
            ),
            name="Get Tags",
            mandatory=False,
        ),
    ]

    return test_connection_db_common(engine, steps)
