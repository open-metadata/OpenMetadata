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
Tableau Pipeline ingestion end to end: the metadata workflow runs the connector
against a fake Tableau site and writes to a live OpenMetadata server, and every
assertion reads back what the server stored.

Requires an OpenMetadata server at http://localhost:8585.
"""

from datetime import datetime, timezone

import pytest

from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.workflow.metadata import MetadataWorkflow

from .conftest import PIPELINE_SERVICE  # noqa: TID252

FAR_FUTURE_MS = int(datetime(2100, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)


def _pipeline(metadata, name: str, fields: list[str] | None = None) -> Pipeline:
    pipeline = metadata.get_by_name(entity=Pipeline, fqn=f"{PIPELINE_SERVICE}.{name}", fields=fields or [])
    assert pipeline is not None, f"{name} was not ingested"
    return pipeline


def _statuses(metadata, name: str) -> list:
    return metadata.list_pipeline_statuses(f"{PIPELINE_SERVICE}.{name}", start_ts=0, end_ts=FAR_FUTURE_MS)


def _ms(timestamp: str) -> int:
    return int(datetime.fromisoformat(timestamp).timestamp() * 1000)


@pytest.mark.usefixtures("ingested")
class TestTableauPipelineWorkflow:
    def test_flows_and_extract_refreshes_become_pipelines(self, metadata):
        sales = _pipeline(metadata, "flow-sales", fields=["tasks", "owners", "tags"])
        extract = _pipeline(metadata, "ds-sales", fields=["tasks"])

        assert sales.displayName == "Sales"
        assert [task.taskType for task in sales.tasks] == ["FlowInput", "FlowProcessing", "FlowOutputStep"]
        assert [owner.name for owner in sales.owners.root] == ["admin"]
        assert [tag.tagFQN.root for tag in sales.tags] == ["TableauTags.finance"]
        assert extract.displayName == "Sales Extract extract refresh"
        assert [(task.name, task.taskType) for task in extract.tasks] == [("ds-sales", "ExtractRefresh")]
        assert _pipeline(metadata, "flow-ops").displayName == "Ops"

    def test_flow_runs_are_stored_with_their_failure_reason(self, metadata):
        statuses = sorted(_statuses(metadata, "flow-sales"), key=lambda status: status.timestamp.root)

        assert [(s.executionId, s.executionStatus.value) for s in statuses] == [
            ("run-1", "Successful"),
            ("run-2", "Failed"),
        ]
        failed = statuses[1]
        assert failed.timestamp.root == _ms("2026-09-02T06:00:00+00:00")
        assert failed.endTime.root == _ms("2026-09-02T06:01:30+00:00")
        assert failed.error.errorMessage == "Output step Clean sales failed: table is locked"
        assert {task.name for task in failed.taskStatus} == {"input_t-orders", "flow-sales", "output_out-clean"}

    def test_extract_refresh_jobs_are_stored_as_status(self, metadata):
        statuses = sorted(_statuses(metadata, "ds-sales"), key=lambda status: status.timestamp.root)

        assert [(s.executionId, s.executionStatus.value) for s in statuses] == [
            ("job-1", "Successful"),
            ("job-2", "Failed"),
        ]
        assert statuses[1].error.errorMessage == "Unable to connect to the server warehouse.example.com"

    def test_flow_lineage_links_tables_through_the_flow(self, metadata, warehouse_tables):
        sales = _pipeline(metadata, "flow-sales")
        orders, sales_clean = warehouse_tables["orders"], warehouse_tables["sales_clean"]

        assert metadata.get_lineage_edge(orders.id.root, sales.id.root) is not None
        assert metadata.get_lineage_edge(sales.id.root, sales_clean.id.root) is not None

    def test_a_flow_listed_before_its_consumer_is_linked_to_it(self, metadata):
        """`Ops` does not exist yet when `Sales` is processed; the post-process
        draws the edge once every flow is in."""
        sales, ops = _pipeline(metadata, "flow-sales"), _pipeline(metadata, "flow-ops")

        assert metadata.get_lineage_edge(sales.id.root, ops.id.root) is not None

    def test_a_second_run_does_not_duplicate_status(self, metadata, run_workflow, workflow_config):
        run_workflow(MetadataWorkflow, workflow_config)

        assert len(_statuses(metadata, "flow-sales")) == 2
        assert len(_statuses(metadata, "ds-sales")) == 2
