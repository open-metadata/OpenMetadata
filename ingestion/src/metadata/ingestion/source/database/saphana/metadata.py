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
SAP Hana source module
"""
from typing import Iterable, Optional

from metadata.generated.schema.entity.services.connections.database.sapHanaConnection import (
    SapHanaConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SaphanaSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Mysql Source
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SapHanaConnection = config.serviceConnection.root.config
        if not isinstance(connection, SapHanaConnection):
            raise InvalidSourceException(
                f"Expected SapHanaConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        """
        Check if the db is configured, or query the name
        """
        self._connection_map = {}  # Lazy init as well
        self._inspector_map = {}

        if getattr(self.service_connection.connection, "database"):
            yield self.service_connection.connection.database

        else:
            try:
                yield self.connection.execute(
                    "SELECT DATABASE_NAME FROM M_DATABASE"
                ).fetchone()[0]
            except Exception as err:
                raise RuntimeError(
                    f"Error retrieving database name from the source - [{err}]."
                    " A way through this error is by specifying the `database` in the service connection."
                )

    def get_raw_database_schema_names(self) -> Iterable[str]:
        if self.service_connection.connection.__dict__.get("databaseSchema"):
            yield self.service_connection.connection.databaseSchema
        else:
            for schema_name in self.inspector.get_schema_names():
                yield schema_name
