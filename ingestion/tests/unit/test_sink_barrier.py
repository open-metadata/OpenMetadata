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
"""Tests for MetadataRestSink.write_barrier dispatcher.

Guards the contract that a Barrier record flushes the bulk buffer
synchronously so subsequent records in the same stream see committed
entities.
"""

from unittest.mock import MagicMock, Mock

import pytest

from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.entity.data.dashboardDataModel import DataModelType
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.sink.metadata_rest import MetadataRestSink, MetadataRestSinkConfig


def _make_data_model(name: str) -> CreateDashboardDataModelRequest:
    return CreateDashboardDataModelRequest(
        name=EntityName(name),
        displayName=name,
        service=FullyQualifiedEntityName("test_service"),
        dataModelType=DataModelType.QuickSightDataModel,
        columns=[Column(name="col1", dataType=DataType.STRING)],
    )


def _mock_bulk_success(entities, use_async=False):
    result = MagicMock()
    result.status.value = "success"
    result.numberOfRowsProcessed.root = len(entities)
    result.numberOfRowsFailed.root = 0
    result.successRequest = entities
    result.failedRequest = []
    return result


@pytest.fixture
def sink():
    mock_metadata = Mock()
    mock_metadata.bulk_create_or_update = Mock(side_effect=_mock_bulk_success)
    config = MetadataRestSinkConfig(bulk_sink_batch_size=10)
    return MetadataRestSink(config, mock_metadata)


class TestBarrierDispatcher:
    """write_barrier must flush the buffer when non-empty and be a no-op when empty."""

    def test_barrier_flushes_non_empty_buffer(self, sink):
        """A Barrier on a non-empty buffer triggers bulk_create_or_update."""
        sink.write_create_request(_make_data_model("dm-1"))
        sink.write_create_request(_make_data_model("dm-2"))
        assert len(sink.buffer) == 2

        sink.write_barrier(Barrier(reason="test"))

        sink.metadata.bulk_create_or_update.assert_called_once()
        # Buffer should be empty after flush
        assert len(sink.buffer) == 0

    def test_barrier_on_empty_buffer_is_noop(self, sink):
        """A Barrier on an empty buffer must not call bulk_create_or_update."""
        assert len(sink.buffer) == 0

        result = sink.write_barrier(Barrier(reason="empty"))

        sink.metadata.bulk_create_or_update.assert_not_called()
        # Returns Either(right=None) — protocol-conformant
        assert result is not None
        assert result.right is None
