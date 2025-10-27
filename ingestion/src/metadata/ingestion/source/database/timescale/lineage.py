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
TimescaleDB lineage module with continuous aggregate support
"""

import traceback
from typing import Iterable, Optional

from metadata.generated.schema.entity.services.connections.database.timescaleConnection import (
    TimescaleConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.postgres.lineage import PostgresLineageSource
from metadata.ingestion.source.database.timescale.queries import (
    TIMESCALE_CHECK_EXTENSION,
    TIMESCALE_GET_CONTINUOUS_AGGREGATE_DEFINITIONS,
)
from metadata.ingestion.source.models import TableView
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class TimescaleLineageSource(PostgresLineageSource):
    """
    TimescaleDB lineage source that extends PostgreSQL lineage
    to include continuous aggregates (auto-refreshing materialized views)
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create TimescaleLineageSource"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, (TimescaleConnection)):
            raise InvalidSourceException(
                f"Expected TimescaleConnection, but got {connection}"
            )
        return cls(config, metadata)

    def __init__(self, config, metadata):
        super().__init__(config, metadata)
        self.timescaledb_installed = False

    def prepare(self):
        """Check if TimescaleDB extension is installed"""
        super().prepare()
        try:
            result = self.engine.execute(TIMESCALE_CHECK_EXTENSION).first()
            self.timescaledb_installed = (
                result.timescaledb_installed if result else False
            )
            logger.info(
                f"TimescaleDB extension installed for lineage: {self.timescaledb_installed}"
            )
        except Exception as exc:
            logger.warning(f"Could not check TimescaleDB extension: {exc}")
            self.timescaledb_installed = False

    def view_lineage_producer(self) -> Iterable[TableView]:
        """
        Get view definitions from ES and add continuous aggregates
        """
        # First yield regular views from parent
        yield from super().view_lineage_producer()

        # Then yield continuous aggregates if TimescaleDB is installed
        if self.timescaledb_installed:
            yield from self._yield_continuous_aggregate_views()

    def _yield_continuous_aggregate_views(self) -> Iterable[TableView]:
        """
        Get TimescaleDB continuous aggregates as TableView objects.

        Continuous aggregates are auto-refreshing materialized views that
        provide clear column-level lineage from source hypertables.

        The view_definition contains the SELECT statement that defines
        the continuous aggregate, which OpenMetadata can parse for
        column-level lineage.
        """
        try:
            results = self.engine.execute(
                TIMESCALE_GET_CONTINUOUS_AGGREGATE_DEFINITIONS
            )

            for row in results:
                try:
                    yield TableView(
                        table_name=row.view_name,
                        schema_name=row.view_schema,
                        db_name=self.service_connection.database,
                        view_definition=row.view_definition,
                    )

                    logger.debug(
                        f"Extracted continuous aggregate view: {row.view_schema}.{row.view_name}"
                    )

                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Failed to process continuous aggregate {row.view_schema}.{row.view_name}: {exc}"
                    )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to extract continuous aggregate views: {exc}")
