from typing import Any, Sequence

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.algorithms.classifiers import TagClassifier
from metadata.pii.algorithms.utils import get_top_classes, normalize_scores
from metadata.pii.base_processor import AutoClassificationProcessor
from metadata.pii.constants import PII


class TagProcessor(AutoClassificationProcessor):
    name = "Tag Classification Processor"

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
    ) -> None:
        super().__init__(config, metadata)
        self.confidence_threshold = self.source_config.confidence / 100
        self._tolerance = 0.01

    @staticmethod
    def build_tag_label(tag_fqn: str) -> TagLabel:
        tag_label = TagLabel(
            tagFQN=tag_fqn,
            source=TagSource.Classification,
            state=State.Suggested,
            labelType=LabelType.Generated,
        )

        return tag_label

    def create_column_tag_labels(
        self, column: Column, sample_data: Sequence[Any]
    ) -> Sequence[TagLabel]:
        for tag in column.tags or []:
            if PII in tag.tagFQN.root:
                return []

        available_tags: list[Tag] = list(
            self.metadata.list_all_entities(
                entity=Tag,
                fields=[
                    "name",
                    "recognizers",
                    "fullyQualifiedName",
                    "provider",
                ],
            )
        )

        classifier = TagClassifier(
            available_tags=available_tags,
        )

        # Get the tags and confidence
        scores = classifier.predict_scores(
            sample_data, column_name=column.name.root, column_data_type=column.dataType
        )

        scores = normalize_scores(scores, tol=self._tolerance)

        # winner is at most 1 tag
        winner = get_top_classes(scores, 1, self.confidence_threshold)
        return [self.build_tag_label(tag) for tag in winner]
