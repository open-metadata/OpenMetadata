#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");

"""
Unit tests for sink-level empty tag validation in write_classification_and_tag
"""

from unittest.mock import Mock, patch

import pytest

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.sink.metadata_rest import (
    MetadataRestSink,
    MetadataRestSinkConfig,
)


class TestSinkEmptyTagValidation:
    """Test that the sink properly validates and skips empty tag names"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test fixtures"""
        self.mock_metadata = Mock()
        self.config = MetadataRestSinkConfig(bulk_sink_batch_size=10)
        self.sink = MetadataRestSink(self.config, self.mock_metadata)

    def _create_tag_record(self, tag_name: str, classification_name: str = "TestClassification"):
        """Helper to create OMetaTagAndClassification record"""
        return OMetaTagAndClassification(
            fqn=FullyQualifiedEntityName("test.fqn"),
            classification_request=CreateClassificationRequest(
                name=EntityName(classification_name),
                description=Markdown("Test classification description"),
            ),
            tag_request=CreateTagRequest(
                classification=FullyQualifiedEntityName(classification_name),
                name=EntityName(tag_name),
                description=Markdown("Test tag description"),
            ),
        )

    def test_valid_tag_is_processed(self):
        """Test that a valid tag with non-empty name is processed successfully"""
        mock_tag = Mock()
        self.mock_metadata.create_or_update.return_value = mock_tag

        record = self._create_tag_record("ValidTagName")
        result = self.sink.write_classification_and_tag(record)

        assert result.right == mock_tag
        assert self.mock_metadata.create_or_update.call_count == 2

    @patch("metadata.ingestion.sink.metadata_rest.logger")
    def test_empty_tag_name_is_skipped(self, mock_logger):
        """Test that a tag with empty name is skipped with a warning"""
        # Reset mock to track calls from this test only
        self.mock_metadata.reset_mock()

        record = OMetaTagAndClassification(
            fqn=FullyQualifiedEntityName("test.fqn"),
            classification_request=CreateClassificationRequest(
                name=EntityName("TestClassification"),
                description=Markdown("Test classification description"),
            ),
            tag_request=CreateTagRequest(
                classification=FullyQualifiedEntityName("TestClassification"),
                name=EntityName(" "),  # Whitespace-only name (empty after strip)
                description=Markdown("Test tag description"),
            ),
        )

        result = self.sink.write_classification_and_tag(record)

        assert result.right is None
        self.mock_metadata.create_or_update.assert_not_called()
        mock_logger.warning.assert_called_once()
        assert "Skipping tag with empty name" in mock_logger.warning.call_args[0][0]

    @patch("metadata.ingestion.sink.metadata_rest.logger")
    def test_whitespace_only_tag_name_is_skipped(self, mock_logger):
        """Test that a tag with whitespace-only name is skipped"""
        # Reset mock to track calls from this test only
        self.mock_metadata.reset_mock()

        record = OMetaTagAndClassification(
            fqn=FullyQualifiedEntityName("test.fqn"),
            classification_request=CreateClassificationRequest(
                name=EntityName("TestClassification"),
                description=Markdown("Test classification description"),
            ),
            tag_request=CreateTagRequest(
                classification=FullyQualifiedEntityName("TestClassification"),
                name=EntityName("   "),  # Multiple spaces
                description=Markdown("Test tag description"),
            ),
        )

        result = self.sink.write_classification_and_tag(record)

        assert result.right is None
        self.mock_metadata.create_or_update.assert_not_called()
        mock_logger.warning.assert_called_once()

    def test_tag_with_spaces_around_valid_name_is_processed(self):
        """Test that a tag with spaces around a valid name is still processed"""
        mock_tag = Mock()
        self.mock_metadata.create_or_update.return_value = mock_tag

        record = self._create_tag_record("  ValidTag  ")
        result = self.sink.write_classification_and_tag(record)

        assert result.right == mock_tag
        assert self.mock_metadata.create_or_update.call_count == 2

    def test_classification_and_tag_api_called_in_order(self):
        """Test that classification is created before tag"""
        mock_classification = Mock()
        mock_tag = Mock()
        self.mock_metadata.create_or_update.side_effect = [mock_classification, mock_tag]

        record = self._create_tag_record("TestTag", "TestClassification")
        self.sink.write_classification_and_tag(record)

        calls = self.mock_metadata.create_or_update.call_args_list
        assert len(calls) == 2
        assert isinstance(calls[0][0][0], CreateClassificationRequest)
        assert isinstance(calls[1][0][0], CreateTagRequest)
