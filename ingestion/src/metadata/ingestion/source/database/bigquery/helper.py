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
from typing import Any, List, Tuple

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
from metadata.ingestion.source.database.bigquery.queries import (
    BIGQUERY_FOREIGN_CONSTRAINTS,
    BIGQUERY_TABLE_CONSTRAINTS,
)
from metadata.utils.bigquery_utils import get_bigquery_client
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

FK_CACHE = {}
PK_CACHE = {}


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
    new_service_connection = deepcopy(service_connection)
    kwargs = {}
    if isinstance(new_service_connection.credentials.gcpConfig, GcpCredentialsValues):
        new_service_connection.credentials.gcpConfig.projectId = SingleProjectId(
            database_name
        )
        if new_service_connection.credentials.gcpImpersonateServiceAccount:
            kwargs[
                "impersonate_service_account"
            ] = (
                new_service_connection.credentials.gcpImpersonateServiceAccount.impersonateServiceAccount
            )

            kwargs[
                "lifetime"
            ] = new_service_connection.credentials.gcpImpersonateServiceAccount.lifetime

    client = get_bigquery_client(
        project_id=new_service_connection.billingProjectId or database_name, **kwargs
    )
    engine = get_connection(new_service_connection)
    inspector = inspect(engine)

    return InspectorWrapper(client=client, engine=engine, inspector=inspector)


def get_pk_constraint(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    """
    This function overrides to get primary key constraint
    """
    try:
        project, schema = schema.split(".")
        constraints = PK_CACHE.get(f"{project}.{schema}")
        if constraints is None:
            constraints = connection.engine.execute(
                BIGQUERY_TABLE_CONSTRAINTS.format(
                    project_id=project, schema_name=schema
                )
            )
            PK_CACHE[f"{project}.{schema}"] = constraints.fetchall()

        col_name = []
        table_constraints = [row for row in constraints if row.table_name == table_name]
        for table_constraint in table_constraints:
            col_name.append(table_constraint.column_name)
        return {"constrained_columns": tuple(col_name)}
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(
            f"Error while fetching primary key constraint error for table [{schema}.{table_name}]: {exc}"
        )
        return {"constrained_columns": []}


def get_foreign_keys(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    """
    This function overrides to get foreign key constraint
    """
    try:
        project, schema = schema.split(".")
        constraints = FK_CACHE.get(f"{project}.{schema}")
        if constraints is None:
            constraints = connection.engine.execute(
                BIGQUERY_FOREIGN_CONSTRAINTS.format(
                    project_id=project, schema_name=schema
                )
            )
            FK_CACHE[f"{project}.{schema}"] = constraints.fetchall()

        col_name = []
        table_constraints = [row for row in constraints if row.table_name == table_name]
        for table_constraint in table_constraints:
            col_name.append(
                {
                    "name": table_constraint.name,
                    "referred_schema": table_constraint.referred_schema,
                    "referred_table": table_constraint.referred_table,
                    "constrained_columns": [table_constraint.constrained_columns],
                    "referred_columns": [table_constraint.referred_columns],
                }
            )
        return col_name
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(
            f"Error while fetching foreign key constraint error for table [{schema}.{table_name}]: {exc}"
        )
        return []


def parse_bigqeury_labels(labels: str) -> List[Tuple[str, str]]:
    """
    This function is used to parse BigQuery label string into a list of tuples.
    """
    return re.findall(r'STRUCT\("([^"]+)",\s*"([^"]+)"\)', labels)
