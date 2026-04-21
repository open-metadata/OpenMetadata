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
QuestDB source module
"""
from typing import Iterable, Optional

from metadata.generated.schema.entity.services.connections.database.questdbConnection import (
    QuestDBConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.questdb.connection import (
    QUESTDB_DEFAULT_DATABASE,
)


class QuestDBSource(CommonDbSourceService):
    """
    QuestDB is a single-database (``qdb``), single-schema (``public``) system
    exposing ``pg_catalog`` and ``information_schema`` over the PostgreSQL wire
    protocol. Default introspection via ``CommonDbSourceService`` works; we
    only customize the database display name so it defaults to ``qdb`` instead
    of the generic ``default``.
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, QuestDBConnection):
            raise InvalidSourceException(
                f"Expected QuestDBConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        yield self.service_connection.databaseName or QUESTDB_DEFAULT_DATABASE
