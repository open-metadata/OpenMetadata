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
"""Unit tests for the PipelineServiceSource base connection lifecycle."""

from unittest.mock import MagicMock, patch

import pytest
from tests.unit.topology.pipeline.test_flink import mock_flink_config

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.pipeline.flink.metadata import FlinkSource

PIPELINE_SERVICE_MODULE = "metadata.ingestion.source.pipeline.pipeline_service"


@patch(f"{PIPELINE_SERVICE_MODULE}.run_test_connection")
@patch(f"{PIPELINE_SERVICE_MODULE}.create_connection")
def test_owned_connection_closed_when_test_connection_fails(mock_create_connection, mock_run_test_connection):
    """A failing test-connection in __init__ disposes the owned connection and
    re-raises the original error without running the source's ``close()`` (whose
    subclass overrides touch attributes the source ``__init__`` never set)."""
    mock_run_test_connection.side_effect = RuntimeError("cannot connect")
    config = OpenMetadataWorkflowConfig.model_validate(mock_flink_config)

    with patch.object(FlinkSource, "close") as mock_close, pytest.raises(RuntimeError):
        FlinkSource(config.source, MagicMock())

    mock_create_connection.return_value.close.assert_called_once()
    mock_close.assert_not_called()
