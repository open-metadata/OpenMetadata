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


def _classification_fqn_from_tag_fqn(tag_fqn: str | None) -> str | None:
    """Return the owning classification FQN of a tag FQN, or ``None``.

    A tag's classification is the FIRST segment of its FQN (the classification
    root), e.g. ``PII.Sensitive.Email`` -> ``PII``. A single-level
    ``rsplit(".", 1)`` only works for non-nested tags; for a nested tag it
    yields the parent tag FQN (``PII.Sensitive``) instead of the
    classification (``PII``), so the mutually-exclusive classification lookup
    silently misses. Splitting quote-aware (so classification names that
    contain a dot, stored quoted in the FQN, are handled) and taking the
    first segment resolves the classification for tags at any depth.

    The first segment is returned verbatim (with its quotes intact) so it
    matches the key form used in ``classification_map`` (the classification
    ``fullyQualifiedName.root``): a classification named ``My.PII`` is stored
    by the server as the quoted FQN ``"My.PII"``, and an existing tag under
    it carries the quoted first segment ``"My.PII"`` in its FQN. Unquoting
    here would yield ``My.PII`` and make the lookup miss.
    """
    if not tag_fqn or "." not in tag_fqn:
        return None
    segments = split_raw_name(tag_fqn)
    if not segments:
        return None
    return segments[0] or None


def _classification_fqn_from_tag(tag: Tag) -> str | None:
    """Return the classification FQN of a candidate ``Tag``.

    Prefer the classification reference already fetched on the tag rather
    than reconstructing it from the FQN; fall back to the first FQN segment
    when the reference is not populated (e.g. a tag without a classification
    back-reference).
    """
    classification = tag.classification
    if classification is not None:
        classification_fqn = classification.fullyQualifiedName
        if classification_fqn:
            return classification_fqn
    return _classification_fqn_from_tag_fqn(tag.fullyQualifiedName)


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

        # Only Classification-sourced labels can occupy a mutually-exclusive
        # classification. Glossary terms (TagSource.Glossary) may share the
        # FQN string form with a classification tag (e.g. a glossary named
        # "PII" with the nested term "Customer.Email" yields FQN
        # "PII.Customer.Email"), but they do not reserve the classification;
        # including them would falsely mark a same-named mutually-exclusive
        # classification as occupied and skip all its candidates.
        existing_classification_tag_fqns = {
            tag.tagFQN.root for tag in (column.tags or []) if tag.tagFQN and tag.source == TagSource.Classification
        }

        # Build classification lookup map keyed by classification FQN. A tag's
        # classification is the FIRST segment of its FQN (the classification
        # root), not the prefix before the last dot: ``rsplit(".", 1)`` only
        # works for non-nested tags (one dot) and for a nested tag such as
        # ``PII.Sensitive.Email`` it yields the parent tag FQN
        # ``PII.Sensitive`` instead of the classification ``PII``, so the
        # mutually-exclusive lookup silently misses.
        classification_map = {
            classification.fullyQualifiedName.root: classification for classification in self.enabled_classifications
        }

        # Identify mutually exclusive classifications that already have tags applied
        mutually_exclusive_classifications_with_tags = set()
        for existing_tag_fqn in existing_classification_tag_fqns:
            classification_fqn = _classification_fqn_from_tag_fqn(existing_tag_fqn)
            if classification_fqn is None:
                continue
            classification = classification_map.get(classification_fqn)
            if classification and classification.mutuallyExclusive:
                mutually_exclusive_classifications_with_tags.add(classification_fqn)

        # Filter candidate tags
        tags_to_analyze = []
        for tag in candidate_tags:
            tag_fqn = tag.fullyQualifiedName
            # Skip already-applied tags
            if tag_fqn in existing_tag_fqns:
                continue

            # Use the tag's already-fetched classification reference rather than
            # reconstructing the classification from the FQN, which breaks for
            # nested tags. Fall back to the first FQN segment when the reference
            # is not populated.
            tag_classification_fqn = _classification_fqn_from_tag(tag)

            # Skip if tag belongs to a mutually exclusive classification
            # that already has a tag applied
            if tag_classification_fqn and tag_classification_fqn in mutually_exclusive_classifications_with_tags:
                logger.debug(
                    f"Skipping tag {tag_fqn} - mutually exclusive "
                    f"classification {tag_classification_fqn} already has a tag applied"
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
