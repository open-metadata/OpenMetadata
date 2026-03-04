# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false
from typing import Any, List, Optional

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.base_processor import AutoClassificationProcessor
from metadata.pii.processor import PIIProcessor
from metadata.pii.tag_processor import TagProcessor


def create_pii_processor(
    metadata: OpenMetadata[Any, Any],
    openmetadata_config: OpenMetadataWorkflowConfig,
    classification_filter: Optional[List[str]] = None,
) -> AutoClassificationProcessor:
    processor_type = getattr(openmetadata_config.processor, "type", "tag-pii-processor")
    if processor_type == "tag-pii-processor":
        return TagProcessor(
            config=parse_workflow_config_gracefully(openmetadata_config.model_dump()),
            metadata=metadata,
            classification_filter=classification_filter,
        )
    return PIIProcessor.create(
        openmetadata_config.model_dump(),
        metadata,
    )
