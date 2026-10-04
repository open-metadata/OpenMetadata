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
Integration tests for TagProcessor with multi-classification support.
Tests scenarios from AUTO_CLASSIFICATION_REFACTOR_SOLUTION.md
"""

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any
from unittest.mock import Mock, create_autospec
from uuid import uuid4

import pytest
from presidio_analyzer.nlp_engine import NlpEngine

from _openmetadata_testutils.factories.metadata.generated.schema.entity.classification.classification import (
    ClassificationFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.entity.classification.tag import (
    TagFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.entity.data.table import (
    ColumnFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.type.recognizer import (
    PatternFactory,
    PatternRecognizerFactory,
    PredefinedRecognizerFactory,
    RecognizerFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.type.tag_label import (
    TagLabelFactory,
)
from _openmetadata_testutils.pii.fake_classification_manager import (
    FakeClassificationManager,
)
from metadata.generated.schema.entity.classification.classification import (
    Classification,
    ConflictResolution,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    SourceConfig,
)
from metadata.generated.schema.type.classificationLanguages import ClassificationLanguage
from metadata.generated.schema.type.predefinedRecognizer import Name
from metadata.generated.schema.type.recognizer import Recognizer, Target
from metadata.generated.schema.type.tagLabel import LabelType, State, TagSource
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.algorithms.presidio_utils import load_nlp_engine
from metadata.pii.models import ScoredTag
from metadata.pii.tag_analyzer import TagAnalyzer
from metadata.pii.tag_processor import TagProcessor

_SHIPPED_PII = json.loads(
    (
        Path(__file__).resolve().parents[5]
        / "openmetadata-service/src/main/resources/json/data/tags/piiTagsWithRecognizers.json"
    ).read_text()
)


def _shipped_classification() -> Classification:
    settings = _SHIPPED_PII["createClassification"]
    config = settings["autoClassificationConfig"]
    return ClassificationFactory.create(
        fqn="PII",
        mutuallyExclusive=settings["mutuallyExclusive"],
        autoClassificationConfig__enabled=config["enabled"],
        autoClassificationConfig__conflictResolution=ConflictResolution(config["conflictResolution"]),
        autoClassificationConfig__minimumConfidence=config["minimumConfidence"],
        autoClassificationConfig__requireExplicitMatch=config["requireExplicitMatch"],
    )


def _shipped_tag(classification: Classification, tag_name: str, recognizer_names: set[str] | None = None) -> Tag:
    tag_data = next(tag for tag in _SHIPPED_PII["createTags"] if tag["name"] == tag_name)
    return TagFactory.create(
        tag_name=tag_name,
        tag_classification=classification,
        autoClassificationEnabled=True,
        autoClassificationPriority=tag_data["autoClassificationPriority"],
        recognizers=[
            Recognizer.model_validate({**config, "id": str(uuid4())})
            for config in tag_data["recognizers"]
            if recognizer_names is None or config["name"] in recognizer_names
        ],
    )


@pytest.mark.parametrize(
    "language, recognizer_name",
    [
        ("en", "EnglishCreditCardRecognizer"),
        ("es", "SpanishCreditCardRecognizer"),
        ("it", "ItalianCreditCardRecognizer"),
        ("pl", "PolishCreditCardRecognizer"),
    ],
)
def test_shipped_card_evidence_and_default_tagging(language, recognizer_name):
    classification = _shipped_classification()
    tag = _shipped_tag(classification, "Sensitive", {recognizer_name})
    column = Column(
        name="customer_card", fullyQualifiedName="db.schema.table.customer_card", dataType=DataType.VARCHAR, tags=[]
    )
    value = "Card 4111-1111-1111-1111 issued"
    language_enum = ClassificationLanguage(language)
    analyzer = TagAnalyzer(tag, column, load_nlp_engine(classification_language=language_enum), language_enum)

    analysis = analyzer.analyze([value])
    assert [(value[result.start : result.end], result.score) for result in analysis.recognizer_results] == [
        ("4111-1111-1111-1111", 1.0)
    ]

    config = Mock(spec=OpenMetadataWorkflowConfig)
    config.source = Mock(spec=SourceConfig)
    config.source.sourceConfig = Mock()
    config.source.sourceConfig.config = Mock(confidence=80, classificationLanguage=language_enum)
    processor = TagProcessor(
        config=config,
        metadata=create_autospec(OpenMetadata, spec_set=True, instance=True),
        classification_manager=FakeClassificationManager((classification, [tag])),
    )
    labels = processor.create_column_tag_labels(column, [value])
    assert [label.tagFQN.root for label in labels] == ["PII.Sensitive"]
    assert labels[0].labelType == LabelType.Generated
    assert labels[0].state == State.Suggested


@pytest.mark.parametrize(
    "tag_name, recognizer_name, value, expected, expected_labels",
    [
        ("NonSensitive", "UrlRecognizer", "Visit https://example.org/a?x=1", "https://example.org/a?x=1", []),
        ("Sensitive", "IpRecognizer", "2001:db8::1", "2001:db8::1", []),
        ("NonSensitive", "UrlRecognizer", "http://app.internal.local/path", None, []),
        ("Sensitive", "IpRecognizer", "2001:db8::1g", None, []),
    ],
)
def test_shipped_network_evidence_and_default_tagging(tag_name, recognizer_name, value, expected, expected_labels):
    classification = _shipped_classification()
    tag = _shipped_tag(classification, tag_name, {recognizer_name})
    column = Column(
        name="service_value", fullyQualifiedName="db.schema.table.service_value", dataType=DataType.VARCHAR, tags=[]
    )
    analyzer = TagAnalyzer(tag, column, load_nlp_engine(classification_language=ClassificationLanguage.en))
    analysis = analyzer.analyze([value])
    assert [value[result.start : result.end] for result in analysis.recognizer_results] == (
        [expected] if expected else []
    )

    config = Mock(spec=OpenMetadataWorkflowConfig)
    config.source = Mock(spec=SourceConfig)
    config.source.sourceConfig = Mock()
    config.source.sourceConfig.config = Mock(confidence=80, classificationLanguage=ClassificationLanguage.en)
    processor = TagProcessor(
        config=config,
        metadata=create_autospec(OpenMetadata, spec_set=True, instance=True),
        classification_manager=FakeClassificationManager((classification, [tag])),
    )
    assert [label.tagFQN.root for label in processor.create_column_tag_labels(column, [value])] == expected_labels


@pytest.mark.parametrize(
    ("tag_name", "recognizer_name", "column_name", "value", "expected_tag"),
    [
        ("NonSensitive", "UrlRecognizer", "service_url", "https://example.company/path", "PII.NonSensitive"),
        ("Sensitive", "IpRecognizer", "session_ip", "2001:db8::1", "PII.Sensitive"),
    ],
)
def test_network_configured_context_preserves_recognizer_metadata(
    tag_name, recognizer_name, column_name, value, expected_tag
):
    classification = _shipped_classification()
    tag = _shipped_tag(classification, tag_name, {recognizer_name})
    column = Column(
        name=column_name, fullyQualifiedName=f"db.schema.table.{column_name}", dataType=DataType.VARCHAR, tags=[]
    )
    config = Mock(spec=OpenMetadataWorkflowConfig)
    config.source = Mock(spec=SourceConfig)
    config.source.sourceConfig = Mock()
    config.source.sourceConfig.config = Mock(confidence=80, classificationLanguage=ClassificationLanguage.en)
    processor = TagProcessor(
        config=config,
        metadata=create_autospec(OpenMetadata, spec_set=True, instance=True),
        classification_manager=FakeClassificationManager((classification, [tag])),
    )

    labels = processor.create_column_tag_labels(column, [value])
    assert [label.tagFQN.root for label in labels] == [expected_tag]
    assert labels[0].metadata is not None
    assert labels[0].metadata.recognizer.recognizerId == tag.recognizers[0].id
    assert labels[0].metadata.recognizer.recognizerName == recognizer_name


def test_luhn_valid_operational_lookalike_remains_ambiguous():
    classification = _shipped_classification()
    tag = _shipped_tag(classification, "Sensitive", {"EnglishCreditCardRecognizer"})
    column = Column(
        name="batch_reference", fullyQualifiedName="db.schema.table.batch_reference", dataType=DataType.VARCHAR, tags=[]
    )
    value = "Batch 4111111111111111 processed"
    analyzer = TagAnalyzer(tag, column, load_nlp_engine(classification_language=ClassificationLanguage.en))
    analysis = analyzer.analyze([value])
    assert [(value[result.start : result.end], result.score) for result in analysis.recognizer_results] == [
        ("4111111111111111", 1.0)
    ]

    config = Mock(spec=OpenMetadataWorkflowConfig)
    config.source = Mock(spec=SourceConfig)
    config.source.sourceConfig = Mock()
    config.source.sourceConfig.config = Mock(confidence=80, classificationLanguage=ClassificationLanguage.en)
    processor = TagProcessor(
        config=config,
        metadata=create_autospec(OpenMetadata, spec_set=True, instance=True),
        classification_manager=FakeClassificationManager((classification, [tag])),
    )
    assert [label.tagFQN.root for label in processor.create_column_tag_labels(column, [value])] == ["PII.Sensitive"]


@pytest.mark.parametrize(
    ("value", "expected_entities", "expected_labels"),
    [
        ("Card 4111111111111111 issued", {"CREDIT_CARD": "4111111111111111"}, ["PII.Sensitive"]),
        ("user@example.com", {"EMAIL_ADDRESS": "user@example.com"}, ["PII.Sensitive"]),
        (
            "https://example.org/4111111111111111",
            {"URL": "https://example.org/4111111111111111", "CREDIT_CARD": "4111111111111111"},
            ["PII.Sensitive"],
        ),
        ("http://192.168.1.1:8080/123", {"IP_ADDRESS": "192.168.1.1"}, []),
        ("http://app.internal.local/path", {}, []),
    ],
)
def test_full_shipped_recognizer_interactions(value, expected_entities, expected_labels):
    classification = _shipped_classification()
    tags = [_shipped_tag(classification, tag_name) for tag_name in ("Sensitive", "NonSensitive")]
    column = Column(name="payload", fullyQualifiedName="db.schema.table.payload", dataType=DataType.VARCHAR, tags=[])
    nlp_engine = load_nlp_engine(classification_language=ClassificationLanguage.en)
    evidence = [
        result for tag in tags for result in TagAnalyzer(tag, column, nlp_engine).analyze([value]).recognizer_results
    ]
    for entity, expected_slice in expected_entities.items():
        assert any(
            result.entity_type == entity and value[result.start : result.end] == expected_slice for result in evidence
        )
    if not expected_entities:
        assert all(result.entity_type != "URL" for result in evidence)

    config = Mock(spec=OpenMetadataWorkflowConfig)
    config.source = Mock(spec=SourceConfig)
    config.source.sourceConfig = Mock()
    config.source.sourceConfig.config = Mock(confidence=80, classificationLanguage=ClassificationLanguage.en)
    processor = TagProcessor(
        config=config,
        metadata=create_autospec(OpenMetadata, spec_set=True, instance=True),
        classification_manager=FakeClassificationManager((classification, tags)),
    )
    assert [label.tagFQN.root for label in processor.create_column_tag_labels(column, [value])] == expected_labels


class FakeScoreTagsForColumn:
    def __init__(self, scored_tags: list[ScoredTag]) -> None:
        self.scored_tags = scored_tags

    def __call__(self, column: Column, data: Sequence[Any], tags_to_analyze: list[Tag]) -> list[ScoredTag]:
        return self.scored_tags


class TestTagProcessorMultiClassification:
    """
    Integration tests for multi-classification scenarios.
    """

    @pytest.fixture
    def workflow_config(self):
        """Mock workflow configuration."""
        config = Mock(spec=OpenMetadataWorkflowConfig)
        config.source = Mock(spec=SourceConfig)
        config.source.sourceConfig = Mock()
        config.source.sourceConfig.config = Mock()
        config.source.sourceConfig.config.confidence = 70  # 70% confidence threshold
        return config

    @pytest.fixture
    def metadata(self) -> Mock:
        return create_autospec(OpenMetadata, spec_set=True, instance=True)

    @pytest.fixture
    def nlp_engine(self) -> Mock:
        return create_autospec(NlpEngine, spec_set=True, instance=True)

    @pytest.fixture
    def pii_classification_mutually_exclusive(self):
        """
        PII Classification (Mutually Exclusive)
        - Only 1 tag can be assigned
        - Uses highest_confidence resolution
        - Minimum confidence: 0.7
        """
        return ClassificationFactory.create(
            fqn="PII",
            mutuallyExclusive=True,
            autoClassificationConfig__enabled=True,
            autoClassificationConfig__conflictResolution=ConflictResolution.highest_confidence,
            autoClassificationConfig__minimumConfidence=0.7,
            autoClassificationConfig__requireExplicitMatch=True,
            description="Personal Identifiable Information",
        )

    @pytest.fixture
    def general_classification_non_exclusive(self):
        """
        General Classification (Non-Mutually Exclusive)
        - Multiple tags can be assigned
        - Minimum confidence: 0.6
        """
        return ClassificationFactory.create(
            fqn="General",
            mutuallyExclusive=False,
            autoClassificationConfig__enabled=True,
            autoClassificationConfig__conflictResolution=ConflictResolution.highest_confidence,
            autoClassificationConfig__minimumConfidence=0.6,
            autoClassificationConfig__requireExplicitMatch=True,
            description="General data classifications",
        )

    @pytest.fixture
    def techdetail_classification(self):
        """
        TechDetail Classification (Custom, Non-Mutually Exclusive)
        - Uses highest_priority resolution
        - Minimum confidence: 0.5
        """
        return ClassificationFactory.create(
            fqn="TechDetail",
            mutuallyExclusive=False,
            autoClassificationConfig__enabled=True,
            autoClassificationConfig__conflictResolution=ConflictResolution.highest_priority,
            autoClassificationConfig__minimumConfidence=0.5,
            autoClassificationConfig__requireExplicitMatch=True,
            description="Technical details",
        )

    @pytest.fixture
    def pii_sensitive_tag(self, pii_classification_mutually_exclusive: Classification):
        """PII.Sensitive tag - high priority."""
        email_recognizer = PredefinedRecognizerFactory.create(name=Name.EmailRecognizer)
        recognizer = RecognizerFactory.create(
            name="email_recognizer",
            recognizerConfig=email_recognizer,
        )
        return TagFactory.create(
            tag_name="Sensitive",
            tag_classification=pii_classification_mutually_exclusive,
            autoClassificationEnabled=True,
            autoClassificationPriority=90,
            recognizers=[recognizer],
            description="Sensitive data",
        )

    @pytest.fixture
    def general_email_tag(self, general_classification_non_exclusive: Classification):
        """General.Email tag."""
        email_recognizer = PredefinedRecognizerFactory.create(name=Name.EmailRecognizer)
        recognizer = RecognizerFactory.create(
            name="email_recognizer",
            recognizerConfig=email_recognizer,
        )
        return TagFactory.create(
            tag_name="Email",
            tag_classification=general_classification_non_exclusive,
            autoClassificationEnabled=True,
            autoClassificationPriority=95,
            recognizers=[recognizer],
            description="General email classifications",
        )

    @pytest.fixture
    def general_password_tag(self, general_classification_non_exclusive: Classification):
        """General.Password tag."""
        pwd_pattern = PatternFactory.create(name="pwd-pattern", regex="^password$")
        password_pattern_recognizer = PatternRecognizerFactory.create(
            patterns=[pwd_pattern],
            context=[],
            supportedLanguage="en",
        )
        recognizer = RecognizerFactory.create(
            name="password_recognizer",
            recognizerConfig=password_pattern_recognizer,
            target=Target.column_name,
        )
        return TagFactory.create(
            tag_name="Password",
            tag_classification=general_classification_non_exclusive,
            autoClassificationEnabled=True,
            autoClassificationPriority=95,
            recognizers=[recognizer],
            description="General password classifications",
        )

    @pytest.fixture
    def techdetail_secret_tag(self, techdetail_classification: Classification):
        """TechDetail.Secret tag - highest priority."""
        secret_pattern = PatternFactory.create(name="secret-pattern", regex="^secret$")
        secret_pattern_recognizer = PatternRecognizerFactory.create(
            patterns=[secret_pattern],
            context=[],
            supportedLanguage="en",
        )
        recognizer = RecognizerFactory.create(
            name="secret_recognizer",
            recognizerConfig=secret_pattern_recognizer,
        )
        return TagFactory.create(
            tag_name="Secret",
            tag_classification=techdetail_classification,
            autoClassificationEnabled=True,
            autoClassificationPriority=95,
            recognizers=[recognizer],
            description="Secret data",
        )

    @pytest.fixture
    def sample_column(self):
        """Sample column with credit card-like data."""
        return Column(
            name="password",
            fullyQualifiedName="database.schema.table.password",
            dataType=DataType.VARCHAR,
            tags=[],
        )

    @pytest.fixture
    def sample_email_password_data(self) -> Sequence[Any]:
        """
        Sample data that could match multiple tags:
        - Contains emails (General.Email)
        - Column name suggests password (General.Password)
        - Contains sensitive data (PII.Sensitive)
        - Could contain secrets (TechDetail.Secret)
        """
        return ["user:12dfwef23t1", "foo:124dff4y6h44", "foobar:9798sfdgs"]

    def test_pii_general_multi_classification(
        self,
        metadata: Mock,
        workflow_config,
        pii_classification_mutually_exclusive,
        general_classification_non_exclusive,
        pii_sensitive_tag,
        general_email_tag,
        general_password_tag,
        sample_column,
        sample_email_password_data,
    ):
        """
        Test Example 1 from document: PII + General Multi-Classification

        Expected Result:
        - 1 PII tag (mutually exclusive): PII.Sensitive
        - 2 General tags (non-mutually exclusive): General.Email, General.Password
        """
        classification_manager = FakeClassificationManager(
            (pii_classification_mutually_exclusive, [pii_sensitive_tag]),
            (
                general_classification_non_exclusive,
                [general_email_tag, general_password_tag],
            ),
        )

        # Simulate scores: all tags score above threshold
        mock_scores = [
            ScoredTag(
                tag=pii_sensitive_tag,
                score=0.85,
                reason="Detected by Sensitive recognizer: content match",
            ),
            ScoredTag(
                tag=general_email_tag,
                score=0.75,
                reason="Detected by Email recognizer: content match",
            ),
            ScoredTag(
                tag=general_password_tag,
                score=0.80,
                reason="Detected by Password recognizer: column name match",
            ),
        ]

        # Create TagProcessor
        processor = TagProcessor(
            config=workflow_config,
            metadata=metadata,
            classification_manager=classification_manager,
            score_tags_for_column=FakeScoreTagsForColumn(mock_scores),
            max_tags_per_column=10,
        )

        # Process column
        tag_labels = processor.create_column_tag_labels(column=sample_column, sample_data=sample_email_password_data)

        # Verify results
        assert len(tag_labels) == 3, (
            f"Should return 3 tags (1 PII + 2 General), got {len(tag_labels)}: {[l.tagFQN for l in tag_labels]}"  # noqa: E741
        )

        tag_fqns = [label.tagFQN for label in tag_labels]

        # Should have exactly 1 PII tag (mutually exclusive)
        pii_tags = [fqn.root for fqn in tag_fqns if fqn.root.startswith("PII")]
        assert len(pii_tags) == 1, f"Should have exactly 1 PII tag, got {pii_tags}"
        assert "PII.Sensitive" in pii_tags

        # Should have 2 General tags (non-mutually exclusive)
        general_tags = [fqn.root for fqn in tag_fqns if fqn.root.startswith("General")]
        assert len(general_tags) == 2, f"Should have 2 General tags, got {general_tags}"
        assert "General.Email" in general_tags
        assert "General.Password" in general_tags

        # Verify tag properties
        for label in tag_labels:
            assert label.source == TagSource.Classification
            assert label.state == State.Suggested
            assert label.labelType == LabelType.Generated

    def test_custom_classification_techdetail(
        self,
        metadata: Mock,
        workflow_config,
        pii_classification_mutually_exclusive,
        general_classification_non_exclusive,
        techdetail_classification,
        pii_sensitive_tag,
        general_password_tag,
        techdetail_secret_tag,
        sample_column,
        sample_email_password_data,
    ):
        """
        Test Example 2 from document: Custom Classification (TechDetail)

        Expected Result:
        - 1 PII tag: PII.Sensitive
        - 1 General tag: General.Password
        - 1 TechDetail tag: TechDetail.Secret

        Total: 3 tags from 3 different classifications
        """
        classification_manager = FakeClassificationManager(
            (pii_classification_mutually_exclusive, [pii_sensitive_tag]),
            (general_classification_non_exclusive, [general_password_tag]),
            (techdetail_classification, [techdetail_secret_tag]),
        )

        mock_scores = [
            ScoredTag(
                tag=pii_sensitive_tag,
                score=0.85,
                reason="Sensitive data detected",
            ),
            ScoredTag(
                tag=general_password_tag,
                score=0.80,
                reason="Password field detected",
            ),
            ScoredTag(
                tag=techdetail_secret_tag,
                score=0.75,
                reason="Secret pattern detected",
            ),
        ]

        # Create TagProcessor
        processor = TagProcessor(
            config=workflow_config,
            metadata=metadata,
            classification_manager=classification_manager,
            score_tags_for_column=FakeScoreTagsForColumn(mock_scores),
            max_tags_per_column=10,
        )

        # Process column
        tag_labels = processor.create_column_tag_labels(column=sample_column, sample_data=sample_email_password_data)

        # Verify results
        assert len(tag_labels) == 3, (
            f"Should return 3 tags (1 from each classification), got {len(tag_labels)}: {[l.tagFQN for l in tag_labels]}"  # noqa: E741
        )

        tag_fqns = [label.tagFQN.root for label in tag_labels]

        # Verify each classification contributed 1 tag
        assert "PII.Sensitive" in tag_fqns
        assert "General.Password" in tag_fqns
        assert "TechDetail.Secret" in tag_fqns

    def test_classification_filter(
        self,
        metadata: Mock,
        workflow_config,
        pii_classification_mutually_exclusive,
        general_classification_non_exclusive,
        pii_sensitive_tag,
        general_password_tag,
        sample_column,
        sample_email_password_data,
    ):
        """
        Test classification filtering - only process specified classifications.
        """

        classification_manager = FakeClassificationManager(
            (pii_classification_mutually_exclusive, [pii_sensitive_tag]),
            (general_classification_non_exclusive, [general_password_tag]),
        )

        # Only PII tag will score (General is filtered out)
        mock_scores = [
            ScoredTag(
                tag=pii_sensitive_tag,
                score=0.85,
                reason="Sensitive data",
            ),
        ]

        # Create TagProcessor with filter - only PII
        processor = TagProcessor(
            config=workflow_config,
            metadata=metadata,
            classification_filter=["PII"],  # Only process PII
            max_tags_per_column=10,
            classification_manager=classification_manager,
            score_tags_for_column=FakeScoreTagsForColumn(mock_scores),
        )

        # Process column
        tag_labels = processor.create_column_tag_labels(column=sample_column, sample_data=sample_email_password_data)

        # Should only have PII tag
        assert len(tag_labels) == 1, (
            f"Should only return PII tag, got {len(tag_labels)}: {[l.tagFQN for l in tag_labels]}"  # noqa: E741
        )
        assert tag_labels[0].tagFQN.root == "PII.Sensitive"

    def test_max_tags_per_column_limit(
        self,
        metadata: Mock,
        workflow_config,
        general_classification_non_exclusive,
        sample_column,
        sample_email_password_data,
    ):
        """
        Test that max_tags_per_column limit is enforced.
        """
        # Create 5 General tags
        general_tags = []
        for i in range(5):
            email_recognizer = PredefinedRecognizerFactory.create(name=Name.EmailRecognizer)
            recognizer = RecognizerFactory.create(
                name="email_recognizer",
                recognizerConfig=email_recognizer,
            )
            tag = TagFactory.create(
                tag_name=f"Tag_{i}",
                tag_classification=general_classification_non_exclusive,
                autoClassificationEnabled=True,
                autoClassificationPriority=80 - i,
                recognizers=[recognizer],
                description=f"Tag {i}'s description",
            )
            general_tags.append(tag)

        classification_manager = FakeClassificationManager(
            (general_classification_non_exclusive, general_tags),
        )

        # All 5 tags score above threshold
        mock_scores = [
            ScoredTag(
                tag=tag,
                score=0.70 + i * 0.02,  # Scores: 0.70, 0.72, 0.74, 0.76, 0.78
                reason=f"Tag{i} detected",
            )
            for i, tag in enumerate(general_tags)
        ]

        # Create TagProcessor with limit of 3 tags
        processor = TagProcessor(
            config=workflow_config,
            metadata=metadata,
            max_tags_per_column=3,  # Limit to 3 tags
            classification_manager=classification_manager,
            score_tags_for_column=FakeScoreTagsForColumn(mock_scores),
        )

        # Process column
        tag_labels = processor.create_column_tag_labels(column=sample_column, sample_data=sample_email_password_data)

        # Should only return top 3 tags by score
        assert len(tag_labels) == 3, f"Should limit to 3 tags, got {len(tag_labels)}"

        # Should be the highest scoring tags (Tag4, Tag3, Tag2)
        tag_fqns = [label.tagFQN.root for label in tag_labels]
        assert "General.Tag_4" in tag_fqns  # Highest score: 0.78
        assert "General.Tag_3" in tag_fqns  # Score: 0.76
        assert "General.Tag_2" in tag_fqns  # Score: 0.74

    def test_skip_already_tagged_columns(
        self,
        metadata: Mock,
        workflow_config,
        pii_classification_mutually_exclusive,
        pii_sensitive_tag,
        sample_email_password_data,
    ):
        """
        Test that already-applied tags are not re-suggested.
        """

        classification_manager = FakeClassificationManager(
            (pii_classification_mutually_exclusive, [pii_sensitive_tag]),
        )

        # Column already has PII.Sensitive tag - mock tagFQN properly
        column_with_tag = ColumnFactory.create(
            column_name="user_password",
            dataType=DataType.VARCHAR,
            tags=[
                TagLabelFactory.create(
                    parent="PII",
                    name="Sensitive",
                )
            ],
        )

        score_tags_for_column = Mock()
        processor = TagProcessor(
            config=workflow_config,
            metadata=metadata,
            classification_manager=classification_manager,
            score_tags_for_column=score_tags_for_column,
            max_tags_per_column=10,
        )

        tag_labels = processor.create_column_tag_labels(column=column_with_tag, sample_data=sample_email_password_data)

        assert len(tag_labels) == 0, (
            f"Should not re-suggest existing tags, got {len(tag_labels)}: {[l.tagFQN for l in tag_labels]}"  # noqa: E741
        )
        score_tags_for_column.assert_not_called()

    def test_idempotent_mutually_exclusive_tags(
        self,
        metadata: Mock,
        workflow_config,
        sample_email_password_data,
    ):
        """
        Test that ensures idempotency across runs with mutually exclusive classifications.
        """
        # Create mutually exclusive classification with Date and Birthday tags
        classification = ClassificationFactory.create(
            fqn="General",
            mutuallyExclusive=True,
            autoClassificationConfig__enabled=True,
            autoClassificationConfig__conflictResolution=ConflictResolution.highest_confidence,
            autoClassificationConfig__minimumConfidence=0.7,
            autoClassificationConfig__requireExplicitMatch=True,
            description="General classifications",
        )

        # Date recognizers
        date_recognizer = RecognizerFactory.create(
            name="date_recognizer",
            recognizerConfig=PredefinedRecognizerFactory.create(
                name=Name.DateRecognizer,
            ),
        )

        # Create Date tag
        date_tag = TagFactory.create(
            tag_name="Date",
            tag_classification=classification,
            autoClassificationEnabled=True,
            autoClassificationPriority=90,
            recognizers=[date_recognizer],
            description="Date field",
        )

        # Create Birthday tag
        birthday_tag = TagFactory.create(
            tag_name="Birthday",
            tag_classification=classification,
            autoClassificationEnabled=True,
            autoClassificationPriority=85,
            recognizers=[
                date_recognizer,
            ],
            description="Birthday field",
        )

        classification_manager = FakeClassificationManager(
            (classification, [date_tag, birthday_tag]),
        )

        # Create column with name that matches both patterns
        column = ColumnFactory.create(
            column_name="birth_date",
            dataType=DataType.VARCHAR,
            tags=[],
        )

        # FIRST RUN: Both tags score above threshold
        first_run_scores = [
            ScoredTag(
                tag=date_tag,
                score=0.9,
                reason="Date pattern matched column name",
            ),
            ScoredTag(
                tag=birthday_tag,
                score=0.8,
                reason="Birthday pattern matched column name",
            ),
        ]

        processor_first_run = TagProcessor(
            config=workflow_config,
            metadata=metadata,
            classification_manager=classification_manager,
            score_tags_for_column=FakeScoreTagsForColumn(first_run_scores),
            max_tags_per_column=10,
        )

        # First run: Should apply only Date (highest score)
        first_run_labels = processor_first_run.create_column_tag_labels(
            column=column, sample_data=sample_email_password_data
        )

        assert len(first_run_labels) == 1, (
            f"First run should return 1 tag (Date), got {len(first_run_labels)}: {[l.tagFQN for l in first_run_labels]}"  # noqa: E741
        )
        assert first_run_labels[0].tagFQN.root == "General.Date"

        # Simulate column now having Date tag applied
        column_with_date = ColumnFactory.create(
            column_name="birth_date",
            dataType=DataType.VARCHAR,
            tags=[
                TagLabelFactory.create(
                    parent="General",
                    name="Date",
                )
            ],
        )

        # SECOND RUN: Only Birthday scores (Date is filtered out)
        second_run_scores = [
            ScoredTag(
                tag=birthday_tag,
                score=0.8,
                reason="Birthday pattern matched column name",
            ),
            # Date is not in scored tags because it's already applied
        ]

        processor_second_run = TagProcessor(
            config=workflow_config,
            metadata=metadata,
            classification_manager=classification_manager,
            score_tags_for_column=FakeScoreTagsForColumn(second_run_scores),
            max_tags_per_column=10,
        )

        # Second run: Should return empty list (mutually exclusive classification
        # already has a tag)
        second_run_labels = processor_second_run.create_column_tag_labels(
            column=column_with_date, sample_data=sample_email_password_data
        )

        # Expected: 0 tags (Date already applied from mutually exclusive classification)
        # Actual: 1 tag (Birthday gets suggested, violating mutual exclusivity)
        assert len(second_run_labels) == 0, (
            f"Second run should return 0 tags (mutually exclusive "
            f"classification already has Date tag applied), but got {len(second_run_labels)}: "
            f"{[l.tagFQN for l in second_run_labels]}"  # noqa: E741
        )
