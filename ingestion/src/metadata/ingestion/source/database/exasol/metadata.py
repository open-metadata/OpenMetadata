from typing import Optional, cast

from metadata.generated.schema.entity.services.connections.database.exasolConnection import (
    ExasolConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService


class ExasolSource(CommonDbSourceService):
    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        if config.serviceConnection is None:
            raise InvalidSourceException("Missing service connection")
        connection = cast(ExasolConnection, config.serviceConnection.root.config)
        if not isinstance(connection, ExasolConnection):
            raise InvalidSourceException(
                f"Expected ExasolConnection, but got {connection}"
            )
        return cls(config, metadata)
