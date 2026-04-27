#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");

"""
Tests verifying that the bulk sink buffer is properly cleared when
bulk_create_or_update raises an exception, preventing:
  1. Stale entities accumulating in the buffer
  2. Unbounded buffer growth across flushes
  3. Duplicate entities sent on subsequent flushes
  4. Stale dedup tracking in buffered_entity_names
"""

from unittest.mock import MagicMock, Mock

import pytest

from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.entity.data.dashboardDataModel import DataModelType
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.ingestion.sink.metadata_rest import (
    MetadataRestSink,
    MetadataRestSinkConfig,
)


def _make_data_model(name: str, display_name: str) -> CreateDashboardDataModelRequest:
    return CreateDashboardDataModelRequest(
        name=EntityName(name),
        displayName=display_name,
        service=FullyQualifiedEntityName("test_service"),
        dataModelType=DataModelType.QuickSightDataModel,
        columns=[Column(name="col1", dataType=DataType.STRING)],
    )


@pytest.fixture
def sink():
    mock_metadata = Mock()
    config = MetadataRestSinkConfig(bulk_sink_batch_size=3)
    return MetadataRestSink(config, mock_metadata)


class TestBufferClearedOnFlushException:
    """Verify that when bulk_create_or_update throws an exception the buffer
    and dedup tracking dict are still cleared, preventing memory leaks."""

    def test_buffer_cleared_after_flush_exception(self, sink):
        """Buffer must be empty after a failed flush so that stale entities
        do not accumulate in memory."""
        sink.metadata.bulk_create_or_update = Mock(side_effect=Exception("Connection refused"))

        sink.write_create_request(_make_data_model("dm-1", "Model 1"))
        sink.write_create_request(_make_data_model("dm-2", "Model 2"))
        sink.write_create_request(_make_data_model("dm-3", "Model 3"))

        assert len(sink.buffer) == 0

    def test_buffer_does_not_grow_across_failed_flushes(self, sink):
        """With continuous failures the buffer must stay bounded at
        batch_size, not grow linearly with total entities ingested."""
        sink.metadata.bulk_create_or_update = Mock(side_effect=Exception("Connection refused"))

        # Three consecutive batches, all failing
        for i in range(9):
            sink.write_create_request(_make_data_model(f"dm-{i}", f"Model {i}"))

        # Buffer should contain at most the last partial batch (0, 1, or 2
        # entities) — never more than batch_size
        assert len(sink.buffer) < sink.config.bulk_sink_batch_size

    def test_no_duplicate_entities_on_subsequent_flush(self, sink):
        """After a failed flush, the next flush must only contain new
        entities — not stale ones from the failed batch."""
        call_count = 0
        entities_per_call = []

        def track_bulk_calls(entities, use_async=False):
            nonlocal call_count
            call_count += 1
            entities_per_call.append([e.displayName for e in entities])
            if call_count == 1:
                raise Exception("Transient failure")
            result = MagicMock()
            result.status.value = "success"
            result.numberOfRowsProcessed.root = len(entities)
            result.numberOfRowsFailed.root = 0
            result.successRequest = entities
            result.failedRequest = []
            return result

        sink.metadata.bulk_create_or_update = Mock(side_effect=track_bulk_calls)

        # First batch: flush fails
        sink.write_create_request(_make_data_model("dm-1", "Model 1"))
        sink.write_create_request(_make_data_model("dm-2", "Model 2"))
        sink.write_create_request(_make_data_model("dm-3", "Model 3"))

        assert call_count == 1
        assert entities_per_call[0] == ["Model 1", "Model 2", "Model 3"]

        # Second batch: flush succeeds — must only contain new entities
        sink.write_create_request(_make_data_model("dm-4", "Model 4"))
        sink.write_create_request(_make_data_model("dm-5", "Model 5"))
        sink.write_create_request(_make_data_model("dm-6", "Model 6"))

        assert call_count == 2
        assert entities_per_call[1] == ["Model 4", "Model 5", "Model 6"]

    def test_dedup_tracking_cleared_after_flush_exception(self, sink):
        """buffered_entity_names must be cleared alongside the buffer so that
        a re-sent entity with the same name is not incorrectly rejected."""
        sink.metadata.bulk_create_or_update = Mock(side_effect=Exception("Connection refused"))

        dm = _make_data_model("same-name", "Original Model")
        sink.write_create_request(dm)
        # Flush hasn't triggered yet (1 < batch_size=3), so tracking is populated
        assert (
            "CreateDashboardDataModelRequest",
            "same-name",
        ) in sink.buffered_entity_names

        # Add two more to trigger the flush (which fails)
        sink.write_create_request(_make_data_model("dm-2", "Model 2"))
        sink.write_create_request(_make_data_model("dm-3", "Model 3"))

        # After the failed flush, both buffer and tracking dict are cleared
        assert len(sink.buffered_entity_names) == 0

        # Re-sending the same entity name should now be accepted into the buffer
        dm_retry = _make_data_model("same-name", "Retry Model")
        sink.write_create_request(dm_retry)
        assert len(sink.buffer) == 1
        assert sink.buffer[0].displayName == "Retry Model"

    def test_close_does_not_flush_stale_entities(self, sink):
        """After failed flushes that properly clear the buffer, close()
        should only flush the remaining partial batch — not accumulated
        stale entities from prior failures."""
        call_count = 0
        entities_per_call = []

        def track_bulk_calls(entities, use_async=False):
            nonlocal call_count
            call_count += 1
            entities_per_call.append(len(entities))
            if call_count <= 2:
                raise Exception("Transient failure")
            result = MagicMock()
            result.status.value = "success"
            result.numberOfRowsProcessed.root = len(entities)
            result.numberOfRowsFailed.root = 0
            result.successRequest = entities
            result.failedRequest = []
            return result

        sink.metadata.bulk_create_or_update = Mock(side_effect=track_bulk_calls)

        # First batch (3 entities): flush fails (call 1), buffer cleared
        sink.write_create_request(_make_data_model("dm-1", "M1"))
        sink.write_create_request(_make_data_model("dm-2", "M2"))
        sink.write_create_request(_make_data_model("dm-3", "M3"))
        assert call_count == 1

        # Second batch (3 entities): flush fails (call 2), buffer cleared
        sink.write_create_request(_make_data_model("dm-4", "M4"))
        sink.write_create_request(_make_data_model("dm-5", "M5"))
        sink.write_create_request(_make_data_model("dm-6", "M6"))
        assert call_count == 2

        # Partial batch (2 entities): no flush triggered yet
        sink.write_create_request(_make_data_model("dm-7", "M7"))
        sink.write_create_request(_make_data_model("dm-8", "M8"))
        assert len(sink.buffer) == 2

        # close() flushes only the 2 remaining entities (call 3) — succeeds
        sink.close()

        assert call_count == 3
        assert entities_per_call[2] == 2
