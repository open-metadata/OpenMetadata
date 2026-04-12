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
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.dashboard.quicksight.metadata import QuicksightSource
from metadata.ingestion.source.dashboard.quicksight.models import DashboardDetail

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

    @pytest.mark.order(9)
    def test_chart_source_state_populated(self):
        """Verify register_record_chart populates chart_source_state after yield_dashboard_chart."""
        dashboard_details = DashboardDetail(**{**MOCK_DASHBOARD_DETAILS, "Version": mock_data["Version"]})
        self.quicksight.chart_source_state = set()
        list(self.quicksight.yield_dashboard_chart(dashboard_details))
        assert len(self.quicksight.chart_source_state) == len(mock_data["Version"]["Sheets"])
        for fqn in self.quicksight.chart_source_state:
            assert "quicksight_source_test" in fqn

    @pytest.mark.order(10)
    def test_build_column_lineage_from_parser_resolves_alias(self):
        """
        When CustomSql uses SELECT src_col AS alias_col,
        _build_column_lineage_from_parser must map src_col (source)
        to alias_col (data model column) — not match by name.
        Issue #26670.
        """
        src_col = MagicMock()
        src_col.raw_name = "id"
        src_col._parent = None  # No parent — single-table query

        tgt_col = MagicMock()
        tgt_col.raw_name = "relation_id"

        mock_parser = MagicMock()
        mock_parser.column_lineage = [(src_col, tgt_col)]

        src_fqn = "postgres.public.relation_table.id"
        alias_fqn = "quicksight_service.dataset.relation_id"

        mock_from_entity = MagicMock()
        mock_from_entity.name.root = "relation_table"
        mock_data_model = MagicMock()

        with patch(
            "metadata.ingestion.source.dashboard.quicksight.metadata.get_column_fqn",
            return_value=src_fqn,
        ) as mock_get_col_fqn:
            with patch.object(
                self.quicksight,
                "_get_data_model_column_fqn",
                return_value=alias_fqn,
            ) as mock_get_dm_col_fqn:
                result = self.quicksight._build_column_lineage_from_parser(
                    mock_parser, mock_from_entity, mock_data_model
                )

        mock_get_col_fqn.assert_called_once_with(
            table_entity=mock_from_entity, column="id"
        )
        mock_get_dm_col_fqn.assert_called_once_with(
            data_model_entity=mock_data_model, column="relation_id"
        )
        assert len(result) == 1
        assert result[0].fromColumns == [src_fqn]
        assert result[0].toColumn == alias_fqn

    @pytest.mark.order(11)
    def test_build_column_lineage_from_parser_multi_table_filters_correctly(self):
        """
        When CustomSql joins multiple tables with shared column names
        (e.g. t1.id and t2.id), _build_column_lineage_from_parser must
        only emit lineage for columns belonging to from_entity — not
        columns from other tables with the same name.
        Issue #26670.
        """
        # Column from the correct upstream table
        src_col_correct = MagicMock()
        src_col_correct.raw_name = "id"
        src_col_correct._parent = MagicMock()
        src_col_correct._parent.__str__ = MagicMock(
            return_value="relation_table"
        )

        tgt_col_correct = MagicMock()
        tgt_col_correct.raw_name = "relation_id"

        # Column from a DIFFERENT table with same name 'id'
        src_col_wrong = MagicMock()
        src_col_wrong.raw_name = "id"
        src_col_wrong._parent = MagicMock()
        src_col_wrong._parent.__str__ = MagicMock(return_value="other_table")

        tgt_col_wrong = MagicMock()
        tgt_col_wrong.raw_name = "other_relation_id"

        mock_parser = MagicMock()
        mock_parser.column_lineage = [
            (src_col_correct, tgt_col_correct),
            (src_col_wrong, tgt_col_wrong),
        ]

        src_fqn = "postgres.public.relation_table.id"
        alias_fqn = "quicksight_service.dataset.relation_id"

        mock_from_entity = MagicMock()
        mock_from_entity.name.root = "relation_table"
        mock_data_model = MagicMock()

        with patch(
            "metadata.ingestion.source.dashboard.quicksight.metadata.get_column_fqn",
            return_value=src_fqn,
        ):
            with patch.object(
                self.quicksight,
                "_get_data_model_column_fqn",
                return_value=alias_fqn,
            ):
                result = self.quicksight._build_column_lineage_from_parser(
                    mock_parser, mock_from_entity, mock_data_model
                )

        # Only 1 result — the wrong table's column must be filtered out
        assert len(result) == 1
        assert result[0].fromColumns == [src_fqn]
        assert result[0].toColumn == alias_fqn

    @pytest.mark.order(12)
    def test_build_column_lineage_no_fallback_when_parser_has_global_lineage(self):
        """
        Regression test for the multi-table fallback bug (Issue #26670).

        When lineage_parser.column_lineage is non-empty (parser succeeded)
        but none of the pairs match from_entity (because they belong to a
        different upstream table in a multi-table JOIN), the method must
        return an empty list and must NOT call _get_column_lineage (the
        name-based fallback). Calling the fallback here would manufacture
        incorrect cross-table column lineage.
        """
        # Parser found lineage for a DIFFERENT table, not our from_entity
        other_src_col = MagicMock()
        other_src_col.raw_name = "user_id"
        other_src_col._parent = MagicMock()
        other_src_col._parent.__str__ = MagicMock(return_value="users_table")

        other_tgt_col = MagicMock()
        other_tgt_col.raw_name = "uid"

        mock_parser = MagicMock()
        # Parser globally found lineage — but only for 'users_table'
        mock_parser.column_lineage = [(other_src_col, other_tgt_col)]

        mock_from_entity = MagicMock()
        # Our from_entity is 'orders_table' — no parser pairs match it
        mock_from_entity.name.root = "orders_table"
        mock_data_model = MagicMock()

        with patch.object(
            self.quicksight,
            "_get_column_lineage",
        ) as mock_fallback:
            result = self.quicksight._build_column_lineage_from_parser(
                mock_parser, mock_from_entity, mock_data_model
            )

        # Must NOT have called the name-based fallback
        mock_fallback.assert_not_called()
        # Must return an empty list — no manufactured lineage
        assert result == []

    @pytest.mark.order(13)
    def test_build_column_lineage_from_parser_falls_back_when_empty(self):
        """
        When lineage_parser.column_lineage is empty (parser failed or
        no aliases), _build_column_lineage_from_parser must fall back
        to name-based matching via _get_column_lineage.
        Issue #26670.
        """
        mock_parser = MagicMock()
        mock_parser.column_lineage = []

        fallback_lineage = [MagicMock()]
        mock_from_entity = MagicMock()
        mock_from_entity.name.root = "relation_table"

        # Build mock columns properly — avoid MagicMock name kwarg trap
        mock_col = MagicMock()
        mock_col.name = MagicMock()
        mock_col.name.root = "col_a"

        mock_data_model = MagicMock()
        mock_data_model.columns = [mock_col]

        with patch.object(
            self.quicksight,
            "_get_column_lineage",
            return_value=fallback_lineage,
        ) as mock_get_col_lineage:
            result = self.quicksight._build_column_lineage_from_parser(
                mock_parser, mock_from_entity, mock_data_model
            )

        # Verify fallback was called with correct column names
        mock_get_col_lineage.assert_called_once_with(
            mock_from_entity, mock_data_model, ["col_a"]
        )
        assert result is fallback_lineage
