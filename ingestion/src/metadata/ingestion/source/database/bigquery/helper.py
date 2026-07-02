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
Source connection helper
"""

import re
import traceback
from copy import deepcopy
from typing import Any, List, Tuple  # noqa: UP035

from pydantic import BaseModel
from sqlalchemy import inspect, text

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
    SingleProjectId,
)
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.bigquery.queries import BIGQUERY_CONSTRAINTS
from metadata.utils.bigquery_utils import get_bigquery_client
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

CONSTRAINT_CACHE = {}


def clear_constraint_cache():
    """Clear the global constraint cache to free memory."""
    global CONSTRAINT_CACHE  # noqa: PLW0602
    CONSTRAINT_CACHE.clear()
    logger.debug("Cleared CONSTRAINT_CACHE")


def clear_constraint_cache_for_schema(project: str, schema: str):
    """Clear cache entry for a specific schema to free memory incrementally."""
    global CONSTRAINT_CACHE  # noqa: PLW0602
    cache_key = f"{project}.{schema}"
    if cache_key in CONSTRAINT_CACHE:
        del CONSTRAINT_CACHE[cache_key]
        logger.debug(f"Cleared CONSTRAINT_CACHE for {cache_key}")


class InspectorWrapper(BaseModel):
    client: Any
    engine: Any
    inspector: Any


def clone_connection_for_project(database_name: str, service_connection: BigQueryConnection) -> BigQueryConnection:
    """
    Return a copy of the service connection scoped to a single project, so each
    project in a multi-project connection can be inspected/tested independently.
    """
    new_service_connection = deepcopy(service_connection)
    if isinstance(new_service_connection.credentials.gcpConfig, GcpCredentialsValues):
        new_service_connection.credentials.gcpConfig.projectId = SingleProjectId(database_name)
    return new_service_connection


def get_impersonate_client_kwargs(service_connection: BigQueryConnection) -> dict:
    """
    Build the impersonation kwargs for ``get_bigquery_client`` when a target
    service account is configured.

    ``gcpImpersonateServiceAccount`` lives on the parent credentials object and
    is valid regardless of the selected ``gcpConfig`` type (ADC, JSON key,
    path or external account), so it must not be gated on a specific type.
    Returns an empty dict when impersonation is not configured, leaving the
    default (non-impersonated) behaviour untouched.
    """
    kwargs = {}
    impersonate = service_connection.credentials.gcpImpersonateServiceAccount
    if impersonate and impersonate.impersonateServiceAccount:
        kwargs["impersonate_service_account"] = impersonate.impersonateServiceAccount
        kwargs["lifetime"] = impersonate.lifetime
    return kwargs


def get_inspector_details(database_name: str, service_connection: BigQueryConnection) -> InspectorWrapper:
    """
    Method to get the bigquery inspector details
    """
    # TODO support location property in JSON Schema
    # TODO support OAuth 2.0 scopes
    new_service_connection = clone_connection_for_project(database_name, service_connection)
    kwargs = get_impersonate_client_kwargs(new_service_connection)

    if new_service_connection.usageLocation:
        kwargs["location"] = new_service_connection.usageLocation

    client = get_bigquery_client(project_id=new_service_connection.billingProjectId or database_name, **kwargs)
    engine = get_connection(new_service_connection)
    inspector = inspect(engine)

    return InspectorWrapper(client=client, engine=engine, inspector=inspector)


def get_pk_constraint(self, connection, table_name, schema=None, **kw):  # pylint: disable=unused-argument
    """
    This function overrides to get primary key constraint
    """
    try:
        project, schema = schema.split(".")
        cache_key = f"{project}.{schema}"

        if cache_key not in CONSTRAINT_CACHE:
            with connection.engine.connect() as conn:
                constraints = conn.execute(text(BIGQUERY_CONSTRAINTS.format(project_id=project, dataset_name=schema)))
                CONSTRAINT_CACHE[cache_key] = constraints.fetchall()

        col_names = [
            row.column_name
            for row in CONSTRAINT_CACHE[cache_key]
            if row.table_name == table_name and row.constraint_type == "PRIMARY KEY"
        ]
        return {"constrained_columns": tuple(col_names)}
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error while fetching primary key constraint error for table [{schema}.{table_name}]: {exc}")
        return {"constrained_columns": []}


def get_foreign_keys(self, connection, table_name, schema=None, **kw):  # pylint: disable=unused-argument
    """
    This function overrides to get foreign key constraint
    """
    try:
        project, schema = schema.split(".")
        cache_key = f"{project}.{schema}"

        if cache_key not in CONSTRAINT_CACHE:
            with connection.engine.connect() as conn:
                constraints = conn.execute(text(BIGQUERY_CONSTRAINTS.format(project_id=project, dataset_name=schema)))
                CONSTRAINT_CACHE[cache_key] = constraints.fetchall()

        fk_list = []
        for row in CONSTRAINT_CACHE[cache_key]:
            if row.table_name == table_name and row.constraint_type == "FOREIGN KEY":
                fk_list.append(  # noqa: PERF401
                    {
                        "name": row.constraint_name,
                        "referred_schema": row.referenced_schema,
                        "referred_table": row.referenced_table,
                        "constrained_columns": [row.column_name],
                        "referred_columns": [row.referenced_column],
                    }
                )
        return fk_list  # noqa: TRY300
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error while fetching foreign key constraint error for table [{schema}.{table_name}]: {exc}")
        return []


def parse_bigqeury_labels(labels: str) -> List[Tuple[str, str]]:  # noqa: UP006
    """
    This function is used to parse BigQuery label string into a list of tuples.
    """
    return re.findall(r'STRUCT\("([^"]+)",\s*"([^"]+)"\)', labels)
