# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false
from typing import Any

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.base_processor import AutoClassificationProcessor
from metadata.pii.processor import PIIProcessor
from metadata.pii.tag_processor import TagAnalyzerGenerator, TagProcessor


def create_pii_processor(
    metadata: OpenMetadata[Any, Any], openmetadata_config: OpenMetadataWorkflowConfig
) -> AutoClassificationProcessor:
    if getattr(openmetadata_config.processor, "type") == "tag-pii-processor":
        return TagProcessor(
            config=parse_workflow_config_gracefully(openmetadata_config.model_dump()),
            metadata=metadata,
            generate_tag_analyzers=TagAnalyzerGenerator(
                metadata=metadata,
            ),
        )
    return PIIProcessor.create(
        openmetadata_config.model_dump(),
        metadata,
    )
