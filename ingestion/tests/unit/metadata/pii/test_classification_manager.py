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
Unit tests for ClassificationRunManager.
"""
from unittest.mock import Mock, create_autospec

import pytest

from metadata.generated.schema.entity.classification.classification import (
    Classification,
    ConflictResolution,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.classification_manager import ClassificationManager


class TestClassificationRunManager:
    """Tests for ClassificationRunManager."""

    @pytest.fixture
    def metadata(self) -> Mock:
        mock = create_autospec(OpenMetadata, instance=True, spec_set=True)

        return mock

    def test_get_enabled_classifications(
        self,
        metadata,
        pii_classification: Classification,
        general_classification: Classification,
        disabled_classification: Classification,
    ):
        """Test fetching enabled classifications."""
        metadata.list_all_entities.return_value = [
            pii_classification,
            general_classification,
            disabled_classification,
        ]

        manager = ClassificationManager(metadata)
        enabled = manager.get_enabled_classifications()

        # Should return only enabled classifications (PII and General)
        assert len(enabled) == 2
        classification_names = [c.name.root for c in enabled]
        assert "PII" in classification_names
        assert "General" in classification_names
        assert "Disabled" not in classification_names

        # Verify configs are populated correctly
        pii_config = next(
            c.autoClassificationConfig for c in enabled if c.name.root == "PII"
        )
        assert pii_config.minimumConfidence == 0.7
        assert pii_config.conflictResolution == ConflictResolution.highest_confidence
        assert pii_config.enabled is True

    def test_get_enabled_classifications_with_filter(
        self,
        metadata,
        pii_classification: Classification,
        general_classification: Classification,
    ):
        """Test fetching enabled classifications with name filter."""
        metadata.list_all_entities.return_value = [
            pii_classification,
            general_classification,
        ]

        manager = ClassificationManager(metadata)
        enabled = manager.get_enabled_classifications(filter_names=["PII"])

        # Should return only PII
        assert len(enabled) == 1
        assert enabled[0].name.root == "PII"

    def test_get_enabled_classifications_caching(
        self, metadata, pii_classification: Classification
    ):
        """Test that classifications are cached."""
        metadata.list_all_entities.return_value = [pii_classification]

        manager = ClassificationManager(metadata)

        # First call
        enabled1 = manager.get_enabled_classifications()
        # Second call
        enabled2 = manager.get_enabled_classifications()

        # Should only call API once
        assert metadata.list_all_entities.call_count == 1
        assert enabled1 == enabled2

    def test_get_enabled_tags(
        self,
        metadata,
        pii_classification: Classification,
        email_tag_pii: Tag,
        phone_tag_pii: Tag,
        disabled_tag: Tag,
        tag_without_recognizers: Tag,
    ):
        """Test fetching enabled tags with recognizers."""
        metadata.list_all_entities.return_value = [
            email_tag_pii,
            phone_tag_pii,
            disabled_tag,
            tag_without_recognizers,
        ]

        manager = ClassificationManager(metadata)
        tags = manager.get_enabled_tags(classifications=[pii_classification])

        # Should return only enabled tags with recognizers
        assert len(tags) == 2
        tag_names = [t.name.root for t in tags]
        assert "Email" in tag_names
        assert "Phone" in tag_names
        assert "DisabledTag" not in tag_names
        assert "NoRecognizers" not in tag_names

    def test_get_enabled_tags_multiple_classifications(
        self,
        metadata,
        pii_classification: Classification,
        general_classification: Classification,
        email_tag_pii: Tag,
        credit_card_tag_general: Tag,
    ):
        """Test fetching tags from multiple classifications."""

        def list_entities_side_effect(entity, fields, params):
            if params.get("parent") == "PII":
                return [email_tag_pii]
            elif params.get("parent") == "General":
                return [credit_card_tag_general]
            return []

        metadata.list_all_entities.side_effect = list_entities_side_effect

        manager = ClassificationManager(metadata)
        tags = manager.get_enabled_tags(
            classifications=[pii_classification, general_classification]
        )

        # Should return tags from both classifications
        assert len(tags) == 2
        tag_fqns = {t.fullyQualifiedName for t in tags}
        assert "PII.Email" in tag_fqns
        assert "General.CreditCard" in tag_fqns

    def test_get_enabled_tags_caching(
        self, metadata, pii_classification: Classification, email_tag_pii: Tag
    ):
        """Test that tags are cached."""
        metadata.list_all_entities.return_value = [email_tag_pii]

        manager = ClassificationManager(metadata)

        # First call
        tags1 = manager.get_enabled_tags(classifications=[pii_classification])
        # Second call
        tags2 = manager.get_enabled_tags(classifications=[pii_classification])

        # Should only call API once
        assert metadata.list_all_entities.call_count == 1
        assert tags1 == tags2

    def test_clear_cache(
        self, metadata, pii_classification: Classification, email_tag_pii: Tag
    ):
        """Test clearing the cache."""
        metadata.list_all_entities.return_value = [pii_classification]

        manager = ClassificationManager(metadata)

        # First call
        manager.get_enabled_classifications()
        assert metadata.list_all_entities.call_count == 1

        # Clear cache
        manager.clear_cache()

        # Second call should hit API again
        manager.get_enabled_classifications()
        assert metadata.list_all_entities.call_count == 2

    def test_get_enabled_classifications_api_error(self, metadata):
        """Test handling of API errors."""
        metadata.list_all_entities.side_effect = Exception("API Error")

        manager = ClassificationManager(metadata)
        enabled = manager.get_enabled_classifications()

        # Should return empty list on error
        assert enabled == []

    def test_get_enabled_tags_api_error(
        self, metadata, pii_classification: Classification
    ):
        """Test handling of API errors when fetching tags."""
        metadata.list_all_entities.side_effect = Exception("API Error")

        manager = ClassificationManager(metadata)
        tags = manager.get_enabled_tags(classifications=[pii_classification])

        # Should return empty list on error
        assert tags == []
