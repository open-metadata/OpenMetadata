from abc import ABC
from typing import Optional

from metadata.generated.schema.entity.services.connections.database.exasolConnection import (
    ExasolConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ExasolQueryParserSource(QueryParserSource, ABC):
    """
    Exasol base for Usage and Lineage
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: ExasolConnection = config.serviceConnection.root.config
        if not isinstance(connection, ExasolConnection):
            raise InvalidSourceException(
                f"Expected ExasolConnection, but got {connection}"
            )
        return cls(config, metadata)
