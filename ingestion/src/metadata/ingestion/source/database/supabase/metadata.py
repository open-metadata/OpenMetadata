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
Supabase source module.

Supabase is a hosted Postgres platform, so this connector extends
PostgresSource directly and reuses all its metadata extraction logic.
The only Supabase-specific behaviour is:
- Connection type validation against SupabaseConnection
- Schema description map reuse from Postgres
"""
import traceback
from typing import Iterable, Optional

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.supabaseConnection import (
    SupabaseConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.ingestion.source.database.postgres.metadata import PostgresSource
from metadata.ingestion.source.database.supabase.queries import (
    SUPABASE_GET_DB_NAMES,
    SUPABASE_SCHEMA_COMMENTS,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import get_schema_descriptions

logger = ingestion_logger()


class SupabaseSource(PostgresSource, MultiDBSource):
    """
    Implements metadata extraction for Supabase.

    Supabase is standard Postgres under the hood, so all table, column,
    view, lineage, and stored-procedure logic is inherited from PostgresSource.
    This class only overrides connection validation and database enumeration.
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SupabaseConnection = config.serviceConnection.root.config
        if not isinstance(connection, SupabaseConnection):
            raise InvalidSourceException(
                f"Expected SupabaseConnection, but got {connection}"
            )
        return cls(config, metadata)

    def set_schema_description_map(self) -> None:
        self.schema_desc_map = get_schema_descriptions(
            self.engine, SUPABASE_SCHEMA_COMMENTS
        )

    def get_database_names_raw(self) -> Iterable[str]:
        yield from self._execute_database_query(SUPABASE_GET_DB_NAMES)

    def get_database_names(self) -> Iterable[str]:
        if not self.config.serviceConnection.root.config.ingestAllDatabases:
            configured_db = self.config.serviceConnection.root.config.database
            self.set_inspector(database_name=configured_db)
            self.set_schema_description_map()
            yield configured_db
        else:
            for new_database in self.get_database_names_raw():
                database_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.get().database_service,
                    database_name=new_database,
                )

                if filter_by_database(
                    self.source_config.databaseFilterPattern,
                    (
                        database_fqn
                        if self.source_config.useFqnForFiltering
                        else new_database
                    ),
                ):
                    self.status.filter(database_fqn, "Database Filtered Out")
                    continue

                try:
                    self.set_inspector(database_name=new_database)
                    self.set_schema_description_map()
                    yield new_database
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error trying to connect to database {new_database}: {exc}"
                    )
