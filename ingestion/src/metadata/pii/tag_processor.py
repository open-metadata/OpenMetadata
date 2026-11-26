from collections.abc import Callable, Sequence
from typing import Any

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.generated.schema.type.tagLabelMetadata import TagLabelMetadata
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.algorithms.presidio_utils import load_nlp_engine
from metadata.pii.algorithms.tag_scoring import ScoreTagsForColumnService
from metadata.pii.base_processor import AutoClassificationProcessor
from metadata.pii.classification_manager import (
    ClassificationManager,
    ClassificationManagerInterface,
)
from metadata.pii.conflict_resolver import ConflictResolver
from metadata.pii.models import ScoredTag
from metadata.utils.fqn import split_raw_name
from metadata.utils.logger import profiler_logger

logger = profiler_logger()

ScoreTagsForColumn = Callable[[Column, Sequence[Any], list[Tag]], list[ScoredTag]]


def _classification_fqn(tag_fqn: str | None) -> str | None:
    # Keep quotes to match stored classification FQNs.
    parts = split_raw_name(tag_fqn) if tag_fqn else []
    return parts[0] if len(parts) > 1 else None


class TagProcessor(AutoClassificationProcessor):
    """
    Generic auto-classification processor that supports multiple classifications
    and respects classification-level and tag-level configuration.
    """

    name = "Tag Classification Processor"

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
        classification_manager: ClassificationManagerInterface | None = None,
        score_tags_for_column: ScoreTagsForColumn | None = None,
        classification_filter: list[str] | None = None,
        max_tags_per_column: int = 10,
    ) -> None:
        super().__init__(config, metadata)
        self.confidence_threshold = self.source_config.confidence / 100
        self.classification_filter = classification_filter
        self.max_tags_per_column = max_tags_per_column
        self.classification_language: ClassificationLanguage = (
            self.source_config.classificationLanguage
            if self.source_config.classificationLanguage
            else ClassificationLanguage.en
        )

        # Initialize new components
        if classification_manager is None:
            classification_manager = ClassificationManager(metadata)
        self.run_manager = classification_manager

        self.conflict_resolver = ConflictResolver()

        # Get enabled classifications and their configs
        self.enabled_classifications = self.run_manager.get_enabled_classifications(filter_names=classification_filter)

        # Get all enabled tags with recognizers from enabled classifications
        self.candidate_tags = self.run_manager.get_enabled_tags(classifications=self.enabled_classifications)

        # Service that runs analyzers
        if score_tags_for_column is None:
            score_tags_for_column = ScoreTagsForColumnService(
                nlp_engine=load_nlp_engine(classification_language=self.classification_language),
                language=self.classification_language,
            )
        self.score_tags_for_column = score_tags_for_column

        logger.info(
            f"TagProcessor initialized with {len(self.enabled_classifications)} "
            f"classifications and {len(self.candidate_tags)} candidate tags "
            f"using language '{self.classification_language.value}'"
        )

    @staticmethod
    def build_tag_label(scored_tag: ScoredTag) -> TagLabel:
        """Build a TagLabel from a ScoredTag."""
        metadata = None
        if scored_tag.recognizer_metadata:
            metadata = TagLabelMetadata(recognizer=scored_tag.recognizer_metadata)

        tag_label = TagLabel(
            tagFQN=scored_tag.tag.fullyQualifiedName,
            source=TagSource.Classification,
            state=State.Suggested,
            labelType=LabelType.Generated,
            reason=scored_tag.reason,
            metadata=metadata,
        )

        return tag_label  # noqa: RET504

    def filter_tags_to_analyze(self, column: Column, candidate_tags: list[Tag]) -> list[Tag]:
        """
        Filter candidate tags based on already-applied tags and mutually exclusive
        classification constraints.

        Returns only tags that should be analyzed for this column.
        """
        existing_tag_fqns = {tag.tagFQN.root for tag in (column.tags or []) if tag.tagFQN}

        exclusive_fqns = {
            classification.fullyQualifiedName.root
            for classification in self.enabled_classifications
            if classification.mutuallyExclusive
        }
        occupied = {
            _classification_fqn(tag.tagFQN.root)
            for tag in (column.tags or [])
            if tag.tagFQN and tag.source == TagSource.Classification
        } & exclusive_fqns

        tags_to_analyze = []
        for tag in candidate_tags:
            tag_fqn = tag.fullyQualifiedName
            if tag_fqn in existing_tag_fqns:
                continue

            reference_fqn = tag.classification.fullyQualifiedName if tag.classification else None
            tag_classification_fqn = reference_fqn or _classification_fqn(tag_fqn)
            if tag_classification_fqn in occupied:
                logger.debug(
                    "Skipping tag %s because mutually exclusive classification %s already has a tag",
                    tag_fqn,
                    tag_classification_fqn,
                )
                continue

            tags_to_analyze.append(tag)

        return tags_to_analyze

    def create_column_tag_labels(self, column: Column, sample_data: Sequence[Any]) -> Sequence[TagLabel]:
        """
        Create tags for the column based on sample data.
        Supports multiple tags from different classifications.
        """
        # Skip if no enabled classifications
        if not self.enabled_classifications:
            logger.debug("No enabled classifications, skipping auto-classification")
            return []

        # Filter candidate tags based on already-applied tags and
        # mutually exclusive classification constraints
        tags_to_analyze = self.filter_tags_to_analyze(column, self.candidate_tags)

        if not tags_to_analyze:
            logger.debug(
                f"No new tags to analyze for column {column.name.root} "
                f"(all {len(self.candidate_tags)} candidates already applied)"
            )
            return []

        logger.debug(f"Analyzing {len(tags_to_analyze)} tags for column {column.name.root}")

        # Run analyzers
        scored_tags = self.score_tags_for_column(column, sample_data, tags_to_analyze)
        scored_tags = [scored_tag for scored_tag in scored_tags if scored_tag.score >= self.confidence_threshold]

        if not scored_tags:
            logger.debug(f"No tags scored above threshold for column {column.name.root}")
            return []

        logger.debug(
            f"Scored {len(scored_tags)} tags for column {column.name.root}, "
            f"top score: {max(t.score for t in scored_tags):.3f}"
        )

        # Apply conflict resolution
        resolved_tags = self.conflict_resolver.resolve_conflicts(
            scored_tags=scored_tags,
            enabled_classifications=self.enabled_classifications,
        )

        # Limit total tags per column
        if len(resolved_tags) > self.max_tags_per_column:
            logger.warning(
                f"Column {column.name.root} has {len(resolved_tags)} tags, limiting to {self.max_tags_per_column}"
            )
            resolved_tags = sorted(resolved_tags, key=lambda t: t.score, reverse=True)[: self.max_tags_per_column]

        logger.debug(
            f"Applied {len(resolved_tags)} tags to column {column.name.root}: "
            f"{[t.tag.fullyQualifiedName for t in resolved_tags]}"
        )

        # Build TagLabels
        return [self.build_tag_label(scored_tag) for scored_tag in resolved_tags]
