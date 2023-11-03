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
Source connection helper
"""

from typing import Any

from pydantic import BaseModel
from sqlalchemy import inspect

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
    SingleProjectId,
)
from metadata.ingestion.source.connections import get_connection
from metadata.utils.bigquery_utils import get_bigquery_client


class InspectorWrapper(BaseModel):
    client: Any
    engine: Any
    inspector: Any


def get_inspector_details(
    database_name: str, service_connection: BigQueryConnection
) -> InspectorWrapper:
    """
    Method to get the bigquery inspector details
    """
    # TODO support location property in JSON Schema
    # TODO support OAuth 2.0 scopes
    kwargs = {}
    if isinstance(service_connection.credentials.gcpConfig, GcpCredentialsValues):
        service_connection.credentials.gcpConfig.projectId = SingleProjectId(
            __root__=database_name
        )
        if service_connection.credentials.gcpImpersonateServiceAccount:
            kwargs[
                "impersonate_service_account"
            ] = (
                service_connection.credentials.gcpImpersonateServiceAccount.impersonateServiceAccount
            )

            kwargs[
                "lifetime"
            ] = service_connection.credentials.gcpImpersonateServiceAccount.lifetime

    client = get_bigquery_client(project_id=database_name, **kwargs)
    engine = get_connection(service_connection)
    inspector = inspect(engine)

    return InspectorWrapper(client=client, engine=engine, inspector=inspector)
