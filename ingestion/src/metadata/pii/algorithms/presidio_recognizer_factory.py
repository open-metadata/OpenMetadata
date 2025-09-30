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
Factory for creating Presidio recognizers from OpenMetadata recognizer configurations.
"""
import re
from typing import Dict, List, Optional, cast

from presidio_analyzer import EntityRecognizer
from presidio_analyzer import Pattern as PresidioPattern
from presidio_analyzer import PatternRecognizer as PresidioPatternRecognizer
from presidio_analyzer import predefined_recognizers

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.contextRecognizer import ContextRecognizer
from metadata.generated.schema.type.customRecognizer import CustomRecognizer
from metadata.generated.schema.type.denyListRecognizer import DenyListRecognizer
from metadata.generated.schema.type.patternRecognizer import PatternRecognizer
from metadata.generated.schema.type.predefinedRecognizer import PredefinedRecognizer
from metadata.generated.schema.type.recognizer import Recognizer
from metadata.generated.schema.type.recognizers.regexFlags import RegexFlags
from metadata.pii.algorithms.presidio_utils import apply_confidence_threshold
from metadata.utils.logger import pii_logger

logger = pii_logger()


class PresidioRecognizerFactory:
    """Factory for creating Presidio recognizers from OpenMetadata configurations."""

    @staticmethod
    def create_recognizer(recognizer_config: Recognizer) -> Optional[EntityRecognizer]:
        """
        Create a Presidio recognizer from an OpenMetadata recognizer configuration.

        Args:
            recognizer_config: The recognizer configuration from OpenMetadata
            tag_name: The name of the tag this recognizer belongs to

        Returns:
            A Presidio EntityRecognizer or None if creation fails
        """
        if not recognizer_config.enabled:
            return None

        config = recognizer_config.recognizerConfig.root

        if isinstance(config, PatternRecognizer):
            recognizer = PresidioRecognizerFactory._create_pattern_recognizer(
                config, recognizer_config
            )
        elif isinstance(config, DenyListRecognizer):
            recognizer = PresidioRecognizerFactory._create_deny_list_recognizer(
                config, recognizer_config
            )
        elif isinstance(config, ContextRecognizer):
            recognizer = PresidioRecognizerFactory._create_context_recognizer(
                config, recognizer_config
            )
        elif isinstance(config, CustomRecognizer):
            recognizer = PresidioRecognizerFactory._create_custom_recognizer(
                config, recognizer_config
            )
        elif isinstance(
            config, PredefinedRecognizer
        ):  # pyright: ignore[reportUnnecessaryIsInstance]
            recognizer = PresidioRecognizerFactory._create_predefined_recognizer(
                config, recognizer_config
            )
        else:
            logger.warning(f"Unknown recognizer type for {recognizer_config.name}")
            return None

        if recognizer and (threshold := recognizer_config.confidenceThreshold):
            patch_analyze = apply_confidence_threshold(threshold)
            recognizer = patch_analyze(recognizer)

        return recognizer

    @staticmethod
    def _get_regex_flags(flags: Optional[RegexFlags]) -> Optional[int]:
        if flags is None:
            return re.IGNORECASE | re.DOTALL | re.MULTILINE

        re_flags = 0
        if flags.ignoreCase:
            re_flags |= re.IGNORECASE
        if flags.dotAll:
            re_flags |= re.DOTALL
        if flags.multiline:
            re_flags |= re.MULTILINE

        return re_flags

    @staticmethod
    def _create_pattern_recognizer(
        config: PatternRecognizer,
        recognizer_config: Recognizer,
    ) -> PresidioPatternRecognizer:
        """Create a pattern-based recognizer."""
        patterns: List[PresidioPattern] = []
        for pattern_config in config.patterns:
            patterns.append(
                PresidioPattern(
                    name=pattern_config.name,
                    regex=pattern_config.regex,
                    score=pattern_config.score or 0.8,
                )
            )

        return PresidioPatternRecognizer(
            supported_entity=config.supportedEntity.value,
            patterns=patterns,
            name=recognizer_config.name.root,
            supported_language=config.supportedLanguage,
            global_regex_flags=PresidioRecognizerFactory._get_regex_flags(
                config.regexFlags
            ),
        )

    @staticmethod
    def _create_deny_list_recognizer(
        config: DenyListRecognizer, recognizer_config: Recognizer
    ) -> PresidioPatternRecognizer:
        """Create a deny list recognizer using patterns."""
        patterns: List[PresidioPattern] = []
        for value in config.denyList:
            # Escape special regex characters in the value
            escaped_value = re.escape(value)

            patterns.append(
                PresidioPattern(
                    name=f"deny_{value}",
                    regex=escaped_value,
                    score=0.9,  # High confidence for exact matches
                )
            )

        return PresidioPatternRecognizer(
            supported_entity=config.supportedEntity.value,
            patterns=patterns,
            name=recognizer_config.name.root,
            supported_language=config.supportedLanguage,
            global_regex_flags=PresidioRecognizerFactory._get_regex_flags(
                config.regexFlags
            ),
        )

    @staticmethod
    def _create_context_recognizer(
        config: ContextRecognizer, recognizer_config: Recognizer
    ) -> PresidioPatternRecognizer:
        """Create a context-aware recognizer."""
        # For context recognizers, we can use a pattern recognizer with context words
        # or implement a custom recognizer that uses NLP
        context_patterns: List[PresidioPattern] = []

        # Create patterns that look for context words near potential entities
        for context_word in config.contextWords:
            # Pattern to match words near context words
            pattern = f"(?i)(?:{context_word})\\s+\\w+|\\w+\\s+(?:{context_word})"
            context_patterns.append(
                PresidioPattern(
                    name=f"context_{context_word}",
                    regex=pattern,
                    score=(config.minScore + config.maxScore) / 2
                    if config.minScore and config.maxScore
                    else 0.6,
                )
            )

        return PresidioPatternRecognizer(
            supported_entity=config.supportedEntity.value,
            patterns=context_patterns,
            name=recognizer_config.name.root,
            supported_language=config.supportedLanguage,
        )

    @staticmethod
    def _create_custom_recognizer(
        config: CustomRecognizer,  # pyright: ignore[reportUnusedParameter]
        recognizer_config: Recognizer,
    ) -> Optional[EntityRecognizer]:
        """
        Create a custom recognizer with user-defined logic.

        For security reasons, we don't execute arbitrary Python code.
        Instead, we could support a limited set of custom behaviors
        or require custom recognizers to be implemented as plugins.
        """
        logger.warning(
            f"Custom recognizer {recognizer_config.name} requires implementation. "
            + "Consider using pattern, deny_list, or context recognizers instead."
        )
        return None

    @staticmethod
    def _create_predefined_recognizer(
        config: PredefinedRecognizer,
        recognizer: Recognizer,  # pyright: ignore[reportUnusedParameter]
    ) -> Optional[EntityRecognizer]:
        """Create a custom recognizer with user-defined logic."""
        try:
            predefined_class = getattr(predefined_recognizers, config.name.value)
        except AttributeError:
            logger.error(f"Recognizer {config.name} not found")
            return None

        args = {}
        if supported_language := config.supportedLanguage:
            args["supported_language"] = supported_language
        if context := config.context:
            args["context"] = context

        return predefined_class(**args)

    @staticmethod
    def create_recognizers_for_tag(tag: Tag) -> List[EntityRecognizer]:
        """
        Create all enabled recognizers for a given tag.

        Args:
            tag: The tag containing recognizer configurations

        Returns:
            List of Presidio EntityRecognizer instances
        """
        recognizers: List[EntityRecognizer] = []

        if not tag.autoClassificationEnabled or not tag.recognizers:
            return recognizers

        for recognizer_config in tag.recognizers:
            recognizer = PresidioRecognizerFactory.create_recognizer(recognizer_config)
            if recognizer:
                recognizers.append(recognizer)
                logger.info(
                    f"Created recognizer {recognizer_config.name} for tag {tag.name}"
                )

        return recognizers


class RecognizerRegistry:
    """Registry for managing custom recognizers from OpenMetadata."""

    def __init__(self):
        self.recognizers: Dict[str, List[EntityRecognizer]] = {}
        self.tag_priority: Dict[str, int] = {}
        self.tag_confidence_threshold: Dict[str, float] = {}

    def register_tag_recognizers(self, tag: Tag) -> None:
        """
        Register all recognizers for a tag.

        Args:
            tag: The tag with recognizer configurations
        """
        if not tag.autoClassificationEnabled:
            return

        tag_fqn = cast(str, tag.fullyQualifiedName)
        self.recognizers[
            tag_fqn
        ] = PresidioRecognizerFactory.create_recognizers_for_tag(tag)
        self.tag_priority[tag_fqn] = tag.autoClassificationPriority or 50

        # Calculate minimum confidence from all recognizers
        min_confidence = 1.0
        for recognizer_config in tag.recognizers or []:
            if recognizer_config.confidenceThreshold:
                min_confidence = min(
                    min_confidence, recognizer_config.confidenceThreshold
                )
        self.tag_confidence_threshold[tag_fqn] = min_confidence

    def get_recognizers_for_tag(self, tag_fqn: str) -> List[EntityRecognizer]:
        """Get all recognizers registered for a tag."""
        return self.recognizers.get(tag_fqn, [])

    def get_all_recognizers(self) -> List[EntityRecognizer]:
        """Get all registered recognizers across all tags."""
        all_recognizers: list[EntityRecognizer] = []
        for recognizers in self.recognizers.values():
            all_recognizers.extend(recognizers)
        return all_recognizers

    def get_tag_priority(self, tag_fqn: str) -> int:
        """Get the priority for a tag (used in conflict resolution)."""
        return self.tag_priority.get(tag_fqn, 50)

    def get_tag_confidence_threshold(self, tag_fqn: str) -> float:
        """Get the minimum confidence threshold for a tag."""
        return self.tag_confidence_threshold.get(tag_fqn, 0.6)
