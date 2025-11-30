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
Unit tests for ConflictResolver.
"""

import pytest
from dirty_equals import HasAttributes, IsInstance

from _openmetadata_testutils.factories.metadata.generated.schema.entity.classification.classification import (
    AutoClassificationConfigFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.entity.classification.tag import (
    TagFactory,
)
from _openmetadata_testutils.factories.metadata.pii.models import ScoredTagFactory
from metadata.generated.schema.entity.classification.classification import (
    Classification,
    ConflictResolution,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.basic import EntityName
from metadata.pii.conflict_resolver import ConflictResolver
from metadata.pii.models import ScoredTag


class TestConflictResolver:
    """Tests for ConflictResolver."""

    def test_resolve_conflicts_empty_list(self, pii_classification: Classification):
        """Test resolving conflicts with empty list."""
        resolver = ConflictResolver()
        resolved = resolver.resolve_conflicts(
            scored_tags=[], enabled_classifications=[pii_classification]
        )

        assert resolved == []

    def test_resolve_conflicts_mutually_exclusive_highest_confidence(
        self, pii_classification: Classification, email_tag_pii: Tag, phone_tag_pii: Tag
    ):
        """Test mutually exclusive classification with highest_confidence strategy."""
        # Create tags with different scores
        tag1 = ScoredTagFactory.create(
            tag=email_tag_pii,
            score=0.85,
            reason="Email match",
        )
        tag2 = ScoredTagFactory.create(
            tag=phone_tag_pii,
            score=0.75,
            reason="Phone match",
        )

        resolver = ConflictResolver()
        resolved = resolver.resolve_conflicts(
            scored_tags=[tag1, tag2],
            enabled_classifications=[pii_classification],
        )

        # Should return only highest confidence tag (email)
        assert len(resolved) == 1
        assert resolved[0].tag.name.root == "Email"
        assert resolved[0].score == 0.85

    def test_resolve_conflicts_highest_priority(
        self, pii_classification: Classification, email_tag_pii: Tag, phone_tag_pii: Tag
    ):
        """Test conflict resolution with highest_priority strategy."""

        classification = pii_classification.model_copy()
        classification.autoClassificationConfig = (
            AutoClassificationConfigFactory.create(
                conflictResolution=ConflictResolution.highest_priority,
                minimumConfidence=0.7,
            )
        )

        # Email has lower score but higher priority
        tag1 = ScoredTagFactory.create(
            tag=email_tag_pii,
            score=0.75,
            reason="Email match",
        )
        # Phone has higher score but lower priority
        tag2 = ScoredTagFactory.create(
            tag=phone_tag_pii,
            score=0.85,
            reason="Phone match",
        )

        resolver = ConflictResolver()
        resolved = resolver.resolve_conflicts(
            scored_tags=[tag1, tag2],
            enabled_classifications=[classification],
        )

        # Should return tag with highest priority (email)
        assert len(resolved) == 1
        assert resolved[0] == IsInstance(ScoredTag) & HasAttributes(
            tag=IsInstance(Tag)
            & HasAttributes(
                name=EntityName(root="Email"),
            ),
            priority=80,
        )

    def test_resolve_conflicts_most_specific(self, pii_classification: Classification):
        """Test conflict resolution with most_specific strategy."""
        # Create tags with different hierarchy depths
        general_tag = TagFactory(
            tag_name="Sensitive",
            tag_classification=pii_classification,
            autoClassificationPriority=50,
        )

        specific_tag = TagFactory(
            tag_name="Sensitive.Email",
            tag_classification=pii_classification,
            autoClassificationPriority=50,
        )

        classification = pii_classification.model_copy()
        classification.autoClassificationConfig = (
            AutoClassificationConfigFactory.create(
                conflictResolution=ConflictResolution.most_specific,
                minimumConfidence=0.7,
            )
        )

        tag1 = ScoredTagFactory.create(
            tag=general_tag,
            score=0.85,
            reason="General match",
        )
        tag2 = ScoredTagFactory.create(
            tag=specific_tag,
            score=0.80,
            reason="Specific match",
        )

        resolver = ConflictResolver()
        resolved = resolver.resolve_conflicts(
            scored_tags=[tag1, tag2],
            enabled_classifications=[classification],
        )

        # Should return more specific tag (more dots in FQN)
        assert len(resolved) == 1
        assert resolved[0].tag.fullyQualifiedName == "PII.Sensitive.Email"

    def test_resolve_conflicts_non_mutually_exclusive(
        self, general_classification: Classification, credit_card_tag_general: Tag
    ):
        """Test non-mutually exclusive classification returns all tags."""
        # Create multiple tags above threshold
        tag1 = ScoredTagFactory.create(
            tag=credit_card_tag_general,
            score=0.85,
            reason="Password match",
        )

        tag2 = ScoredTagFactory.create(
            tag__tag_name="Secret",
            tag__tag_classification__fqn="General",
            tag__autoClassificationPriority=85,
            score=0.80,
            reason="Secret match",
        )

        resolver = ConflictResolver()
        resolved = resolver.resolve_conflicts(
            scored_tags=[tag1, tag2],
            enabled_classifications=[general_classification],
        )

        # Should return all tags above threshold
        assert len(resolved) == 2
        tag_names = {t.tag.name.root for t in resolved}
        assert tag_names == {"CreditCard", "Secret"}

    def test_resolve_conflicts_below_threshold(self, pii_classification, email_tag_pii):
        """Test that tags below minimum confidence are filtered out."""
        # Create tag with score below threshold (0.7)
        tag = ScoredTagFactory.create(
            tag=email_tag_pii,
            score=0.65,
            reason="Weak match",
        )

        resolver = ConflictResolver()
        resolved = resolver.resolve_conflicts(
            scored_tags=[tag],
            enabled_classifications=[pii_classification],
        )

        # Should return empty list
        assert resolved == []

    def test_resolve_conflicts_multiple_classifications(
        self,
        pii_classification: Classification,
        general_classification: Classification,
        email_tag_pii: Tag,
        credit_card_tag_general: Tag,
    ):
        """Test resolving conflicts across multiple classifications."""
        tag1 = ScoredTagFactory.create(
            tag=email_tag_pii,
            score=0.85,
            reason="Email match",
        )
        tag2 = ScoredTagFactory.create(
            tag=credit_card_tag_general,
            score=0.90,
            reason="Password match",
        )

        resolver = ConflictResolver()
        resolved = resolver.resolve_conflicts(
            scored_tags=[tag1, tag2],
            enabled_classifications=[pii_classification, general_classification],
        )

        # Should return one tag from each classification
        assert len(resolved) == 2
        classification_names = [t.classification_name for t in resolved]
        assert "PII" in classification_names
        assert "General" in classification_names

    def test_select_winner_single_tag(self, email_tag_pii):
        """Test selecting winner with single tag."""
        tag = ScoredTagFactory.create(
            tag=email_tag_pii,
            score=0.85,
            reason="Email match",
        )

        resolver = ConflictResolver()
        winner = resolver._select_winner([tag], ConflictResolution.highest_confidence)

        assert winner == tag

    def test_select_winner_empty_list(self):
        """Test selecting winner with empty list raises error."""
        resolver = ConflictResolver()

        with pytest.raises(ValueError, match="Cannot select winner from empty list"):
            resolver._select_winner([], ConflictResolution.highest_confidence)

    def test_select_winner_tie_breaker(self, email_tag_pii, phone_tag_pii):
        """Test tie-breaking when scores are equal."""
        # Create tags with same score but different priorities
        tag1 = ScoredTagFactory.create(
            tag=email_tag_pii,
            score=0.85,
            reason="Email match",
        )
        tag2 = ScoredTagFactory.create(
            tag=phone_tag_pii,
            score=0.85,
            reason="Phone match",
        )

        resolver = ConflictResolver()
        winner = resolver._select_winner(
            [tag1, tag2], ConflictResolution.highest_confidence
        )

        # With highest_confidence, should use priority as tie-breaker
        assert winner.tag.name.root == "Email"
        assert winner.priority == 80
