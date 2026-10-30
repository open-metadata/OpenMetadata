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
"""
BigQuery Value.NativeQuery sources -> the upstream tables PowerBI data model lineage is built from.
"""

import uuid
from unittest.mock import patch

import pytest

from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel, DataModelType
from metadata.generated.schema.metadataIngestion.workflow import OpenMetadataWorkflowConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.powerbi.metadata import PowerbiSource
from metadata.ingestion.source.dashboard.powerbi.models import PowerBiTable

CONFIG = {
    "source": {
        "type": "powerbi",
        "serviceName": "powerbi_bigquery_native_query_test",
        "serviceConnection": {
            "config": {
                "type": "PowerBI",
                "clientId": "client_id",
                "clientSecret": "secret",
                "tenantId": "tenant_id",
            }
        },
        "sourceConfig": {"config": {"type": "DashboardMetadata"}},
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

DATA_MODEL = DashboardDataModel(
    name="sales_model",
    id=uuid.uuid4(),
    columns=[],
    dataModelType=DataModelType.PowerBIDataModel.value,
)

ORDERS = [{"database": "sales-prod", "schema": "sales", "table": "orders"}]


@pytest.fixture
def source() -> PowerbiSource:
    with (
        patch("metadata.ingestion.source.dashboard.dashboard_service.create_connection") as create_connection,
        patch(
            "metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"
        ) as test_connection,
    ):
        create_connection.return_value.client = False
        test_connection.return_value = False
        workflow_config = OpenMetadataWorkflowConfig.model_validate(CONFIG)
        return PowerbiSource.create(
            CONFIG["source"], OpenMetadata(workflow_config.workflowConfig.openMetadataServerConfig)
        )


def native_query_table(sql: str, before_source: str = "") -> PowerBiTable:
    """A table sourced from a BigQuery native query, as the Power BI API returns it. `sql` is M-escaped;
    `before_source` is M text placed ahead of the Source step."""
    expression = (
        "let\n"
        f"{before_source}"
        '    Source = Value.NativeQuery(GoogleBigQuery.Database([BillingProject="sales-prod"])'
        '{[Name="sales-prod"]}[Data], '
        f'"{sql}", null, [EnableFolding=true])\n'
        "in\n"
        "    Source"
    )
    return PowerBiTable.model_validate({"name": "Orders", "source": [{"expression": expression}]})


# Each marker sits before FROM on the same line, so a query cut at the marker has no table left for
# the SqlParse fallback to recover.
@pytest.mark.parametrize(
    "sql",
    [
        pytest.param(
            "select ifnull(region, '--') as region, sum(amount) as amount from `sales.orders` group by 1",
            id="sql-line-comment-marker",
        ),
        pytest.param(
            "select id, concat('https://shop.example.com/p/', sku) as url from `sales.orders`",
            id="m-line-comment-marker",
        ),
        pytest.param(
            "select id, 'exports/*.csv' as file_glob from `sales.orders` /* nightly */",
            id="m-block-comment-marker",
        ),
    ],
)
def test_comment_markers_inside_a_string_literal_keep_the_lineage(source, sql):
    assert source._parse_table_info_from_source_exp(native_query_table(sql), DATA_MODEL) == ORDERS


def test_bigquery_hash_comment_ends_at_its_line(source):
    sql = "select id, amount#(lf)# refunds are excluded upstream#(lf)from `sales.orders`"

    assert source._parse_table_info_from_source_exp(native_query_table(sql), DATA_MODEL) == ORDERS


def test_block_commented_source_step_is_ignored(source):
    replaced_step = (
        "    /*\n"
        '    Source = Value.NativeQuery(GoogleBigQuery.Database([BillingProject="sales-prod"])'
        '{[Name="sales-prod"]}[Data], "select * from `sales.orders_v1`", null, [EnableFolding=true]),\n'
        "    */\n"
    )
    table = native_query_table("select id, amount from `sales.orders`", before_source=replaced_step)

    assert source._parse_table_info_from_source_exp(table, DATA_MODEL) == ORDERS
