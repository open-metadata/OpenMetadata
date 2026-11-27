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

from collections.abc import Iterable

from metadata.generated.schema.entity.services.connections.database.databendConnection import (
    DatabendConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import Source as WorkflowSource
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.databend.constants import (
    DEFAULT_CATALOG,
    SYSTEM_DATABASES,
)


class DatabendSource(CommonDbSourceService):
    """Extract the default catalog's databases, tables, views, columns, and comments from Databend.

    The Databend catalog maps to the OpenMetadata Database and each Databend database maps to an
    OpenMetadata schema.
    """

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

    def get_database_names(self) -> Iterable[str]:
        # Named after the catalog so the FQNs stay stable once external catalogs are supported.
        yield DEFAULT_CATALOG

    def get_raw_database_schema_names(self) -> Iterable[str]:
        if self.service_connection.databaseSchema:
            yield self.service_connection.databaseSchema
            return

        for database_name in self.inspector.get_schema_names():
            if database_name.lower() not in SYSTEM_DATABASES:
                yield database_name
