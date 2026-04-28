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
Tableau Pipeline integration test fixtures.

Builds a full TableaupipelineSource backed by an in-memory fake TableauPipelineClient.
The fake client returns the same shapes that the real TSC-backed client produces
— TableauFlowItem / TableauFlowRunItem / TableauFlowLineage — so the source
sees production-accurate data without any Tableau Server, HTTP mock, or TSC import.

Test data lives in `_fixtures.py` (a regular module) so test files can import
it directly. pytest does not put `conftest.py` on the import path, so test files
cannot import constants from conftest in CI even though it works locally.
"""

from collections.abc import Iterable
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.pipeline.tableaupipeline.metadata import (
    TableaupipelineSource,
)
from metadata.ingestion.source.pipeline.tableaupipeline.models import (
    TableauFlowLineage,
    TableauFlowRunItem,
    TableauPipelineDetails,
)

from ._fixtures import (  # noqa: TID252
    FLOW_MARKETING,
    FLOW_RUNS_BY_FLOW,
    FLOW_SALES,
    LINEAGE_BY_FLOW,
    USER_EMAIL_BY_ID,
    WORKFLOW_CONFIG,
)


class FakeTableauPipelineClient:
    """Fake client exposing the exact surface TableaupipelineSource calls."""

    def __init__(self):
        self.sign_out_called = False
        self.cleanup_called = False

    def get_pipelines(self) -> Iterable[TableauPipelineDetails]:
        yield FLOW_SALES
        yield FLOW_MARKETING

    def get_flow_runs(self, flow_id: str) -> list[TableauFlowRunItem]:
        return FLOW_RUNS_BY_FLOW.get(flow_id, [])

    def get_flow_lineage(self, flow_id: str) -> TableauFlowLineage | None:
        return LINEAGE_BY_FLOW.get(flow_id)

    def get_user_email(self, user_id: str) -> str | None:
        return USER_EMAIL_BY_ID.get(user_id)

    def sign_out(self) -> None:
        self.sign_out_called = True
        self.cleanup_called = True


@pytest.fixture
def tableau_source():
    fake_client = FakeTableauPipelineClient()
    with (
        patch(
            "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection",
            return_value=False,
        ),
        patch(
            "metadata.ingestion.source.pipeline.tableaupipeline.connection.get_connection",
            return_value=fake_client,
        ),
    ):
        workflow_cfg = OpenMetadataWorkflowConfig.model_validate(WORKFLOW_CONFIG)
        source = TableaupipelineSource.create(
            WORKFLOW_CONFIG["source"],
            workflow_cfg.workflowConfig.openMetadataServerConfig,
        )
        source.context.get().__dict__["pipeline_service"] = "tableau_prep_integration"
        source.metadata = MagicMock()
        yield source, fake_client
