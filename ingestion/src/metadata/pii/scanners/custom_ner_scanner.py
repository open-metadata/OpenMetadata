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
Enhanced NER Scanner that uses custom recognizers from OpenMetadata classifications.
"""
from typing import Dict, List, Optional, Set, Tuple

from presidio_analyzer import RecognizerResult

from metadata.generated.schema.entity.classification.classification import (
    AutoClassificationConfig,
    Classification,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.pii.algorithms.presidio_recognizer_factory import RecognizerRegistry
from metadata.pii.algorithms.presidio_utils import build_analyzer_engine
from metadata.pii.constants import SUPPORTED_LANG
from metadata.utils.logger import pii_logger

logger = pii_logger()


class CustomNERScanner:
    """NER Scanner that uses custom recognizers from OpenMetadata configurations."""

    def __init__(
        self,
        classifications: List[Classification],
        tags: List[Tag],
        model_name: Optional[str] = None,
    ):
        """
        Initialize the scanner with classifications and tags.

        Args:
            classifications: List of classifications with auto-classification config
            tags: List of tags with recognizer configurations
            model_name: Optional spaCy model name
        """
        self.classifications = {c.fullyQualifiedName: c for c in classifications}
        self.tags = {t.fullyQualifiedName: t for t in tags}
        self.tag_by_classification: Dict[
            str, List[Tag]
        ] = self._group_tags_by_classification()

        # Build base analyzer engine
        self.analyzer_engine = (
            build_analyzer_engine(model_name) if model_name else build_analyzer_engine()
        )

        # Register custom recognizers
        self.recognizer_registry = RecognizerRegistry()
        self._register_custom_recognizers()

    def _group_tags_by_classification(self) -> Dict[str, List[Tag]]:
        """Group tags by their classification."""
        grouped = {}
        for tag in self.tags.values():
            if tag.classification:
                classification_fqn = tag.classification.fullyQualifiedName
                if classification_fqn not in grouped:
                    grouped[classification_fqn] = []
                grouped[classification_fqn].append(tag)
        return grouped

    def _register_custom_recognizers(self) -> None:
        """Register all custom recognizers from tags."""
        for tag in self.tags.values():
            if tag.autoClassificationEnabled and tag.recognizers:
                self.recognizer_registry.register_tag_recognizers(tag)

                # Add recognizers to the analyzer engine
                for recognizer in self.recognizer_registry.get_recognizers_for_tag(
                    tag.fullyQualifiedName
                ):
                    recognizer.supported_language = SUPPORTED_LANG
                    self.analyzer_engine.registry.add_recognizer(recognizer)
                    logger.info(
                        f"Registered recognizer {recognizer.name} for tag {tag.fullyQualifiedName}"
                    )

    def scan_text(
        self, text: str, classification_fqn: Optional[str] = None
    ) -> List[TagLabel]:
        """
        Scan text for PII using custom recognizers.

        Args:
            text: Text to scan
            classification_fqn: Optional classification to limit scanning to

        Returns:
            List of TagLabel objects for detected entities
        """
        if not text:
            return []

        # Analyze text with all recognizers
        results = self.analyzer_engine.analyze(
            text=text,
            language=SUPPORTED_LANG,
            return_decision_process=True,
        )

        # Map results to tags
        tag_labels = self._map_results_to_tags(results, classification_fqn)

        # Apply conflict resolution if needed
        if classification_fqn:
            classification = self.classifications.get(classification_fqn)
            if classification and classification.mutuallyExclusive:
                tag_labels = self._resolve_conflicts(
                    tag_labels, classification.autoClassificationConfig
                )

        return tag_labels

    def scan_column_name(
        self, column_name: str, classification_fqn: Optional[str] = None
    ) -> List[TagLabel]:
        """
        Scan a column name for patterns indicating PII.

        Args:
            column_name: The column name to scan
            classification_fqn: Optional classification to limit scanning to

        Returns:
            List of TagLabel objects for detected entities
        """
        # Column names often have patterns like "user_ssn", "email_address"
        # We can use the same scanning but with adjusted confidence
        results = self.scan_text(column_name, classification_fqn)

        # Boost confidence for column name matches
        for label in results:
            if label.confidence:
                label.confidence = min(1.0, label.confidence * 1.2)

        return results

    def _map_results_to_tags(
        self, results: List[RecognizerResult], classification_fqn: Optional[str] = None
    ) -> List[TagLabel]:
        """
        Map Presidio recognizer results to OpenMetadata tag labels.

        Args:
            results: List of recognizer results from Presidio
            classification_fqn: Optional classification to filter tags

        Returns:
            List of TagLabel objects
        """
        tag_labels = []
        detected_entities: Set[Tuple[str, float]] = set()

        for result in results:
            # Find tags that have recognizers for this entity type
            matching_tags = self._find_matching_tags(
                result.entity_type, classification_fqn
            )

            for tag in matching_tags:
                # Check if confidence meets threshold
                confidence_threshold = (
                    self.recognizer_registry.get_tag_confidence_threshold(
                        tag.fullyQualifiedName
                    )
                )

                if result.score >= confidence_threshold:
                    # Create tag label
                    tag_label = TagLabel(
                        tagFQN=tag.fullyQualifiedName,
                        confidence=result.score,
                        source="auto-classification",
                        detectedEntity=result.entity_type,
                    )
                    tag_labels.append(tag_label)
                    detected_entities.add((tag.fullyQualifiedName, result.score))

        return tag_labels

    def _find_matching_tags(
        self, entity_type: str, classification_fqn: Optional[str] = None
    ) -> List[Tag]:
        """
        Find tags that have recognizers for the given entity type.

        Args:
            entity_type: The entity type detected by Presidio
            classification_fqn: Optional classification to filter tags

        Returns:
            List of matching tags
        """
        matching_tags = []

        tags_to_check = []
        if classification_fqn and classification_fqn in self.tag_by_classification:
            tags_to_check = self.tag_by_classification[classification_fqn]
        else:
            tags_to_check = list(self.tags.values())

        for tag in tags_to_check:
            if not tag.autoClassificationEnabled or not tag.recognizers:
                continue

            for recognizer in tag.recognizers:
                if recognizer.recognizerConfig and hasattr(
                    recognizer.recognizerConfig, "supportedEntity"
                ):
                    if recognizer.recognizerConfig.supportedEntity == entity_type:
                        matching_tags.append(tag)
                        break

        return matching_tags

    def _resolve_conflicts(
        self,
        tag_labels: List[TagLabel],
        config: Optional[AutoClassificationConfig],
    ) -> List[TagLabel]:
        """
        Resolve conflicts when multiple tags match for a mutually exclusive classification.

        Args:
            tag_labels: List of detected tag labels
            config: Auto-classification configuration

        Returns:
            List with at most one tag label (the winner of conflict resolution)
        """
        if not tag_labels or not config:
            return tag_labels

        if len(tag_labels) <= 1:
            return tag_labels

        # Apply conflict resolution strategy
        if config.conflictResolution == "highest_confidence":
            # Sort by confidence and return the highest
            sorted_labels = sorted(
                tag_labels, key=lambda x: x.confidence or 0, reverse=True
            )
            return [sorted_labels[0]]

        elif config.conflictResolution == "highest_priority":
            # Sort by tag priority
            sorted_labels = sorted(
                tag_labels,
                key=lambda x: self.recognizer_registry.get_tag_priority(x.tagFQN),
                reverse=True,
            )
            return [sorted_labels[0]]

        elif config.conflictResolution == "most_specific":
            # For now, use confidence as a proxy for specificity
            # In the future, we could use pattern complexity or other metrics
            sorted_labels = sorted(
                tag_labels, key=lambda x: x.confidence or 0, reverse=True
            )
            return [sorted_labels[0]]

        # Default: return highest confidence
        sorted_labels = sorted(
            tag_labels, key=lambda x: x.confidence or 0, reverse=True
        )
        return [sorted_labels[0]]

    def get_supported_classifications(self) -> List[str]:
        """Get list of classifications that have auto-classification enabled."""
        enabled_classifications = []
        for classification in self.classifications.values():
            if (
                classification.autoClassificationConfig
                and classification.autoClassificationConfig.enabled
            ):
                enabled_classifications.append(classification.fullyQualifiedName)
        return enabled_classifications
