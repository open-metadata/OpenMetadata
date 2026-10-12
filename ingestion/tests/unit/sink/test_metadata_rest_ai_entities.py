#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Verify AI Governance records use resources that do not expose bulk endpoints."""

from unittest.mock import Mock

import pytest

from metadata.generated.schema.api.ai.createAIApplication import (
    CreateAIApplicationRequest,
)
from metadata.generated.schema.api.ai.createLLMModel import CreateLLMModelRequest
from metadata.generated.schema.api.ai.createMcpServer import CreateMcpServerRequest
from metadata.generated.schema.entity.ai.aiApplication import ApplicationType
from metadata.generated.schema.entity.ai.mcpServer import ServerType
from metadata.ingestion.sink.metadata_rest import (
    MetadataRestSink,
    MetadataRestSinkConfig,
)


@pytest.fixture
def metadata() -> Mock:
    client = Mock()
    client.create_or_update.side_effect = lambda request: request
    return client


@pytest.fixture
def sink(metadata: Mock) -> MetadataRestSink:
    return MetadataRestSink(
        MetadataRestSinkConfig(bulk_sink_batch_size=1),
        metadata,
    )


@pytest.mark.parametrize(
    "entity_request",
    [
        CreateLLMModelRequest(
            name="claims-model",
            baseModel="gpt-4o",
            service="sample_llm_service",
        ),
        CreateMcpServerRequest(
            name="claims-tools",
            service="sample_mcp_service",
            serverType=ServerType.Custom,
        ),
        CreateAIApplicationRequest(
            name="claims-copilot",
            applicationType=ApplicationType.Copilot,
        ),
    ],
)
def test_ai_governance_records_use_single_entity_put(
    sink: MetadataRestSink,
    metadata: Mock,
    entity_request: object,
) -> None:
    result = sink.write_create_request(entity_request)

    assert result.right is entity_request
    metadata.create_or_update.assert_called_once_with(entity_request)
    metadata.create_or_update_bulk.assert_not_called()
    assert sink.buffer == []
