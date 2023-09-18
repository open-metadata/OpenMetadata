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
Utils module of BigQuery
"""

from typing import List, Optional

from google.cloud import bigquery

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
