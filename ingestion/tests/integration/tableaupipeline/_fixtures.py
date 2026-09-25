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

"""Shared test data for Tableau Pipeline integration tests.

Lives in a regular module (not conftest.py) so it can be imported with a
relative import from sibling test files. pytest does not put conftest.py
files on the import path, so importing them as modules fails in CI.
"""

from datetime import datetime, timezone

from metadata.ingestion.source.pipeline.tableaupipeline.models import (
    TableauFlowLineage,
    TableauFlowOutputStep,
    TableauLineageDatabase,
    TableauLineageTable,
    TableauLinkedFlow,
    TableauPipelineDetails,
    TableauPublishedDatasource,
    TableauReferencedQuery,
    TableauRunItem,
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
    id="gql-flow-sales",
    luid="flow-sales",
    name="Sales Prep Flow",
    upstream_tables=[
        TableauLineageTable(
            id="Table-orders",
            luid="orders",
            name="orders",
            full_name="[public].[orders]",
            schema_="public",
            database=TableauLineageDatabase(name="warehouse", connection_type="postgres"),
            # Every custom SQL query on the site that reads `orders`, including
            # ones in unrelated workbooks. A named table must not be expanded
            # through them.
            referenced_by_queries=[
                TableauReferencedQuery(id="q-other", query="SELECT * FROM warehouse.public.payroll JOIN orders ON 1=1")
            ],
        ),
        TableauLineageTable(
            id="Table-customers",
            luid="customers",
            name="customers",
            full_name="[public].[customers]",
            schema_="public",
            database=TableauLineageDatabase(name="warehouse"),
        ),
    ],
    upstream_datasources=[
        TableauPublishedDatasource(id="gql-ds-targets", luid="ds-targets", name="Sales Targets", project_name="Sales"),
    ],
    output_steps=[
        TableauFlowOutputStep(id="Output-clean-sales", name="Clean Sales"),
    ],
    downstream_tables=[
        TableauLineageTable(
            id="Table-sales-clean",
            luid="sales-clean",
            name="sales_clean",
            full_name="[mart].[sales_clean]",
            schema_="mart",
            database=TableauLineageDatabase(name="warehouse", connection_type="postgres"),
        ),
    ],
    downstream_datasources=[
        TableauPublishedDatasource(
            id="gql-ds-sales-published", luid="ds-sales-published", name="Published Sales Datasource"
        ),
    ],
    next_downstream_flows=[
        TableauLinkedFlow(id="gql-flow-marketing", luid="flow-marketing", name="Marketing Prep Flow"),
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
                    query=("SELECT id, revenue FROM warehouse.public.orders WHERE status = 'paid'"),
                )
            ],
        )
    ],
)

EXTRACT_SALES = TableauPipelineDetails(
    id="ds-sales-published",
    name="ds-sales-published",
    display_name="Published Sales Datasource extract refresh",
    description="Refreshes the extract of the published data source **Published Sales Datasource**.",
    pipeline_type=TableauTaskType.EXTRACT_REFRESH,
    project_name="Sales",
    webpage_url="https://tableau.example.com/#/datasources/ds-sales-published",
    owner_id="user-alice",
    target_type="datasource",
)

EXTRACT_EXEC_WORKBOOK = TableauPipelineDetails(
    id="wb-exec",
    name="wb-exec",
    display_name="Exec Dashboard extract refresh",
    description="Refreshes the extract of the workbook **Exec Dashboard**.",
    pipeline_type=TableauTaskType.EXTRACT_REFRESH,
    project_name="Exec",
    webpage_url="https://tableau.example.com/#/workbooks/wb-exec",
    target_type="workbook",
)

EXTRACT_RUNS_BY_TARGET: dict[str, list[TableauRunItem]] = {
    "ds-sales-published": [
        TableauRunItem(
            id="job-2",
            status="Failed",
            started_at=datetime(2025, 4, 22, 7, 0, 0, tzinfo=timezone.utc),
            completed_at=datetime(2025, 4, 22, 7, 0, 42, tzinfo=timezone.utc),
            error="Unable to connect to the server warehouse.example.com",
        ),
        TableauRunItem(
            id="job-1",
            status="Success",
            started_at=datetime(2025, 4, 21, 7, 0, 0, tzinfo=timezone.utc),
            completed_at=datetime(2025, 4, 21, 7, 4, 10, tzinfo=timezone.utc),
        ),
    ],
}

# Metadata API ids of the data sources each extract refresh writes.
EXTRACT_DATASOURCE_IDS: dict[str, list[str]] = {
    "ds-sales-published": ["gql-ds-sales-published"],
    "wb-exec": ["gql-exec-orders", "gql-exec-targets"],
}

FLOW_RUNS_BY_FLOW: dict[str, list[TableauRunItem]] = {
    "flow-sales": [
        TableauRunItem(
            id="run-s1",
            status="Success",
            started_at=datetime(2025, 4, 22, 6, 0, 0, tzinfo=timezone.utc),
            completed_at=datetime(2025, 4, 22, 6, 3, 15, tzinfo=timezone.utc),
        ),
        TableauRunItem(
            id="run-s2",
            status="Failed",
            started_at=datetime(2025, 4, 21, 6, 0, 0, tzinfo=timezone.utc),
            completed_at=datetime(2025, 4, 21, 6, 1, 45, tzinfo=timezone.utc),
        ),
    ],
    "flow-marketing": [],
}

LINEAGE_BY_FLOW: dict[str, TableauFlowLineage | None] = {
    "flow-sales": SALES_LINEAGE,
    "flow-marketing": MARKETING_LINEAGE,
}

USER_EMAIL_BY_ID: dict[str, str | None] = {
    "user-alice": "alice@example.com",
}
