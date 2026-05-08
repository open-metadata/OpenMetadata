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
Utilities for building service connection configs for the sampler.
"""

from copy import deepcopy
from typing import cast

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.utils.bigquery_utils import copy_service_config


def build_database_service_conn_config(config: OpenMetadataWorkflowConfig, database: Database) -> DatabaseConnection:
    service_conn = config.source.serviceConnection
    if service_conn is None or service_conn.root is None:
        raise ValueError("serviceConnection is required for database sampler")

    conn_config = service_conn.root.config
    if isinstance(conn_config, BigQueryConnection):
        return copy_service_config(config, database.name.root)

    config_copy = deepcopy(conn_config)  # type: ignore[arg-type]
    if hasattr(config_copy, "supportsDatabase"):
        if hasattr(config_copy, "database"):
            config_copy.database = database.name.root  # type: ignore[union-attr]
        if hasattr(config_copy, "catalog"):
            config_copy.catalog = database.name.root  # type: ignore[union-attr]

    return cast("DatabaseConnection", config_copy)
