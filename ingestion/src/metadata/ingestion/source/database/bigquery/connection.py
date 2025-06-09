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
from datetime import datetime
from functools import partial
from typing import Optional

from google.api_core.exceptions import NotFound
from google.cloud.datacatalog_v1 import PolicyTagManagerClient
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.generated.schema.security.credentials.gcpCredentials import (
    GcpCredentialsPath,
)
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
    MultipleProjectId,
    SingleProjectId,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
)
from metadata.ingestion.connections.test_connections import (
    execute_inspector_func,
    test_connection_engine_step,
    test_connection_steps,
    test_query,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.bigquery.queries import BIGQUERY_TEST_STATEMENT
from metadata.utils.constants import THREE_MIN
from metadata.utils.credentials import set_google_credentials
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_connection_url(connection: BigQueryConnection) -> str:
    """
    Build the connection URL and set the project
    environment variable when needed
    """

    if isinstance(connection.credentials.gcpConfig, GcpCredentialsValues):
        if isinstance(  # pylint: disable=no-else-return
            connection.credentials.gcpConfig.projectId, SingleProjectId
        ):
            if not connection.credentials.gcpConfig.projectId.root:
                return f"{connection.scheme.value}://{connection.billingProjectId or connection.credentials.gcpConfig.projectId.root or ''}"
            if (
                not connection.credentials.gcpConfig.privateKey
                and connection.credentials.gcpConfig.projectId.root
            ):
                project_id = connection.credentials.gcpConfig.projectId.root
                os.environ["GOOGLE_CLOUD_PROJECT"] = (
                    connection.billingProjectId or project_id
                )
            return f"{connection.scheme.value}://{connection.billingProjectId or connection.credentials.gcpConfig.projectId.root}"
        elif isinstance(connection.credentials.gcpConfig.projectId, MultipleProjectId):
            for project_id in connection.credentials.gcpConfig.projectId.root:
                if not connection.credentials.gcpConfig.privateKey and project_id:
                    # Setting environment variable based on project id given by user / set in ADC
                    os.environ["GOOGLE_CLOUD_PROJECT"] = (
                        connection.billingProjectId or project_id
                    )
                return f"{connection.scheme.value}://{connection.billingProjectId or project_id}"
            return f"{connection.scheme.value}://{connection.billingProjectId or ''}"

    # If gcpConfig is the JSON key path and projectId is defined, we use it by default
    elif (
        isinstance(connection.credentials.gcpConfig, GcpCredentialsPath)
        and connection.credentials.gcpConfig.projectId
    ):
        if isinstance(  # pylint: disable=no-else-return
            connection.credentials.gcpConfig.projectId, SingleProjectId
        ):
            return f"{connection.scheme.value}://{connection.billingProjectId or connection.credentials.gcpConfig.projectId.root}"

        elif isinstance(connection.credentials.gcpConfig.projectId, MultipleProjectId):
            for project_id in connection.credentials.gcpConfig.projectId.root:
                return f"{connection.scheme.value}://{connection.billingProjectId or project_id}"

    return f"{connection.scheme.value}://{connection.billingProjectId or ''}"


def get_connection(connection: BigQueryConnection) -> Engine:
    """
    Prepare the engine and the GCP credentials
    """
    set_google_credentials(gcp_credentials=connection.credentials)
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: BigQueryConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def get_tags(taxonomies):
        for taxonomy in taxonomies:
            policy_tags = PolicyTagManagerClient().list_policy_tags(
                parent=taxonomy.name
            )
            return policy_tags

    def test_tags():
        taxonomy_project_ids = []
        if engine.url.host:
            taxonomy_project_ids.append(engine.url.host)
        if service_connection.taxonomyProjectID:
            taxonomy_project_ids.extend(service_connection.taxonomyProjectID)
        if not taxonomy_project_ids:
            logger.info("'taxonomyProjectID' is not set, so skipping this test.")
            return None

        taxonomy_location = service_connection.taxonomyLocation
        if not taxonomy_location:
            logger.info("'taxonomyLocation' is not set, so skipping this test.")
            return None

        taxonomies = []
        for project_id in taxonomy_project_ids:
            taxonomies.extend(
                PolicyTagManagerClient().list_taxonomies(
                    parent=f"projects/{project_id}/locations/{taxonomy_location}"
                )
            )
        return get_tags(taxonomies)

    def test_connection_inner(engine):
        test_fn = {
            "CheckAccess": partial(test_connection_engine_step, engine),
            "GetSchemas": partial(execute_inspector_func, engine, "get_schema_names"),
            "GetTables": partial(get_table_view_names, engine),
            "GetViews": partial(get_table_view_names, engine),
            "GetTags": test_tags,
            "GetQueries": partial(
                test_query,
                engine=engine,
                statement=BIGQUERY_TEST_STATEMENT.format(
                    region=service_connection.usageLocation,
                    creation_date=datetime.now().strftime("%Y-%m-%d"),
                ),
            ),
        }

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )

    return test_connection_inner(engine)


def get_table_view_names(connection, schema=None):
    with connection.connect() as conn:
        current_schema = schema
        client = conn.connection._client
        item_types = ["TABLE", "EXTERNAL", "VIEW", "MATERIALIZED_VIEW"]
        datasets = client.list_datasets()
        result = []
        for dataset in datasets:
            if current_schema is not None and current_schema != dataset.dataset_id:
                continue

            try:
                tables = client.list_tables(dataset.reference, page_size=1)
                for table in tables:
                    if table.table_type in item_types:
                        break
            except NotFound:
                # It's possible that the dataset was deleted between when we
                # fetched the list of datasets and when we try to list the
                # tables from it. See:
                # https://github.com/googleapis/python-bigquery-sqlalchemy/issues/105
                pass
        return result
