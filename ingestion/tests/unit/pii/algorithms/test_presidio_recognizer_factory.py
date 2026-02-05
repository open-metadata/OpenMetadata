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
Tests for PresidioRecognizerFactory and RecognizerRegistry
"""
import re
from uuid import uuid4

import pytest
from presidio_analyzer import EntityRecognizer, PatternRecognizer

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.generated.schema.type.contextRecognizer import ContextRecognizer
from metadata.generated.schema.type.customRecognizer import CustomRecognizer
from metadata.generated.schema.type.exactTermsRecognizer import ExactTermsRecognizer
from metadata.generated.schema.type.patternRecognizer import (
    PatternRecognizer as PatternRecognizerConfig,
)
from metadata.generated.schema.type.piiEntity import PIIEntity
from metadata.generated.schema.type.predefinedRecognizer import (
    Name as PredefinedRecognizerName,
)
from metadata.generated.schema.type.predefinedRecognizer import PredefinedRecognizer
from metadata.generated.schema.type.recognizer import Recognizer, RecognizerConfig
from metadata.generated.schema.type.recognizers.patterns import Pattern
from metadata.generated.schema.type.recognizers.regexFlags import RegexFlags
from metadata.pii.algorithms.presidio_recognizer_factory import (
    PresidioRecognizerFactory,
    RecognizerRegistry,
)


class TestPresidioRecognizerFactory:
    def test_create_recognizer_disabled(self):
        """Test that disabled recognizers return None"""
        recognizer_config = Recognizer(
            name="test_recognizer",
            enabled=False,
            recognizerConfig=RecognizerConfig(
                root=PatternRecognizerConfig(
                    type="pattern",
                    supportedEntity=PIIEntity.EMAIL_ADDRESS,
                    patterns=[],
                    regexFlags=RegexFlags(),
                    context=[],
                    supportedLanguage="en",
                )
            ),
        )

        result = PresidioRecognizerFactory.create_recognizer(recognizer_config)
        assert result is None

    def test_create_pattern_recognizer(self):
        """Test creating a pattern recognizer"""
        patterns = [
            Pattern(
                name="email_pattern",
                regex=r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
                score=0.9,
            )
        ]

        recognizer_config = Recognizer(
            name="email_recognizer",
            enabled=True,
            recognizerConfig=RecognizerConfig(
                root=PatternRecognizerConfig(
                    type="pattern",
                    supportedEntity=PIIEntity.EMAIL_ADDRESS,
                    patterns=patterns,
                    supportedLanguage=ClassificationLanguage.en,
                    regexFlags=RegexFlags(),
                    context=[],
                )
            ),
        )

        result = PresidioRecognizerFactory.create_recognizer(recognizer_config)

        assert isinstance(result, PatternRecognizer)
        assert result.supported_entities == ["EMAIL_ADDRESS"]
        assert result.supported_language == ClassificationLanguage.en.value
        assert result.name == "email_recognizer"
        assert len(result.patterns) == 1
        assert result.patterns[0].name == "email_pattern"
        assert result.patterns[0].score == 0.9
        assert result.global_regex_flags == re.IGNORECASE | re.DOTALL | re.MULTILINE

    def test_create_exact_terms_recognizer(self):
        """Test creating an exact terms recognizer"""
        exact_terms = ["secret123", "api-key-456", "token789"]

        recognizer_config = Recognizer(
            name="exact_terms_recognizer",
            enabled=True,
            recognizerConfig=RecognizerConfig(
                root=ExactTermsRecognizer(
                    type="exact_terms",
                    supportedEntity=PIIEntity.US_SSN,
                    exactTerms=exact_terms,
                    supportedLanguage=ClassificationLanguage.en,
                    regexFlags=RegexFlags(),
                )
            ),
        )

        result = PresidioRecognizerFactory.create_recognizer(recognizer_config)

        assert isinstance(result, PatternRecognizer)
        assert result.supported_entities == ["US_SSN"]
        assert len(result.patterns) == 3

        for value, pattern in zip(exact_terms, result.patterns):
            assert pattern.name == f"exact_term_{value}"
            assert pattern.regex == re.escape(value)
            assert pattern.score == 0.9

    def test_create_context_recognizer(self):
        """Test creating a context recognizer"""
        context_words = ["password", "secret", "credential"]

        recognizer_config = Recognizer(
            name="context_recognizer",
            enabled=True,
            recognizerConfig=RecognizerConfig(
                root=ContextRecognizer(
                    type="context",
                    supportedEntity=PIIEntity.US_SSN,
                    contextWords=context_words,
                    supportedLanguage=ClassificationLanguage.en,
                    minScore=0.4,
                    maxScore=0.8,
                )
            ),
        )

        result = PresidioRecognizerFactory.create_recognizer(recognizer_config)

        assert isinstance(result, PatternRecognizer)
        assert result.supported_entities == ["US_SSN"]
        assert len(result.patterns) == 3

        for word, pattern in zip(context_words, result.patterns):
            assert pattern.name == f"context_{word}"
            assert abs(pattern.score - 0.6) < 0.0001  # (0.4 + 0.8) / 2

    def test_create_custom_recognizer(self):
        """Test that custom recognizers return None with a warning"""
        recognizer_config = Recognizer(
            name="custom_recognizer",
            enabled=True,
            recognizerConfig=RecognizerConfig(
                root=CustomRecognizer(
                    type="custom",
                    validatorFunction="def validate(text): return True",
                    supportedEntity=PIIEntity.PERSON,
                    supportedLanguage=ClassificationLanguage.en,
                )
            ),
        )

        result = PresidioRecognizerFactory.create_recognizer(recognizer_config)
        assert result is None

    def test_create_predefined_recognizer(self):
        """Test creating a predefined recognizer"""
        recognizer_config = Recognizer(
            name="email_predefined",
            enabled=True,
            recognizerConfig=RecognizerConfig(
                root=PredefinedRecognizer(
                    type="predefined",
                    name=PredefinedRecognizerName.EmailRecognizer,
                    supportedLanguage=ClassificationLanguage.en,
                    context=["email", "mail"],
                )
            ),
        )

        result = PresidioRecognizerFactory.create_recognizer(recognizer_config)

        assert isinstance(result, EntityRecognizer)
        assert "EMAIL_ADDRESS" in result.supported_entities

    def test_create_predefined_recognizer_invalid_name(self):
        """Test that invalid predefined recognizer names return None"""
        recognizer_config = Recognizer(
            name="invalid_predefined",
            enabled=True,
            recognizerConfig=RecognizerConfig(
                root=PredefinedRecognizer(
                    type="predefined",
                    name=PredefinedRecognizerName.EmailRecognizer,
                )
            ),
        )

        original_name = recognizer_config.recognizerConfig.root.name
        recognizer_config.recognizerConfig.root.name = "InvalidRecognizer"

        result = PresidioRecognizerFactory.create_recognizer(recognizer_config)
        assert result is None

    @pytest.mark.parametrize(
        "regex_flags, expected",
        (
            (
                RegexFlags(
                    ignoreCase=True,
                    dotAll=True,
                    multiline=True,
                ),
                re.IGNORECASE | re.DOTALL | re.MULTILINE,
            ),
            (
                None,
                re.IGNORECASE | re.DOTALL | re.MULTILINE,
            ),
            (
                RegexFlags(
                    ignoreCase=True,
                    dotAll=True,
                    multiline=False,
                ),
                re.IGNORECASE | re.DOTALL,
            ),
            (
                RegexFlags(
                    ignoreCase=True,
                    dotAll=False,
                    multiline=True,
                ),
                re.IGNORECASE | re.MULTILINE,
            ),
            (
                RegexFlags(
                    ignoreCase=False,
                    dotAll=True,
                    multiline=True,
                ),
                re.DOTALL | re.MULTILINE,
            ),
            (
                RegexFlags(
                    ignoreCase=True,
                    dotAll=False,
                    multiline=False,
                ),
                re.IGNORECASE,
            ),
            (
                RegexFlags(
                    ignoreCase=False,
                    dotAll=True,
                    multiline=False,
                ),
                re.DOTALL,
            ),
            (
                RegexFlags(
                    ignoreCase=False,
                    dotAll=False,
                    multiline=True,
                ),
                re.MULTILINE,
            ),
            (
                RegexFlags(
                    ignoreCase=False,
                    dotAll=False,
                    multiline=False,
                ),
                0,
            ),
        ),
    )
    def test_get_regex_flags_custom(self, regex_flags: RegexFlags, expected: int):
        """Test custom regex flags"""
        assert PresidioRecognizerFactory._get_regex_flags(regex_flags) is expected

    def test_create_recognizers_for_tag_disabled(self):
        """Test that disabled tags return empty list"""
        tag = Tag(
            id=str(uuid4()),
            name="test_tag",
            description="Test tag",
            autoClassificationEnabled=False,
            recognizers=[],
        )

        recognizers = PresidioRecognizerFactory.create_recognizers_for_tag(tag)
        assert recognizers == []

    def test_create_recognizers_for_tag_no_recognizers(self):
        """Test that tags without recognizers return empty list"""
        tag = Tag(
            id=str(uuid4()),
            name="test_tag",
            description="Test tag",
            autoClassificationEnabled=True,
            recognizers=None,
        )

        recognizers = PresidioRecognizerFactory.create_recognizers_for_tag(tag)
        assert recognizers == []

    def test_create_recognizers_for_tag_multiple(self):
        """Test creating multiple recognizers for a tag"""
        recognizer1 = Recognizer(
            name="recognizer1",
            enabled=True,
            recognizerConfig=RecognizerConfig(
                root=PatternRecognizerConfig(
                    type="pattern",
                    supportedEntity=PIIEntity.EMAIL_ADDRESS,
                    patterns=[
                        Pattern(name="test", regex=r"test@example\.com", score=0.8)
                    ],
                    regexFlags=RegexFlags(),
                    context=[],
                    supportedLanguage=ClassificationLanguage.en,
                )
            ),
        )

        recognizer2 = Recognizer(
            name="recognizer2",
            enabled=True,
            recognizerConfig=RecognizerConfig(
                root=ExactTermsRecognizer(
                    type="exact_terms",
                    supportedEntity=PIIEntity.US_SSN,
                    exactTerms=["secret"],
                    supportedLanguage=ClassificationLanguage.en,
                    regexFlags=RegexFlags(),
                )
            ),
        )

        recognizer3 = Recognizer(
            name="recognizer3",
            enabled=False,
            recognizerConfig=RecognizerConfig(
                root=PatternRecognizerConfig(
                    type="pattern",
                    supportedEntity=PIIEntity.PHONE_NUMBER,
                    patterns=[],
                    regexFlags=RegexFlags(),
                    context=[],
                    supportedLanguage=ClassificationLanguage.en,
                )
            ),
        )

        tag = Tag(
            id=str(uuid4()),
            name="test_tag",
            description="Test tag",
            autoClassificationEnabled=True,
            recognizers=[recognizer1, recognizer2, recognizer3],
        )

        recognizers = PresidioRecognizerFactory.create_recognizers_for_tag(tag)

        assert len(recognizers) == 2
        assert all(isinstance(r, EntityRecognizer) for r in recognizers)


class TestRecognizerRegistry:
    def test_register_tag_recognizers_disabled(self):
        """Test that disabled tags are not registered"""
        registry = RecognizerRegistry()

        tag = Tag(
            id=str(uuid4()),
            name="test_tag",
            description="Test tag",
            fullyQualifiedName="category.test_tag",
            autoClassificationEnabled=False,
        )

        registry.register_tag_recognizers(tag)

        assert "category.test_tag" not in registry.recognizers
        assert "category.test_tag" not in registry.tag_priority
        assert "category.test_tag" not in registry.tag_confidence_threshold

    def test_register_tag_recognizers_enabled(self):
        """Test registering recognizers for an enabled tag"""
        registry = RecognizerRegistry()

        recognizer = Recognizer(
            name="test_recognizer",
            enabled=True,
            confidenceThreshold=0.7,
            recognizerConfig=RecognizerConfig(
                root=PatternRecognizerConfig(
                    type="pattern",
                    supportedEntity=PIIEntity.EMAIL_ADDRESS,
                    patterns=[
                        Pattern(name="email", regex=r"[\w\.]+@example\.com", score=0.9)
                    ],
                    regexFlags=RegexFlags(),
                    context=[],
                    supportedLanguage=ClassificationLanguage.en,
                )
            ),
        )

        tag = Tag(
            id=str(uuid4()),
            name="test_tag",
            description="Test tag",
            fullyQualifiedName="category.test_tag",
            autoClassificationEnabled=True,
            autoClassificationPriority=60,
            recognizers=[recognizer],
        )

        registry.register_tag_recognizers(tag)

        assert "category.test_tag" in registry.recognizers
        assert len(registry.recognizers["category.test_tag"]) == 1
        assert registry.tag_priority["category.test_tag"] == 60
        assert registry.tag_confidence_threshold["category.test_tag"] == 0.7

    def test_get_recognizers_for_tag(self):
        """Test getting recognizers for a specific tag"""
        registry = RecognizerRegistry()

        recognizer = Recognizer(
            name="test_recognizer",
            enabled=True,
            recognizerConfig=RecognizerConfig(
                root=PatternRecognizerConfig(
                    type="pattern",
                    supportedEntity=PIIEntity.EMAIL_ADDRESS,
                    patterns=[Pattern(name="test", regex=r"test", score=0.8)],
                    regexFlags=RegexFlags(),
                    context=[],
                    supportedLanguage=ClassificationLanguage.en,
                )
            ),
        )

        tag = Tag(
            id=str(uuid4()),
            name="test_tag",
            description="Test tag",
            fullyQualifiedName="category.test_tag",
            autoClassificationEnabled=True,
            recognizers=[recognizer],
        )

        registry.register_tag_recognizers(tag)

        recognizers = registry.get_recognizers_for_tag("category.test_tag")
        assert len(recognizers) == 1
        assert isinstance(recognizers[0], EntityRecognizer)

        empty_recognizers = registry.get_recognizers_for_tag("nonexistent.tag")
        assert empty_recognizers == []

    def test_get_all_recognizers(self):
        """Test getting all recognizers from registry"""
        registry = RecognizerRegistry()

        tag1 = Tag(
            id=str(uuid4()),
            name="tag1",
            description="Tag 1",
            fullyQualifiedName="category.tag1",
            autoClassificationEnabled=True,
            recognizers=[
                Recognizer(
                    name="recognizer1",
                    enabled=True,
                    recognizerConfig=RecognizerConfig(
                        root=PatternRecognizerConfig(
                            type="pattern",
                            supportedEntity=PIIEntity.EMAIL_ADDRESS,
                            patterns=[Pattern(name="test1", regex=r"test1", score=0.8)],
                            regexFlags=RegexFlags(),
                            context=[],
                            supportedLanguage=ClassificationLanguage.en,
                        )
                    ),
                )
            ],
        )

        tag2 = Tag(
            id=str(uuid4()),
            name="tag2",
            description="Tag 2",
            fullyQualifiedName="category.tag2",
            autoClassificationEnabled=True,
            recognizers=[
                Recognizer(
                    name="recognizer2",
                    enabled=True,
                    recognizerConfig=RecognizerConfig(
                        root=PatternRecognizerConfig(
                            type="pattern",
                            supportedEntity=PIIEntity.PHONE_NUMBER,
                            patterns=[Pattern(name="test2", regex=r"test2", score=0.8)],
                            regexFlags=RegexFlags(),
                            context=[],
                            supportedLanguage=ClassificationLanguage.en,
                        )
                    ),
                )
            ],
        )

        registry.register_tag_recognizers(tag1)
        registry.register_tag_recognizers(tag2)

        all_recognizers = registry.get_all_recognizers()
        assert len(all_recognizers) == 2
        assert all(isinstance(r, EntityRecognizer) for r in all_recognizers)

    def test_get_tag_priority(self):
        """Test getting tag priority"""
        registry = RecognizerRegistry()

        tag = Tag(
            id=str(uuid4()),
            name="test_tag",
            description="Test tag",
            fullyQualifiedName="category.test_tag",
            autoClassificationEnabled=True,
            autoClassificationPriority=75,
            recognizers=[],
        )

        registry.register_tag_recognizers(tag)

        priority = registry.get_tag_priority("category.test_tag")
        assert priority == 75

        default_priority = registry.get_tag_priority("nonexistent.tag")
        assert default_priority == 50

    def test_get_tag_confidence_threshold(self):
        """Test getting minimum confidence threshold for a tag"""
        registry = RecognizerRegistry()

        recognizer1 = Recognizer(
            name="recognizer1",
            enabled=True,
            confidenceThreshold=0.8,
            recognizerConfig=RecognizerConfig(
                root=PatternRecognizerConfig(
                    type="pattern",
                    supportedEntity=PIIEntity.EMAIL_ADDRESS,
                    patterns=[Pattern(name="test", regex=r"test", score=0.8)],
                    regexFlags=RegexFlags(),
                    context=[],
                    supportedLanguage=ClassificationLanguage.en,
                )
            ),
        )

        recognizer2 = Recognizer(
            name="recognizer2",
            enabled=True,
            confidenceThreshold=0.5,
            recognizerConfig=RecognizerConfig(
                root=PatternRecognizerConfig(
                    type="pattern",
                    supportedEntity=PIIEntity.PHONE_NUMBER,
                    patterns=[Pattern(name="test", regex=r"test", score=0.8)],
                    regexFlags=RegexFlags(),
                    context=[],
                    supportedLanguage=ClassificationLanguage.en,
                )
            ),
        )

        tag = Tag(
            id=str(uuid4()),
            name="test_tag",
            description="Test tag",
            fullyQualifiedName="category.test_tag",
            autoClassificationEnabled=True,
            recognizers=[recognizer1, recognizer2],
        )

        registry.register_tag_recognizers(tag)

        threshold = registry.get_tag_confidence_threshold("category.test_tag")
        assert threshold == 0.5

        default_threshold = registry.get_tag_confidence_threshold("nonexistent.tag")
        assert default_threshold == 0.6

    def test_confidence_threshold_no_recognizers(self):
        """Test confidence threshold when tag has no recognizers"""
        registry = RecognizerRegistry()

        tag = Tag(
            id=str(uuid4()),
            name="test_tag",
            description="Test tag",
            fullyQualifiedName="category.test_tag",
            autoClassificationEnabled=True,
            recognizers=[],
        )

        registry.register_tag_recognizers(tag)

        threshold = registry.get_tag_confidence_threshold("category.test_tag")
        assert threshold == 1.0
