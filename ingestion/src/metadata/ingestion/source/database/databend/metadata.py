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
"""Databend metadata source."""

import traceback
from collections.abc import Iterable
from copy import deepcopy

from sqlalchemy import text

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.databendConnection import (
    DatabendConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import Source as WorkflowSource
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.connections.session import create_and_bind_thread_safe_session
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import create_connection
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.databend.constants import SYSTEM_DATABASES
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DatabendSource(CommonDbSourceService):
    """Extract databases, tables, views, columns, and comments from Databend."""

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        service_connection = config.serviceConnection
        connection = service_connection.root.config if service_connection else None
        if not isinstance(connection, DatabendConnection):
            raise InvalidSourceException(f"Expected DatabendConnection, but got {connection}")
        return cls(config, metadata)

    def set_inspector(self, database_name: str) -> None:
        """Create a fresh Catalog-scoped engine and reflection cache."""
        self._release_engine()
        logger.info(f"Ingesting from catalog: {database_name}")

        service_connection = deepcopy(self.service_connection)
        service_connection.catalog = database_name
        connection = create_connection(service_connection)
        if connection is None:
            raise RuntimeError("Databend connection class is not registered")
        self._connection = connection
        self.engine = connection.client
        self.session = create_and_bind_thread_safe_session(self.engine)
        self.connection_obj = self.engine

    def _validate_catalog(self, catalog_name: str) -> None:
        self.set_inspector(catalog_name)
        _ = self.inspector.get_schema_names()

    def get_database_names(self) -> Iterable[str]:
        configured_catalog = self.service_connection.catalog
        if configured_catalog:
            self._validate_catalog(configured_catalog)
            yield configured_catalog
            return

        catalogs = [row[0] for row in self.connection.execute(text("SHOW CATALOGS")) if row and row[0]]
        if not catalogs:
            raise RuntimeError("No accessible Databend catalogs found")
        selected_catalogs = 0
        ingested_catalogs = 0
        for catalog_name in catalogs:
            database_fqn = (
                fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.get().database_service,  # pyright: ignore[reportAttributeAccessIssue]
                    database_name=catalog_name,
                )
                or catalog_name
            )
            if filter_by_database(
                self.source_config.databaseFilterPattern,
                database_fqn if self.source_config.useFqnForFiltering else catalog_name,
            ):
                self.status.filter(database_fqn, "Database Filtered Out")
                continue

            selected_catalogs += 1
            try:
                self._validate_catalog(catalog_name)
                ingested_catalogs += 1
                yield catalog_name
            except Exception as exc:  # pylint: disable=broad-except
                stack_trace = traceback.format_exc()
                logger.warning(f"Error trying to ingest catalog {catalog_name}: {exc}")
                logger.debug(stack_trace)
                self.status.failed(
                    StackTraceError(
                        name=catalog_name,
                        error=f"Error trying to ingest catalog {catalog_name}: {exc}",
                        stackTrace=stack_trace,
                    )
                )

        if selected_catalogs and not ingested_catalogs:
            raise RuntimeError("Failed to ingest any selected Databend catalog")

    def get_raw_database_schema_names(self) -> Iterable[str]:
        if self.service_connection.databaseSchema:
            yield self.service_connection.databaseSchema
            return

        for database_name in self.inspector.get_schema_names():
            if database_name.lower() not in SYSTEM_DATABASES:
                yield database_name
