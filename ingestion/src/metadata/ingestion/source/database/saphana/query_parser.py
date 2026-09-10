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
SAP Hana query parsing module
"""

from abc import ABC

from metadata.generated.schema.entity.services.connections.database.sapHanaConnection import (
    SapHanaConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SapHanaQueryParserSource(QueryParserSource, ABC):
    """
    SAP Hana base for usage and lineage
    """

    filters: str

    database_field = "database_name"
    schema_field = "schema_name"

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):  # pyright: ignore[reportMissingTypeArgument]
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SapHanaConnection = config.serviceConnection.root.config  # pyright: ignore[reportAssignmentType, reportOptionalMemberAccess]
        if not isinstance(connection, SapHanaConnection):
            raise InvalidSourceException(f"Expected SapHanaConnection, but got {connection}")
        return cls(config, metadata)
