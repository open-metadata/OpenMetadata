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

"""SamplerProcessor construction when the workflow declares no processor.

Messaging and storage auto-classification have nothing to configure there, so
the block is routinely omitted.
"""

from copy import deepcopy
from unittest.mock import MagicMock

import pytest

from metadata.sampler.processor import SamplerProcessor

BASE_CONFIG = {
    "source": {
        "type": "kafka",
        "serviceName": "kafka_test",
        "serviceConnection": {
            "config": {
                "type": "Kafka",
                "bootstrapServers": "localhost:9092",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "AutoClassification",
                "storeSampleData": True,
                "enableAutoClassification": True,
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}


@pytest.mark.parametrize(
    "processor",
    [
        pytest.param(None, id="no-processor-block"),
        pytest.param({"type": "orm-profiler"}, id="processor-without-config"),
        pytest.param({"type": "orm-profiler", "config": {}}, id="processor-with-empty-config"),
    ],
)
def test_processor_block_is_optional(processor) -> None:
    config = deepcopy(BASE_CONFIG)
    if processor is not None:
        config["processor"] = processor

    sampler_processor = SamplerProcessor.create(config, MagicMock())

    assert sampler_processor.profiler_config is not None


@pytest.mark.parametrize(
    "processor",
    [
        pytest.param(None, id="no-processor-block"),
        pytest.param({"type": "orm-profiler"}, id="processor-without-config"),
    ],
)
def test_profiler_source_accepts_an_absent_processor(processor) -> None:
    """The auto-classification fetcher builds a ProfilerSource, so it sees the same config."""
    from metadata.ingestion.api.parser import parse_workflow_config_gracefully
    from metadata.profiler.source.database.base.profiler_source import ProfilerSource

    config = deepcopy(BASE_CONFIG)
    if processor is not None:
        config["processor"] = processor

    source = ProfilerSource(
        config=parse_workflow_config_gracefully(config),
        database=MagicMock(),
        ometa_client=MagicMock(),
        global_profiler_configuration=MagicMock(),
    )

    assert source.profiler_config is not None
