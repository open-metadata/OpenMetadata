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
"""

from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.pipeline.tableaupipeline.metadata import (
    TableaupipelineSource,
)
from metadata.ingestion.source.pipeline.tableaupipeline.models import (
    TableauDownstreamDatasource,
    TableauDownstreamFlow,
    TableauFlowLineage,
    TableauFlowOutputField,
    TableauFlowOutputStep,
    TableauFlowRunItem,
    TableauFlowUpstreamColumn,
    TableauLineageColumn,
    TableauLineageDatabase,
    TableauLineageTable,
    TableauPipelineDetails,
    TableauReferencedQuery,
    TableauTaskType,
)

WORKFLOW_CONFIG = {
    "source": {
        "type": "tableaupipeline",
        "serviceName": "tableau_prep_integration",
        "serviceConnection": {
            "config": {
                "type": "TableauPipeline",
                "hostPort": "https://tableau.example.com",
                "authType": {
                    "personalAccessTokenName": "integration-pat",
                    "personalAccessTokenSecret": "integration-secret",
                },
            }
        },
        "sourceConfig": {
            "config": {
                "pipelineFilterPattern": {},
                "includeTags": True,
                "lineageInformation": {
                    "dbServiceNames": ["warehouse"],
                },
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE"
                "2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXB"
                "iEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fN"
                "r3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3u"
                "d-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

FLOW_SALES = TableauPipelineDetails(
    id="flow-sales",
    name="flow-sales",
    display_name="Sales Prep Flow",
    description="Cleans raw sales into the sales mart",
    pipeline_type=TableauTaskType.FLOW_RUN,
    project_name="Sales",
    webpage_url="https://tableau.example.com/#/flows/flow-sales",
    owner_id="user-alice",
    tags=["daily", "sales"],
)

FLOW_MARKETING = TableauPipelineDetails(
    id="flow-marketing",
    name="flow-marketing",
    display_name="Marketing Prep Flow",
    description=None,
    pipeline_type=TableauTaskType.FLOW_RUN,
    project_name="Marketing",
    webpage_url=None,
    owner_id=None,
    tags=[],
)

SALES_LINEAGE = TableauFlowLineage(
    id="flow-sales",
    luid="flow-sales",
    name="Sales Prep Flow",
    upstream_tables=[
        TableauLineageTable(
            id="Table-orders",
            luid="orders",
            name="orders",
            full_name="warehouse.public.orders",
            schema_="public",
            columns=[
                TableauLineageColumn(id="order_id", name="order_id"),
                TableauLineageColumn(id="customer_id", name="customer_id"),
            ],
            database=TableauLineageDatabase(name="warehouse", connection_type="postgres"),
        ),
        TableauLineageTable(
            id="Table-customers",
            luid="customers",
            name="customers",
            full_name="warehouse.public.customers",
            schema_="public",
            database=TableauLineageDatabase(name="warehouse"),
        ),
    ],
    output_steps=[
        TableauFlowOutputStep(id="Output-clean-sales", name="Clean Sales"),
    ],
    output_fields=[
        TableauFlowOutputField(
            id="of-clean-order",
            name="clean_order_id",
            upstream_columns=[
                TableauFlowUpstreamColumn(
                    id="order_id",
                    name="order_id",
                    table=TableauLineageTable(id="Table-orders", name="orders"),
                )
            ],
        ),
    ],
    downstream_flows=[
        TableauDownstreamFlow(luid="flow-marketing", name="Marketing Prep Flow"),
    ],
    downstream_datasources=[
        TableauDownstreamDatasource(
            luid="ds-sales-published", name="Published Sales Datasource"
        ),
    ],
)

MARKETING_LINEAGE = TableauFlowLineage(
    id="flow-marketing",
    luid="flow-marketing",
    name="Marketing Prep Flow",
    upstream_tables=[
        TableauLineageTable(
            id="Table-sales-custom-sql",
            name="",
            referenced_by_queries=[
                TableauReferencedQuery(
                    id="q-1",
                    query=(
                        "SELECT id, revenue FROM warehouse.public.orders "
                        "WHERE status = 'paid'"
                    ),
                )
            ],
        )
    ],
)

FLOW_RUNS_BY_FLOW: Dict[str, List[TableauFlowRunItem]] = {
    "flow-sales": [
        TableauFlowRunItem(
            id="run-s1",
            flow_id="flow-sales",
            status="Success",
            started_at=datetime(2025, 4, 22, 6, 0, 0, tzinfo=timezone.utc),
            completed_at=datetime(2025, 4, 22, 6, 3, 15, tzinfo=timezone.utc),
        ),
        TableauFlowRunItem(
            id="run-s2",
            flow_id="flow-sales",
            status="Failed",
            started_at=datetime(2025, 4, 21, 6, 0, 0, tzinfo=timezone.utc),
            completed_at=datetime(2025, 4, 21, 6, 1, 45, tzinfo=timezone.utc),
        ),
    ],
    "flow-marketing": [],
}

LINEAGE_BY_FLOW: Dict[str, Optional[TableauFlowLineage]] = {
    "flow-sales": SALES_LINEAGE,
    "flow-marketing": MARKETING_LINEAGE,
}

USER_EMAIL_BY_ID: Dict[str, Optional[str]] = {
    "user-alice": "alice@example.com",
}


class FakeTableauPipelineClient:
    """Fake client exposing the exact surface TableaupipelineSource calls."""

    def __init__(self):
        self.sign_out_called = False
        self.cleanup_called = False

    def get_pipelines(self) -> Iterable[TableauPipelineDetails]:
        yield FLOW_SALES
        yield FLOW_MARKETING

    def get_flow_runs(self, flow_id: str) -> List[TableauFlowRunItem]:
        return FLOW_RUNS_BY_FLOW.get(flow_id, [])

    def get_flow_lineage(self, flow_id: str) -> Optional[TableauFlowLineage]:
        return LINEAGE_BY_FLOW.get(flow_id)

    def get_user_email(self, user_id: str) -> Optional[str]:
        return USER_EMAIL_BY_ID.get(user_id)

    def sign_out(self) -> None:
        self.sign_out_called = True
        self.cleanup_called = True


@pytest.fixture
def tableau_source():
    fake_client = FakeTableauPipelineClient()
    with patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection",
        return_value=False,
    ), patch(
        "metadata.ingestion.source.pipeline.tableaupipeline.connection.get_connection",
        return_value=fake_client,
    ):
        workflow_cfg = OpenMetadataWorkflowConfig.model_validate(WORKFLOW_CONFIG)
        source = TableaupipelineSource.create(
            WORKFLOW_CONFIG["source"],
            workflow_cfg.workflowConfig.openMetadataServerConfig,
        )
        source.context.get().__dict__["pipeline_service"] = "tableau_prep_integration"
        source.metadata = MagicMock()
        yield source, fake_client
