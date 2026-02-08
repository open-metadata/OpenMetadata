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
from typing import Any, List, Sequence
from unittest.mock import Mock, create_autospec

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
from metadata.generated.schema.type.predefinedRecognizer import Name
from metadata.generated.schema.type.recognizer import Target
from metadata.generated.schema.type.tagLabel import LabelType, State, TagSource
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.models import ScoredTag
from metadata.pii.tag_processor import TagProcessor


class FakeScoreTagsForColumn:
    def __init__(self, scored_tags: List[ScoredTag]) -> None:
        self.scored_tags = scored_tags

    def __call__(
        self, column: Column, data: Sequence[Any], tags_to_analyze: List[Tag]
    ) -> List[ScoredTag]:
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
    def general_password_tag(
        self, general_classification_non_exclusive: Classification
    ):
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
        tag_labels = processor.create_column_tag_labels(
            column=sample_column, sample_data=sample_email_password_data
        )

        # Verify results
        assert (
            len(tag_labels) == 3
        ), f"Should return 3 tags (1 PII + 2 General), got {len(tag_labels)}: {[l.tagFQN for l in tag_labels]}"

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
        tag_labels = processor.create_column_tag_labels(
            column=sample_column, sample_data=sample_email_password_data
        )

        # Verify results
        assert (
            len(tag_labels) == 3
        ), f"Should return 3 tags (1 from each classification), got {len(tag_labels)}: {[l.tagFQN for l in tag_labels]}"

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
        tag_labels = processor.create_column_tag_labels(
            column=sample_column, sample_data=sample_email_password_data
        )

        # Should only have PII tag
        assert (
            len(tag_labels) == 1
        ), f"Should only return PII tag, got {len(tag_labels)}: {[l.tagFQN for l in tag_labels]}"
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
            email_recognizer = PredefinedRecognizerFactory.create(
                name=Name.EmailRecognizer
            )
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
        tag_labels = processor.create_column_tag_labels(
            column=sample_column, sample_data=sample_email_password_data
        )

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

        # Create TagProcessor
        processor = TagProcessor(
            config=workflow_config,
            metadata=metadata,
            classification_manager=classification_manager,
            max_tags_per_column=10,
        )

        # Process column
        tag_labels = processor.create_column_tag_labels(
            column=column_with_tag, sample_data=sample_email_password_data
        )

        # Should return empty list (tag already applied)
        assert (
            len(tag_labels) == 0
        ), f"Should not re-suggest existing tags, got {len(tag_labels)}: {[l.tagFQN for l in tag_labels]}"

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
            f"First run should return 1 tag (Date), got {len(first_run_labels)}: "
            f"{[l.tagFQN for l in first_run_labels]}"
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
            f"{[l.tagFQN for l in second_run_labels]}"
        )
