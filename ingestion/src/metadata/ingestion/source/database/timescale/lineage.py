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
from typing import Iterable

from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.postgres.lineage import PostgresLineageSource
from metadata.ingestion.source.database.timescale.queries import (
    TIMESCALE_CHECK_EXTENSION,
    TIMESCALE_GET_CONTINUOUS_AGGREGATE_DEFINITIONS,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class TimescaleLineageSource(PostgresLineageSource):
    """
    TimescaleDB lineage source that extends PostgreSQL lineage
    to include continuous aggregates (auto-refreshing materialized views)
    """

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

    def yield_view_lineage(self) -> Iterable[Either[TableQuery]]:
        """
        Yield lineage from continuous aggregates in addition to regular views
        """
        yield from super().yield_view_lineage()

        if self.timescaledb_installed:
            yield from self._yield_continuous_aggregate_lineage()

    def _yield_continuous_aggregate_lineage(self) -> Iterable[Either[TableQuery]]:
        """
        Get lineage from TimescaleDB continuous aggregates.

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
                    view_definition = f"CREATE VIEW {row.view_schema}.{row.view_name} AS {row.view_definition}"

                    yield Either(
                        right=TableQuery(
                            dialect=self.dialect.value,
                            query=view_definition,
                            databaseName=self.context.get().database,
                            databaseSchema=row.view_schema,
                            serviceName=self.config.serviceName,
                        )
                    )

                    logger.debug(
                        f"Extracted continuous aggregate lineage: {row.view_schema}.{row.view_name}"
                    )

                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Failed to process continuous aggregate {row.view_schema}.{row.view_name}: {exc}"
                    )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to extract continuous aggregate lineage: {exc}")
