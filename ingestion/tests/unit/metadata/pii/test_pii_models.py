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
Unit tests for auto-classification models.
"""
import pytest

from _openmetadata_testutils.factories.metadata.pii.models import ScoredTagFactory
from metadata.pii.models import ScoredTag


class TestScoredTag:
    """Tests for ScoredTag dataclass."""

    def test_scored_tag_creation(self, scored_email_tag: ScoredTag):
        """Test creating a ScoredTag instance."""
        assert scored_email_tag.score == 0.85
        assert scored_email_tag.classification_name == "PII"
        assert scored_email_tag.priority == 80
        assert "Email" in scored_email_tag.reason

    def test_scored_tag_is_frozen(self, scored_email_tag: ScoredTag):
        """Test that ScoredTag is immutable."""
        with pytest.raises(AttributeError):
            scored_email_tag.score = 0.9  # noqa

    def test_scored_tag_is_hashable(
        self, scored_email_tag: ScoredTag, scored_phone_tag: ScoredTag
    ):
        """Test that ScoredTag can be used in sets and as dict keys."""
        tag_set = {scored_email_tag, scored_phone_tag}
        assert len(tag_set) == 2

        tag_dict = {scored_email_tag: "email", scored_phone_tag: "phone"}
        assert tag_dict[scored_email_tag] == "email"

    def test_scored_tag_equality(self, email_tag_pii):
        """Test ScoredTag equality based on tag FQN."""
        tag1 = ScoredTagFactory.create(
            tag=email_tag_pii,
            score=0.8,
            reason="Test",
        )
        tag2 = ScoredTagFactory.create(
            tag=email_tag_pii,
            score=0.9,
            reason="Different reason",
        )

        # Hash should be based on FQN, so they should have same hash
        assert hash(tag1) == hash(tag2)
