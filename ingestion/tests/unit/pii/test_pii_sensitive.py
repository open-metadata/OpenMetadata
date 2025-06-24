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

import gc
import weakref
from unittest.mock import Mock, patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.tagLabel import LabelType, State, TagSource
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.algorithms.tags import PIISensitivityTag
from metadata.pii.processor import PIIProcessor


def test_pii_processor_build_tag_label_for_pii_sensitive():

    tag = PIISensitivityTag.SENSITIVE
    tag_label = PIIProcessor.build_tag_label(tag)

    assert tag_label.tagFQN.root == "PII.Sensitive"
    assert tag_label.source == TagSource.Classification
    assert tag_label.state == State.Suggested
    assert tag_label.labelType == LabelType.Generated


def test_pii_processor_build_tag_label_for_pii_nonsensitive():
    tag = PIISensitivityTag.NONSENSITIVE
    tag_label = PIIProcessor.build_tag_label(tag)

    assert tag_label.tagFQN.root == "PII.NonSensitive"
    assert tag_label.source == TagSource.Classification
    assert tag_label.state == State.Suggested
    assert tag_label.labelType == LabelType.Generated


@patch("metadata.pii.algorithms.presidio_utils.clear_presidio_caches")
def test_pii_processor_close_cleans_up_resources(mock_clear_caches):
    """
    Test that PIIProcessor.close() properly cleans up resources to prevent memory leaks.
    """
    # Mock the configuration and metadata client
    mock_config = Mock(spec=OpenMetadataWorkflowConfig)
    mock_config.source.sourceConfig.config.confidence = 80
    mock_metadata = Mock(spec=OpenMetadata)

    # Create PIIProcessor instance
    processor = PIIProcessor(mock_config, mock_metadata)

    # Mock the classifier to test cleanup
    mock_classifier = Mock()
    mock_nested_classifier = Mock()
    mock_analyzer = Mock()
    mock_registry = Mock()
    mock_recognizers = Mock()
    mock_nlp_engine = Mock()
    mock_models = Mock()
    mock_patterns = Mock()

    # Set up the mock hierarchy
    mock_classifier.classifier = mock_nested_classifier
    mock_nested_classifier._presidio_analyzer = mock_analyzer
    mock_analyzer.registry = mock_registry
    mock_registry.recognizers = mock_recognizers
    mock_analyzer.nlp_engine = mock_nlp_engine
    mock_nlp_engine._models = mock_models
    mock_nested_classifier._column_name_patterns = mock_patterns

    processor._classifier = mock_classifier

    # Call close
    processor.close()

    # Verify cleanup was called
    mock_recognizers.clear.assert_called_once()
    mock_models.clear.assert_called_once()
    mock_patterns.clear.assert_called_once()
    mock_clear_caches.assert_called_once()

    # Verify classifier reference was removed
    assert not hasattr(processor, "_classifier")


def test_pii_processor_memory_cleanup_with_real_classifier():
    """
    Test memory cleanup with actual classifier objects to ensure weak references work.
    """
    # Mock the configuration and metadata client
    mock_config = Mock(spec=OpenMetadataWorkflowConfig)
    mock_config.source.sourceConfig.config.confidence = 80
    mock_metadata = Mock(spec=OpenMetadata)

    # Create PIIProcessor instance
    processor = PIIProcessor(mock_config, mock_metadata)

    # Get weak reference to the classifier
    classifier_ref = weakref.ref(processor._classifier)

    # Verify classifier exists
    assert classifier_ref() is not None, "Classifier should exist"

    # Close processor
    processor.close()

    # Force garbage collection
    gc.collect()

    # The classifier might still exist due to other references,
    # but the processor should no longer hold a reference
    assert not hasattr(
        processor, "_classifier"
    ), "Processor should not hold classifier reference"


def test_pii_processor_close_handles_exceptions():
    """
    Test that PIIProcessor.close() handles exceptions gracefully during cleanup.
    """
    # Mock the configuration and metadata client
    mock_config = Mock(spec=OpenMetadataWorkflowConfig)
    mock_config.source.sourceConfig.config.confidence = 80
    mock_metadata = Mock(spec=OpenMetadata)

    # Create PIIProcessor instance
    processor = PIIProcessor(mock_config, mock_metadata)

    # Mock classifier that raises exception during cleanup
    mock_classifier = Mock()
    mock_classifier.classifier = Mock()

    # Make getattr raise an exception
    def side_effect(*args, **kwargs):
        raise AttributeError("Test exception")

    processor._classifier = mock_classifier

    # Patch getattr to raise exception
    with patch("builtins.getattr", side_effect=side_effect):
        # This should not raise an exception
        processor.close()

    # Processor should still be in a valid state
    assert not hasattr(processor, "_classifier")


@patch("metadata.pii.algorithms.presidio_utils.clear_presidio_caches")
def test_pii_processor_close_without_classifier(mock_clear_caches):
    """
    Test that PIIProcessor.close() works when no classifier is present.
    """
    # Mock the configuration and metadata client
    mock_config = Mock(spec=OpenMetadataWorkflowConfig)
    mock_config.source.sourceConfig.config.confidence = 80
    mock_metadata = Mock(spec=OpenMetadata)

    # Create PIIProcessor instance
    processor = PIIProcessor(mock_config, mock_metadata)

    # Remove classifier
    delattr(processor, "_classifier")

    # Call close - should not raise exception
    processor.close()

    # Cache clearing should still be called
    mock_clear_caches.assert_called_once()


def test_multiple_pii_processor_cleanup():
    """
    Test that multiple PIIProcessor instances can be cleaned up without issues.
    """
    processors = []

    # Create multiple processors
    for _ in range(3):
        mock_config = Mock(spec=OpenMetadataWorkflowConfig)
        mock_config.source.sourceConfig.config.confidence = 80
        mock_metadata = Mock(spec=OpenMetadata)

        processor = PIIProcessor(mock_config, mock_metadata)
        processors.append(processor)

    # Clean up all processors
    for processor in processors:
        processor.close()

    # Verify all processors are cleaned up
    for processor in processors:
        assert not hasattr(processor, "_classifier")


def test_pii_processor_close_idempotent():
    """
    Test that calling close() multiple times is safe.
    """
    # Mock the configuration and metadata client
    mock_config = Mock(spec=OpenMetadataWorkflowConfig)
    mock_config.source.sourceConfig.config.confidence = 80
    mock_metadata = Mock(spec=OpenMetadata)

    # Create PIIProcessor instance
    processor = PIIProcessor(mock_config, mock_metadata)

    # Call close multiple times - should not raise exception
    processor.close()
    processor.close()
    processor.close()

    # Processor should still be in valid state
    assert not hasattr(processor, "_classifier")
