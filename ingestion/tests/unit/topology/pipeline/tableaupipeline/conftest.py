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
Fixtures for the Tableau Pipeline source tests.

Builds a TableaupipelineSource backed by an in-memory fake TableauPipelineClient
returning the same shapes the real TSC-backed client produces, so the source's
topology stages run on production-accurate data. The client itself is tested
against a fake Tableau at the HTTP transport in test_tableaupipeline_client.py,
and the whole workflow against a live server in tests/integration/tableaupipeline.
"""

from collections.abc import Iterable
from unittest.mock import create_autospec, patch

import pytest

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.tableaupipeline.metadata import (
    TableaupipelineSource,
)
from metadata.ingestion.source.pipeline.tableaupipeline.models import (
    TableauFlowLineage,
    TableauPipelineDetails,
    TableauRunItem,
)

from ._fixtures import (  # noqa: TID252
    EXTRACT_DATASOURCE_IDS,
    EXTRACT_EXEC_WORKBOOK,
    EXTRACT_RUNS_BY_TARGET,
    EXTRACT_SALES,
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
        self.lineage_requests: list[str] = []

    extract_refresh_listing_complete = True

    def get_pipelines(self, keep=lambda _: True) -> Iterable[TableauPipelineDetails]:
        yield FLOW_SALES
        yield FLOW_MARKETING
        yield EXTRACT_SALES
        yield EXTRACT_EXEC_WORKBOOK

    def get_extract_refresh_runs(self, target_id: str) -> list[TableauRunItem]:
        return EXTRACT_RUNS_BY_TARGET.get(target_id, [])

    def get_extract_datasource_ids(self, target_type: str, target_luid: str) -> list[str]:
        return EXTRACT_DATASOURCE_IDS.get(target_luid, [])

    def get_flow_runs(self, flow_id: str) -> list[TableauRunItem]:
        return FLOW_RUNS_BY_FLOW.get(flow_id, [])

    def get_flow_lineage(self, flow_id: str) -> TableauFlowLineage | None:
        self.lineage_requests.append(flow_id)
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
        source.metadata = create_autospec(OpenMetadata, instance=True)
        yield source, fake_client
