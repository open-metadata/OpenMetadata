#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Bind BigQuery observability queries to the attached table's project."""

from copy import deepcopy

from google.cloud.bigquery.dbapi import Connection as BigQueryDBAPIConnection
from google.cloud.bigquery.job.query import QueryJobConfig
from google.cloud.bigquery.query import ConnectionProperty
from sqlalchemy import event
from sqlalchemy.engine import Connection, Engine

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.profiler_utils import get_context_entities


def bind_connection_to_table(connection: Engine, table: Table | None, metadata: OpenMetadata) -> Engine:
    """Select the data project independently of the client's billing project."""
    if table is None:
        raise ValueError("BigQuery table must resolve to a target database before connecting")
    _, database, _ = get_context_entities(entity=table, metadata=metadata)
    if database is None:
        raise ValueError("BigQuery table must resolve to a target database before connecting")
    job_config = deepcopy(connection.get_execution_options().get("job_config")) or QueryJobConfig()
    inherit_properties = "connectionProperties" not in job_config.to_api_repr().get("query", {})
    project = model_str(database.name)
    _set_target_project(job_config=job_config, project=project)
    bound = connection.execution_options(job_config=job_config)

    @event.listens_for(bound, "engine_connect")
    def copy_job_config(conn: Connection) -> None:
        # The BigQuery DBAPI mutates query parameters; connections must not share them.
        config = deepcopy(job_config)
        dbapi_connection = conn.connection.dbapi_connection
        if inherit_properties and isinstance(dbapi_connection, BigQueryDBAPIConnection):
            # DBAPI exposes its effective client only here; use the actual pooled connection.
            defaults: QueryJobConfig | None = getattr(dbapi_connection._client, "default_query_job_config", None)
            if defaults is not None:
                config.connection_properties = deepcopy(defaults.connection_properties)
        _set_target_project(job_config=config, project=project)
        conn.execution_options(job_config=config)

    return bound


def _set_target_project(job_config: QueryJobConfig, project: str) -> None:
    job_config.connection_properties = [
        prop for prop in job_config.connection_properties if prop.key != "dataset_project_id"
    ] + [ConnectionProperty(key="dataset_project_id", value=project)]
