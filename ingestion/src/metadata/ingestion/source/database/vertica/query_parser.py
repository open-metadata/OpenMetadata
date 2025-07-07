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
Vertica usage module
"""
from abc import ABC
from typing import Iterable, Optional

from metadata.generated.schema.entity.services.connections.database.verticaConnection import (
    VerticaConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.ingestion.source.database.vertica.queries import VERTICA_LIST_DATABASES
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class VerticaQueryParserSource(QueryParserSource, ABC):
    """
    Vertica lineage parser source.

    Vertica V_MONITOR schema changes from database to database.
    To allow the lineage to happen for all the ingested databases
    we'll need to iterate over them.
    """

    filters: str

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: VerticaConnection = config.serviceConnection.root.config
        if not isinstance(connection, VerticaConnection):
            raise InvalidSourceException(
                f"Expected VerticaConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_table_query(self) -> Iterable[TableQuery]:
        database = self.config.serviceConnection.root.config.database
        if database:
            yield from super().get_table_query()
        else:
            results = self.engine.execute(VERTICA_LIST_DATABASES)
            for res in results:
                row = list(res)
                logger.info(f"Ingesting from database: {row[0]}")
                self.config.serviceConnection.root.config.database = row[0]
                self.engine = get_connection(self.service_connection)
                yield from super().get_table_query()
