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
Utils module of BigQuery
"""

from copy import deepcopy
from typing import List, Optional

from google.cloud import bigquery

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
    MultipleProjectId,
    SingleProjectId,
)
from metadata.utils.credentials import (
    get_gcp_default_credentials,
    get_gcp_impersonate_credentials,
)


def get_bigquery_client(
    project_id: Optional[str] = None,
    location: Optional[str] = None,
    impersonate_service_account: Optional[str] = None,
    quota_project_id: Optional[str] = None,
    scopes: Optional[List[str]] = None,
    lifetime: Optional[int] = 3600,
) -> bigquery.Client:
    """Get a BigQuery client

    Args:
        location: The job location
        project_id: The client project ID
        impersonate_service_account: The service account email
        quota_project_id: The project ID for quota
        scopes: scopes
        lifetime: impersonation lifetime

    Returns:
        bigquery.Client: client
    """
    if impersonate_service_account is None:
        credentials = get_gcp_default_credentials(quota_project_id=quota_project_id)
    else:
        credentials = get_gcp_impersonate_credentials(
            impersonate_service_account=impersonate_service_account,
            quoted_project_id=quota_project_id,
            scopes=scopes,
            lifetime=lifetime,
        )
    return bigquery.Client(
        credentials=credentials, project=project_id, location=location
    )


def copy_service_config(
    config: OpenMetadataWorkflowConfig, database_name: str
) -> BigQueryConnection:
    """Handles multiple project id in the service config and replace it with the database name

    Args:
        config (OpenMetadataWorkflowConfig): openmetadata workflow config
        database_name (str): database name

    Returns:
        BigQueryConnection: bigquery connection
    """
    config_copy: BigQueryConnection = deepcopy(
        config.source.serviceConnection.root.config  # type: ignore
    )

    if isinstance(config_copy.credentials.gcpConfig, GcpCredentialsValues):
        if isinstance(config_copy.credentials.gcpConfig.projectId, MultipleProjectId):
            config_copy.credentials.gcpConfig.projectId = SingleProjectId(database_name)

    return config_copy
