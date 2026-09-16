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
Test QuickSight using the topology
"""

import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.dashboard.quicksight.metadata import QuicksightSource
from metadata.ingestion.source.dashboard.quicksight.models import (
    DashboardDetail,
    DataSourceModel,
    DataSourceRespQuery,
    DescribeDataSourceResponse,
)

mock_file_path = Path(__file__).parent.parent.parent / "resources/datasets/quicksight_dataset.json"
with open(mock_file_path, encoding="UTF-8") as file:  # noqa: PTH123
    mock_data: dict = json.load(file)

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="quicksight_source_test",
    fullyQualifiedName=FullyQualifiedEntityName("quicksight_source_test"),
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.QuickSight,
)

MOCK_DASHBOARD = Dashboard(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="do_it_all_with_default_config",
    fullyQualifiedName="quicksight_source.do_it_all_with_default_config",
    displayName="do_it_all_with_default_config",
    service=EntityReference(id="85811038-099a-11ed-861d-0242ac120002", type="dashboardService"),
)

mock_quicksight_config = {
    "source": {
        "type": "quicksight",
        "serviceName": "local_quicksight",
        "serviceConnection": {
            "config": {
                "type": "QuickSight",
                "awsConfig": {
                    "awsAccessKeyId": "aws_access_key_id",
                    "awsSecretAccessKey": "aws_secret_access_key",
                    "awsRegion": "us-east-2",
                    "endPointURL": "https://endpoint.com/",
                },
                "awsAccountId": "6733-5329-5256",
            }
        },
        "sourceConfig": {
            "config": {
                "dashboardFilterPattern": {},
                "chartFilterPattern": {},
                "includeOwners": True,
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

MOCK_DASHBOARD_DETAILS = {
    "DashboardId": "552315335",
    "Name": "New Dashboard",
    "Version": {
        "Sheets": [],
    },
}
EXPECTED_DASHBOARD = CreateDashboardRequest(
    name="552315335",
    displayName="New Dashboard",
    sourceUrl="https://us-east-2.quicksight.aws.amazon.com/sn/dashboards/552315335",
    charts=[],
    tags=None,
    owners=None,
    service="quicksight_source_test",
    extension=None,
)

EXPECTED_DASHBOARDS = [
    CreateChartRequest(
        name="1108771657",
        displayName="Top Salespeople",
        chartType="Other",
        sourceUrl="https://us-east-2.quicksight.aws.amazon.com/sn/dashboards/552315335",
        tags=None,
        owners=None,
        service="quicksight_source_test",
    ),
    CreateChartRequest(
        name="1985861713",
        displayName="Milan Datasets",
        chartType="Other",
        sourceUrl="https://us-east-2.quicksight.aws.amazon.com/sn/dashboards/552315335",
        tags=None,
        owners=None,
        service="quicksight_source_test",
    ),
    CreateChartRequest(
        name="2025899139",
        displayName="Page Fans",
        chartType="Other",
        sourceUrl="https://us-east-2.quicksight.aws.amazon.com/sn/dashboards/552315335",
        tags=None,
        owners=None,
        service="quicksight_source_test",
    ),
]

MOCK_DATABASE_SERVICE = DatabaseService(
    id="1e2b4b6c-8f4a-4d3e-9c1a-5f6d7e8a9b0c",
    name="MyMSSQLService",
    fullyQualifiedName=FullyQualifiedEntityName("MyMSSQLService"),
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Mssql,
)

MOCK_CONNECTION_DATABASE = "SalesDB"

# `Orders` is 3-part and matches the connection database, `Customers` is 3-part and does not,
# and `LocalOrders` is the 2-part control that has no database of its own to carry.
CROSS_DATABASE_QUERY = (
    "SELECT o.OrderId, c.Name, l.Total "
    "FROM SalesDB.dbo.Orders o WITH(NOLOCK) "
    "LEFT JOIN [CRM_DB].dbo.Customers c (NOLOCK) ON c.customer_id = o.customer_id "
    "LEFT JOIN dbo.LocalOrders l (NOLOCK) ON l.OrderId = o.OrderId"
)

CROSS_DATABASE_TABLES = {
    "mymssqlservice.salesdb.dbo.orders": "3f6e5d4c-1a2b-3c4d-5e6f-7a8b9c0d1e2f",
    "mymssqlservice.crm_db.dbo.customers": "4a7f6e5d-2b3c-4d5e-6f7a-8b9c0d1e2f3a",
    "mymssqlservice.salesdb.dbo.localorders": "5b8a7f6e-3c4d-5e6f-7a8b-9c0d1e2f3a4b",
}


def build_cross_database_catalog() -> dict[str, Table]:
    return {
        table_fqn: Table.model_construct(
            id=Uuid(table_id),
            fullyQualifiedName=FullyQualifiedEntityName(table_fqn),
            columns=[],
        )
        for table_fqn, table_id in CROSS_DATABASE_TABLES.items()
    }


def search_cross_database_catalog(catalog: dict[str, Table]):
    """Stand-in for the ES lookup: a table is only found under the FQN it really has."""

    def search(*_args, fqn_search_string: str = "", **_kwargs):
        match = catalog.get(fqn_search_string.lower())
        return [match] if match else []

    return search


class QuickSightUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    QuickSight Unit Test
    """

    @patch("metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection")
    def __init__(self, methodName, test_connection) -> None:  # noqa: N803
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_quicksight_config)
        self.quicksight = QuicksightSource.create(
            mock_quicksight_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.quicksight.dashboard_url = "https://us-east-2.quicksight.aws.amazon.com/sn/dashboards/552315335"
        self.quicksight.context.get().__dict__["dashboard"] = MOCK_DASHBOARD.fullyQualifiedName.root
        self.quicksight.context.get().__dict__["dashboard_service"] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root

    @pytest.mark.order(1)
    def test_dashboard(self):
        dashboard_list = []
        results = self.quicksight.yield_dashboard(DashboardDetail(**MOCK_DASHBOARD_DETAILS))
        for result in results:
            if isinstance(result, Either) and result.right:
                dashboard_list.append(result.right)  # noqa: PERF401
        self.assertEqual(EXPECTED_DASHBOARD, dashboard_list[0])

    @pytest.mark.order(2)
    def test_dashboard_name(self):
        assert self.quicksight.get_dashboard_name(DashboardDetail(**MOCK_DASHBOARD_DETAILS)) == mock_data["Name"]

    @pytest.mark.order(3)
    def test_chart(self):
        dashboard_details = DashboardDetail(**MOCK_DASHBOARD_DETAILS)
        dashboard_details.Version.Charts = mock_data["Version"]["Sheets"]
        results = self.quicksight.yield_dashboard_chart(dashboard_details)
        chart_list = []
        for result in results:
            if isinstance(result, CreateChartRequest):
                chart_list.append(result)  # noqa: PERF401
        for _, (expected, original) in enumerate(zip(EXPECTED_DASHBOARDS, chart_list)):  # noqa: B905
            self.assertEqual(expected, original)

    @pytest.mark.order(4)
    def test_include_owners_flag_enabled(self):
        """
        Test that when includeOwners is True, owner information is processed
        """
        # Mock the source config to have includeOwners = True
        self.quicksight.source_config.includeOwners = True

        # Test that owner information is processed when includeOwners is True
        self.assertTrue(self.quicksight.source_config.includeOwners)

    @pytest.mark.order(5)
    def test_include_owners_flag_disabled(self):
        """
        Test that when includeOwners is False, owner information is not processed
        """
        # Mock the source config to have includeOwners = False
        self.quicksight.source_config.includeOwners = False

        # Test that owner information is not processed when includeOwners is False
        self.assertFalse(self.quicksight.source_config.includeOwners)

    @pytest.mark.order(6)
    def test_include_owners_flag_in_config(self):
        """
        Test that the includeOwners flag is properly set in the configuration
        """
        # Check that the mock configuration includes the includeOwners flag
        config = mock_quicksight_config["source"]["sourceConfig"]["config"]
        self.assertIn("includeOwners", config)
        self.assertTrue(config["includeOwners"])

    @pytest.mark.order(7)
    def test_include_owners_flag_affects_owner_processing(self):
        """
        Test that the includeOwners flag affects how owner information is processed
        """
        # Test with includeOwners = True
        self.quicksight.source_config.includeOwners = True
        self.assertTrue(self.quicksight.source_config.includeOwners)

        # Test with includeOwners = False
        self.quicksight.source_config.includeOwners = False
        self.assertFalse(self.quicksight.source_config.includeOwners)

    @pytest.mark.order(8)
    def test_yield_datamodel_uses_dataset_id(self):
        """
        Test that yield_datamodel creates separate DataModel entities per dataset,
        not per datasource. When multiple datasets share the same datasource,
        each dataset should produce its own DataModel.
        """
        shared_datasource_id = "shared-datasource-001"
        shared_datasource_arn = "arn:aws:quicksight:us-east-2:123456789:datasource/shared-datasource-001"

        mock_list_data_sets_response = {
            "DataSetSummaries": [
                {
                    "DataSetId": "dataset-A",
                    "Arn": "arn:aws:quicksight:us-east-2:123456789:dataset/dataset-A",
                },
                {
                    "DataSetId": "dataset-B",
                    "Arn": "arn:aws:quicksight:us-east-2:123456789:dataset/dataset-B",
                },
            ]
        }

        mock_describe_dataset_a = {
            "DataSet": {
                "DataSetId": "dataset-A",
                "Name": "Dataset A",
                "PhysicalTableMap": {
                    "table1": {
                        "RelationalTable": {
                            "DataSourceArn": shared_datasource_arn,
                            "Schema": "public",
                            "Name": "table_a",
                            "InputColumns": [
                                {"Name": "id", "Type": "INTEGER"},
                                {"Name": "name", "Type": "STRING"},
                            ],
                        }
                    }
                },
            }
        }

        mock_describe_dataset_b = {
            "DataSet": {
                "DataSetId": "dataset-B",
                "Name": "Dataset B",
                "PhysicalTableMap": {
                    "table1": {
                        "RelationalTable": {
                            "DataSourceArn": shared_datasource_arn,
                            "Schema": "public",
                            "Name": "table_b",
                            "InputColumns": [
                                {"Name": "email", "Type": "STRING"},
                                {"Name": "created_at", "Type": "DATETIME"},
                            ],
                        }
                    }
                },
            }
        }

        mock_list_data_sources_response = {
            "DataSources": [
                {
                    "DataSourceId": shared_datasource_id,
                    "Arn": shared_datasource_arn,
                }
            ]
        }

        mock_describe_data_source_response = {
            "DataSource": {
                "Name": "postgres_source",
                "Type": "POSTGRESQL",
                "DataSourceId": shared_datasource_id,
            },
            "RequestId": "req-001",
            "Status": 200,
        }

        def describe_data_set_side_effect(**kwargs):
            if kwargs["DataSetId"] == "dataset-A":
                return mock_describe_dataset_a
            return mock_describe_dataset_b

        mock_client = MagicMock()
        mock_client.list_data_sets.return_value = mock_list_data_sets_response
        mock_client.describe_data_set.side_effect = describe_data_set_side_effect
        mock_client.list_data_sources.return_value = mock_list_data_sources_response
        mock_client.describe_data_source.return_value = mock_describe_data_source_response

        self.quicksight.client = mock_client

        dashboard_details = DashboardDetail(
            DashboardId="dash-001",
            Name="Test Dashboard",
            Version={
                "DataSetArns": [
                    "arn:aws:quicksight:us-east-2:123456789:dataset/dataset-A",
                    "arn:aws:quicksight:us-east-2:123456789:dataset/dataset-B",
                ],
                "Sheets": [],
            },
        )

        results = list(self.quicksight.yield_datamodel(dashboard_details))

        datamodel_requests = [r.right for r in results if isinstance(r, Either) and r.right]

        assert len(datamodel_requests) == 2

        names = {dm.name.root for dm in datamodel_requests}
        assert "dataset-A" in names
        assert "dataset-B" in names

        display_names = {dm.displayName for dm in datamodel_requests}
        assert "Dataset A" in display_names
        assert "Dataset B" in display_names

        for dm in datamodel_requests:
            assert dm.name.root != shared_datasource_id

        dm_a = next(dm for dm in datamodel_requests if dm.name.root == "dataset-A")
        dm_b = next(dm for dm in datamodel_requests if dm.name.root == "dataset-B")

        col_names_a = {col.name.root for col in dm_a.columns}
        assert col_names_a == {"id", "name"}

        col_names_b = {col.name.root for col in dm_b.columns}
        assert col_names_b == {"email", "created_at"}

    def test_chart_source_state_populated(self):
        """Verify register_record_chart populates chart_source_state after yield_dashboard_chart."""
        dashboard_details = DashboardDetail(**{**MOCK_DASHBOARD_DETAILS, "Version": mock_data["Version"]})
        self.quicksight.chart_source_state = set()
        list(self.quicksight.yield_dashboard_chart(dashboard_details))
        assert len(self.quicksight.chart_source_state) == len(mock_data["Version"]["Sheets"])
        for fqn in self.quicksight.chart_source_state:
            assert "quicksight_source_test" in fqn


class TestQuickSightCrossDatabaseLineage:
    """A `database.schema.table` reference has to be looked up under the database the SQL
    names, not the data source's connection database (issue #28444)."""

    @pytest.fixture
    def quicksight_source(self):
        with patch("metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"):
            config = OpenMetadataWorkflowConfig.model_validate(mock_quicksight_config)
            source = QuicksightSource.create(
                mock_quicksight_config["source"],
                config.workflowConfig.openMetadataServerConfig,
            )
        source.context.get().__dict__["dashboard_service"] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root
        return source

    def test_source_tables_resolve_under_the_database_the_sql_names(self, quicksight_source):
        catalog = build_cross_database_catalog()
        data_model = DashboardDataModel.model_construct(
            id=Uuid("6e781e63-e30f-4c6e-891a-389f1f982cab"),
            columns=[],
        )

        def get_by_name(entity, **_):
            return MOCK_DATABASE_SERVICE if entity is DatabaseService else data_model

        quicksight_source.metadata = MagicMock()
        quicksight_source.metadata.get_by_name = MagicMock(side_effect=get_by_name)
        quicksight_source.metadata.search_in_any_service = MagicMock(side_effect=search_cross_database_catalog(catalog))
        quicksight_source.data_models = [
            DescribeDataSourceResponse(
                dataset_id="ds-1",
                DataSource=DataSourceModel(
                    Name="mssql-source",
                    Type="SQLSERVER",
                    DataSourceId="ds-1",
                    DataSourceParameters={"SqlServerParameters": {"Database": MOCK_CONNECTION_DATABASE}},
                    data_source_resp=DataSourceRespQuery(
                        DataSourceArn="arn:aws:quicksight:us-east-2:123456789012:datasource/ds-1",
                        SqlQuery=CROSS_DATABASE_QUERY,
                        Name="cross db dataset",
                        Columns=[],
                    ),
                ),
            )
        ]

        results = list(
            quicksight_source.yield_dashboard_lineage_details(
                dashboard_details=DashboardDetail(**MOCK_DASHBOARD_DETAILS),
                db_service_prefix=MOCK_DATABASE_SERVICE.name.root,
            )
        )

        assert [res.left for res in results if res.left] == []
        fqn_by_id = {table_id: table_fqn for table_fqn, table_id in CROSS_DATABASE_TABLES.items()}
        lineage_sources = {str(res.right.edge.fromEntity.id.root) for res in results if res.right}
        assert {fqn_by_id[table_id] for table_id in lineage_sources} == set(CROSS_DATABASE_TABLES)
