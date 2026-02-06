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
Test fixtures for auto-classification tests.
"""
from typing import Any, Sequence
from unittest.mock import Mock

import pytest

from _openmetadata_testutils.factories.metadata.generated.schema.entity.classification.classification import (
    ClassificationFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.entity.classification.tag import (
    TagFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.type.recognizer import (
    PatternFactory,
    PatternRecognizerFactory,
    PredefinedRecognizerFactory,
    RecognizerFactory,
)
from _openmetadata_testutils.factories.metadata.pii.models import ScoredTagFactory
from metadata.generated.schema.entity.classification.classification import (
    Classification,
    ConflictResolution,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.predefinedRecognizer import Name as PredefinedName
from metadata.generated.schema.type.recognizer import Target
from metadata.pii.models import ScoredTag


@pytest.fixture
def pii_classification() -> Classification:
    """PII classification with auto-classification enabled."""
    return ClassificationFactory.create(
        fqn="PII",
        mutuallyExclusive=True,
        autoClassificationConfig__enabled=True,
        autoClassificationConfig__minimumConfidence=0.7,
        autoClassificationConfig__conflictResolution=ConflictResolution.highest_confidence,
        autoClassificationConfig__requireExplicitMatch=True,
        description="Personal Identifiable Information",
    )


@pytest.fixture
def general_classification() -> Classification:
    """General classification with auto-classification enabled."""
    return ClassificationFactory.create(
        fqn="General",
        mutuallyExclusive=False,
        autoClassificationConfig__enabled=True,
        autoClassificationConfig__minimumConfidence=0.6,
        autoClassificationConfig__conflictResolution=ConflictResolution.highest_confidence,
        autoClassificationConfig__requireExplicitMatch=True,
        description="General data classifications",
    )


@pytest.fixture
def disabled_classification() -> Classification:
    """Classification with auto-classification disabled."""
    return ClassificationFactory.create(
        fqn="Disabled",
        mutuallyExclusive=False,
        autoClassificationConfig__enabled=False,
        autoClassificationConfig__minimumConfidence=0.6,
        autoClassificationConfig__conflictResolution=ConflictResolution.highest_confidence,
        autoClassificationConfig__requireExplicitMatch=True,
        description="Disabled classification",
    )


@pytest.fixture
def email_tag_pii(pii_classification: Classification) -> Tag:
    """Email tag in PII classification."""
    email_pattern = PatternFactory.create(
        name="email-pattern",
        regex=r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    )

    email_pattern_recognizer = PatternRecognizerFactory.create(
        patterns=[email_pattern],
        context=[],
        supportedLanguage="en",
    )

    email_recognizer = RecognizerFactory.create(
        name="email-pattern",
        recognizerConfig=email_pattern_recognizer,
        target=Target.content,
    )

    return TagFactory.create(
        tag_name="Email",
        tag_classification=pii_classification,
        autoClassificationEnabled=True,
        autoClassificationPriority=80,
        recognizers=[email_recognizer],
        description="Email address",
    )


@pytest.fixture
def phone_tag_pii(pii_classification: Classification) -> Tag:
    """Phone tag in PII classification."""
    phone_pattern_1 = PatternFactory.create(
        name="phone-pattern",
        regex=r"\d{3}-\d{3}-\d{4}",
    )
    phone_pattern_2 = PatternFactory.create(
        name="phone-pattern",
        regex=r"\(\d{3}\)\s*\d{3}-\d{4}",
    )

    phone_pattern_recognizer = PatternRecognizerFactory.create(
        patterns=[phone_pattern_1, phone_pattern_2],
        context=[],
        supportedLanguage="en",
    )

    phone_recognizer = RecognizerFactory.create(
        name="phone-pattern",
        recognizerConfig=phone_pattern_recognizer,
        target=Target.content,
    )

    return TagFactory.create(
        tag_name="Phone",
        tag_classification=pii_classification,
        autoClassificationEnabled=True,
        autoClassificationPriority=75,
        recognizers=[phone_recognizer],
        description="Phone number",
    )


@pytest.fixture
def credit_card_tag_general(general_classification: Classification) -> Tag:
    """Credit Card tag in General classification."""
    credit_card_predefined_recognizer = PredefinedRecognizerFactory.create(
        name=PredefinedName.CreditCardRecognizer,
    )

    credit_card_recognizer = RecognizerFactory.create(
        name="credit-card",
        recognizerConfig=credit_card_predefined_recognizer,
        target=Target.content,
    )

    return TagFactory.create(
        tag_name="CreditCard",
        tag_classification=general_classification,
        autoClassificationEnabled=True,
        autoClassificationPriority=90,
        recognizers=[credit_card_recognizer],
        description="Credit Card field",
    )


@pytest.fixture
def disabled_tag(pii_classification: Classification) -> Tag:
    """Tag with auto-classification disabled."""
    return TagFactory.create(
        tag_name="DisabledTag",
        tag_classification=pii_classification,
        autoClassificationEnabled=False,
        autoClassificationPriority=50,
        recognizers=[],
        description="Disabled tag",
    )


@pytest.fixture
def tag_without_recognizers(pii_classification: Classification) -> Tag:
    """Tag without recognizers configured."""
    return TagFactory.create(
        tag_name="NoRecognizers",
        tag_classification=pii_classification,
        autoClassificationEnabled=True,
        autoClassificationPriority=50,
        recognizers=None,
        description="Tag without recognizers",
    )


@pytest.fixture
def sample_email_data() -> Sequence[Any]:
    """Sample data containing email addresses."""
    return [
        "john.doe@example.com",
        "jane.smith@company.org",
        "admin@test.io",
        "user123@domain.net",
    ]


@pytest.fixture
def sample_phone_data() -> Sequence[Any]:
    """Sample data containing phone numbers."""
    return [
        "555-123-4567",
        "(555) 234-5678",
        "555-345-6789",
        "(555) 456-7890",
    ]


@pytest.fixture
def sample_mixed_data() -> Sequence[Any]:
    """Sample data with mixed content."""
    return [
        "john.doe@example.com",
        "555-123-4567",
        "regular text",
        "jane@company.org",
        "(555) 234-5678",
    ]


@pytest.fixture
def sample_low_cardinality_data() -> Sequence[Any]:
    """Sample data with low cardinality (repeated values)."""
    return ["value1", "value1", "value1", "value2", "value2"]


@pytest.fixture
def mock_metadata_client(mocker) -> Mock:
    """Mocked OpenMetadata client."""
    mock_client = mocker.Mock()
    mock_client.list_all_entities = mocker.Mock(return_value=[])
    return mock_client


@pytest.fixture
def scored_email_tag(email_tag_pii: Tag) -> ScoredTag:
    """ScoredTag for email with high confidence."""
    return ScoredTagFactory.create(
        tag=email_tag_pii,
        score=0.85,
        reason="Detected by Email recognizer: content match (score: 0.85)",
    )


@pytest.fixture
def scored_phone_tag(phone_tag_pii: Tag) -> ScoredTag:
    """ScoredTag for phone with medium confidence."""
    return ScoredTagFactory.create(
        tag=phone_tag_pii,
        score=0.75,
        reason="Detected by Phone recognizer: content match (score: 0.75)",
    )


@pytest.fixture
def scored_password_tag(credit_card_tag_general: Tag) -> ScoredTag:
    """ScoredTag for password with high priority."""
    return ScoredTagFactory.create(
        tag=credit_card_tag_general,
        score=0.90,
        reason="Detected by Password recognizer: column name match (score: 0.90)",
    )
