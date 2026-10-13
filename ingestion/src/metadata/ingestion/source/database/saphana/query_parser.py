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
from typing import Any

from metadata.generated.schema.entity.services.connections.database.sapHanaConnection import (
    SapHanaConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.query_parser_source import QueryParserSource


class SapHanaQueryParserSource(QueryParserSource, ABC):
    """
    SAP Hana base for usage and lineage
    """

    filters: str

    @classmethod
    def create(
        cls,
        config_dict: dict[str, Any],
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> "SapHanaQueryParserSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SapHanaConnection = config.serviceConnection.root.config  # pyright: ignore[reportAssignmentType, reportOptionalMemberAccess]
        # The annotation above is what the schema promises, not what the config carries,
        # so this stays a real runtime check even though it reads as unreachable.
        if not isinstance(connection, SapHanaConnection):
            raise InvalidSourceException(f"Expected SapHanaConnection, but got {connection}")  # pyright: ignore[reportUnreachable]
        return cls(config, metadata)
