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
Unit tests for OMetaIngestionPipelineMixin.

Covers:
  - run_pipeline parses the trigger endpoint response as a
    PipelineServiceClientResponse instead of an IngestionPipeline.
"""

from unittest.mock import MagicMock

from metadata.generated.schema.entity.services.ingestionPipelines.pipelineServiceClientResponse import (
    PipelineServiceClientResponse,
)
from metadata.ingestion.ometa.mixins.ingestion_pipeline_mixin import (
    OMetaIngestionPipelineMixin,
)

PIPELINE_ID = "00000000-0000-0000-0000-000000000001"
RUN_ID = "00000000-0000-0000-0000-000000000002"


class _Client(OMetaIngestionPipelineMixin):
    def get_suffix(self, entity):
        return "/services/ingestionPipelines"


def _make_client(response: dict) -> _Client:
    client = _Client()
    client.client = MagicMock()
    client.client.post.return_value = response
    return client


def test_run_pipeline_returns_trigger_response():
    client = _make_client(
        {
            "code": 200,
            "reason": "Pipeline triggered successfully",
            "platform": "Kubernetes",
            "runId": RUN_ID,
        }
    )

    response = client.run_pipeline(PIPELINE_ID)

    client.client.post.assert_called_once_with(f"/services/ingestionPipelines/trigger/{PIPELINE_ID}")
    assert isinstance(response, PipelineServiceClientResponse)
    assert response.code == 200
    assert response.platform == "Kubernetes"
    assert response.runId == RUN_ID


def test_run_pipeline_without_run_id():
    client = _make_client(
        {
            "code": 200,
            "reason": "Workflow [test] triggered successfully.",
            "platform": "Airflow",
        }
    )

    response = client.run_pipeline(PIPELINE_ID)

    assert response.code == 200
    assert response.platform == "Airflow"
    assert response.runId is None
