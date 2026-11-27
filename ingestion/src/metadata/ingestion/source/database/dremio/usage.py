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
Dremio usage, read from the job history through the REST API
"""

import traceback
from collections.abc import Iterable
from typing import TYPE_CHECKING, cast

from metadata.generated.schema.entity.services.connections.database.dremioConnection import (
    DremioConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.tableQuery import TableQueries
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import create_connection
from metadata.ingestion.source.database.dremio.queries import (
    CLOUD_JOBS,
    SOFTWARE_JOBS,
    USAGE_FILTER,
    get_jobs_query,
    iter_table_queries,
)
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from metadata.generated.schema.metadataIngestion.databaseServiceQueryUsagePipeline import (
        DatabaseServiceQueryUsagePipeline,
    )
    from metadata.ingestion.source.database.dremio.client import DremioClient

logger = ingestion_logger()


class DremioUsageSource(UsageSource):
    """Dremio has no SQLAlchemy engine: queries go through the REST client"""

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata, get_engine=False)
        self._connection = create_connection(self.service_connection)
        self.client: DremioClient = self._connection.client  # pyright: ignore[reportOptionalMemberAccess]
        self.jobs = CLOUD_JOBS if self.client.is_cloud else SOFTWARE_JOBS

    @classmethod
    def create(cls, config_dict: dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config if config.serviceConnection else None
        if not isinstance(connection, DremioConnection):
            raise InvalidSourceException(f"Expected DremioConnection, but got {connection}")
        return cls(config, metadata)

    def yield_table_queries(self) -> Iterable[TableQueries]:  # pyright: ignore[reportIncompatibleMethodOverride]
        """Every run of a query counts: they are not deduplicated"""
        query = get_jobs_query(
            self.jobs,
            self.start,
            self.end,
            USAGE_FILTER,
            cast("DatabaseServiceQueryUsagePipeline", self.source_config).resultLimit,
        )
        try:
            rows = self.client.execute_sql(query)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error("Failed to read the Dremio job history from %s: %s", self.jobs.name, exc)
            return
        self.warn_if_query_log_truncated(len(rows), "usage")
        queries = list(iter_table_queries(rows, self.jobs, self.config.serviceName or ""))
        logger.info("Read %d usage queries from Dremio", len(queries))
        if queries:
            yield TableQueries(queries=queries)

    def close(self) -> None:
        try:
            super().close()
        finally:
            self._connection.close()  # pyright: ignore[reportOptionalMemberAccess]
