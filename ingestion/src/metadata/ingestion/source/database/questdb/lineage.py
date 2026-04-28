#  Copyright 2025 OpenMetadata
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
QuestDB lineage module
"""
import traceback
from typing import Iterable, Optional, Union

from sqlalchemy import text

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.services.connections.database.questdbConnection import (
    QuestDBConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import Source
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.sql_lineage import _create_lineage_by_table_name
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.questdb.connection import (
    QUESTDB_DEFAULT_DATABASE,
)
from metadata.ingestion.source.database.questdb.models import QuestDBMaterializedViewRow
from metadata.ingestion.source.database.questdb.queries import (
    QUESTDB_GET_MATERIALIZED_VIEWS,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

_QUESTDB_PUBLIC_SCHEMA = "public"


class QuestDBLineageSource(LineageSource):
    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: QuestDBConnection = config.serviceConnection.root.config
        if not isinstance(connection, QuestDBConnection):
            raise InvalidSourceException(
                f"Expected QuestDBConnection, but got {connection}"
            )
        return cls(config, metadata)

    def yield_view_lineage(
        self,
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        yield from super().yield_view_lineage()
        yield from self._yield_materialized_view_lineage()

    def _yield_materialized_view_lineage(
        self,
    ) -> Iterable[Either[AddLineageRequest]]:
        database_name = self.service_connection.databaseName or QUESTDB_DEFAULT_DATABASE
        try:
            for engine in self.get_engine():
                with engine.connect() as conn:
                    rows = conn.execute(text(QUESTDB_GET_MATERIALIZED_VIEWS))
                    for row in rows:
                        try:
                            mat_row = QuestDBMaterializedViewRow(**dict(row._mapping))
                            yield from _create_lineage_by_table_name(
                                metadata=self.metadata,
                                from_table=mat_row.base_table_name,
                                to_table=mat_row.view_name,
                                service_names=[self.config.serviceName],
                                database_name=database_name,
                                schema_name=_QUESTDB_PUBLIC_SCHEMA,
                                masked_query=mat_row.view_sql or "",
                                column_lineage_map={},
                                lineage_source=Source.ViewLineage,
                            )
                        except Exception as exc:
                            logger.debug(traceback.format_exc())
                            logger.warning(
                                f"Error creating lineage for materialized view "
                                f"[{row}]: {exc}"
                            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching materialized views for lineage: {exc}")
