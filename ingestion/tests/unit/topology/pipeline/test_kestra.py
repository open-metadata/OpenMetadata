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
Unit tests for KestraSource.yield_pipeline / yield_pipeline_status /
yield_pipeline_lineage_details, plus get_pipelines_list edge cases.
"""

import json
import pathlib
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest  # noqa: TC001
from metadata.generated.schema.entity.data.pipeline import StatusType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.pipeline.kestra.metadata import KestraSource
from metadata.ingestion.source.pipeline.kestra.models import (
    KestraExecution,
    KestraFlow,
    KestraGraph,
    KestraSearchResult,
)

FIXTURE = pathlib.Path(__file__).resolve().parents[3] / "unit" / "resources" / "datasets" / "kestra_dataset.json"
DATA = json.loads(FIXTURE.read_text())


MOCK_CONFIG = {
    "source": {
        "type": "Kestra",
        "serviceName": "kestra_test",
        "serviceConnection": {
            "config": {
                "type": "Kestra",
                "hostPort": "http://localhost:8080",
                "tenantId": "main",
            }
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "test"},
        }
    },
}


@pytest.fixture
def source() -> KestraSource:
    """Build a KestraSource via .create() with base test_connection patched."""
    config = OpenMetadataWorkflowConfig.model_validate(MOCK_CONFIG)
    with patch("metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"):
        src = KestraSource.create(
            MOCK_CONFIG["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
    src.client = MagicMock()
    src.context = MagicMock()
    src.context.get.return_value = SimpleNamespace(pipeline_service="kestra_test")
    src.metadata = MagicMock()
    src.status = MagicMock()
    return src


def test_yield_pipeline_builds_tasks_from_graph(source):
    flow = KestraFlow.model_validate(DATA["cronFlow"])
    graph = KestraGraph.model_validate(DATA["cronGraph"])
    source.client.get_flow_graph.return_value = graph

    results = list(source.yield_pipeline(flow))

    assert results
    rights = [r.right for r in results if r.right is not None]
    assert rights, "expected at least one CreatePipelineRequest"
    req: CreatePipelineRequest = rights[0]
    task_names = {model_str(t.name) for t in req.tasks}
    assert {"extract", "transform", "load"}.issubset(task_names)
    # Cron schedule preserved
    assert req.scheduleInterval == "0 2 * * *"
    # FQN preserves Kestra namespace so metadata.get_by_name works
    # at lineage emission time
    assert model_str(req.name) == "hackathon.demo.cron_etl"


def test_yield_pipeline_status_emits_successful_runs(source):
    flow = KestraFlow.model_validate(DATA["cronFlow"])
    exec_list = KestraSearchResult.model_validate(DATA["executions"])

    source.client.search_executions.return_value = iter(KestraExecution.model_validate(x) for x in exec_list.results)

    statuses = list(source.yield_pipeline_status(flow))
    rights = [s.right for s in statuses if s.right is not None]
    assert rights
    assert rights[0].pipeline_status.executionStatus == StatusType.Successful
    # 3 task statuses reported (extract, transform, load)
    assert len(rights[0].pipeline_status.taskStatus) == 3


def test_yield_pipeline_lineage_for_flow_trigger(source):
    import uuid

    flow = KestraFlow.model_validate(DATA["downstreamFlow"])

    upstream_pipeline = SimpleNamespace(
        id=uuid.uuid4(),
        fullyQualifiedName=SimpleNamespace(root="kestra_test.hackathon.demo.cron_etl"),
    )
    this_pipeline = SimpleNamespace(
        id=uuid.uuid4(),
        fullyQualifiedName=SimpleNamespace(root="kestra_test.hackathon.demo.downstream_consumer"),
    )
    source.metadata.get_by_name.side_effect = [this_pipeline, upstream_pipeline]

    edges = list(source.yield_pipeline_lineage_details(flow))
    assert any(e.right is not None for e in edges)


def test_yield_pipeline_handles_parallel_flowable(source):
    """Ensure Parallel flowable + its branches all surface as tasks."""
    flow = KestraFlow.model_validate(DATA["parallelFlow"])
    graph = KestraGraph.model_validate(DATA["parallelGraph"])
    source.client.get_flow_graph.return_value = graph

    req = next(r.right for r in source.yield_pipeline(flow) if r.right is not None)
    names = {model_str(t.name) for t in req.tasks}
    # All three task IDs from the YAML are surfaced (fanout, branch_a, branch_b, join)
    # plus possibly a synthetic "root" or container node
    assert {"branch_a", "branch_b", "join"}.issubset(names)


def test_get_pipelines_list_skips_disabled(source):
    enabled = KestraFlow.model_validate({"id": "ok", "namespace": "p", "tasks": [], "disabled": False})
    disabled = KestraFlow.model_validate({"id": "skipme", "namespace": "p", "tasks": [], "disabled": True})
    source.client.search_flows.return_value = iter([enabled, disabled])
    source.source_config = SimpleNamespace(pipelineFilterPattern=None)

    result = list(source.get_pipelines_list())
    assert [f.id for f in result] == ["ok"]
