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
Test Domo Dashboard using the topology
"""

import json
import re
from copy import deepcopy
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart as LineageChart
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)
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
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.metabase.metadata import MetabaseSource
from metadata.ingestion.source.dashboard.metabase.models import (
    DatasetQuery,
    MetabaseChart,
    MetabaseDashboardDetails,
    MetabaseTable,
    Native,
)

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName("mock_metabase"),
    name="mock_metabase",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.Metabase,
)

MOCK_DATABASE_SERVICE = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName("mock_mysql"),
    name="mock_mysql",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Mysql,
)

Mock_DATABASE_SCHEMA = "my_schema"

Mock_DATABASE_SCHEMA_DEFAULT = "<default>"

EXAMPLE_DASHBOARD = LineageDashboard(
    id="7b3766b1-7eb4-4ad4-b7c8-15a8b16edfdd",
    name="lineage_dashboard",
    service=EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="dashboardService"),
)

EXAMPLE_CHART = LineageChart(
    id="a1b2c3d4-1234-5678-abcd-ef0123456789",
    name="lineage_chart",
    service=EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="dashboardService"),
)

EXAMPLE_TABLE = [
    Table(
        id="0bd6bd6f-7fea-4a98-98c7-3b37073629c7",
        name="lineage_table",
        columns=[],
    )
]
mock_config = {
    "source": {
        "type": "metabase",
        "serviceName": "mock_metabase",
        "serviceConnection": {
            "config": {
                "type": "Metabase",
                "username": "username",
                "password": "abcdefg",
                "hostPort": "http://metabase.com",
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
        "loggerLevel": "DEBUG",
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
        },
    },
}

MOCK_CHARTS = [
    MetabaseChart(
        description="Test Chart",
        table_id="1",
        database_id=1,
        name="chart1",
        id="1",
        dataset_query=DatasetQuery(type="query"),
        display="chart1",
        dashboard_ids=[],
    ),
    MetabaseChart(
        description="Test Chart",
        table_id="1",
        database_id=1,
        name="chart2",
        id="2",
        dataset_query=DatasetQuery(type="native", native=Native(query="select * from test_table")),
        display="chart2",
        dashboard_ids=[],
    ),
    MetabaseChart(name="chart3", id="3", dashboard_ids=[]),
]

EXPECTED_LINEAGE = AddLineageRequest(
    edge=EntitiesEdge(
        fromEntity=EntityReference(
            id="0bd6bd6f-7fea-4a98-98c7-3b37073629c7",
            type="table",
        ),
        toEntity=EntityReference(
            id="7b3766b1-7eb4-4ad4-b7c8-15a8b16edfdd",
            type="dashboard",
        ),
        lineageDetails=LineageDetails(source=LineageSource.DashboardLineage),
    )
)

EXPECTED_CHART_LINEAGE = AddLineageRequest(
    edge=EntitiesEdge(
        fromEntity=EntityReference(
            id="0bd6bd6f-7fea-4a98-98c7-3b37073629c7",
            type="table",
        ),
        toEntity=EntityReference(
            id="a1b2c3d4-1234-5678-abcd-ef0123456789",
            type="chart",
        ),
        lineageDetails=LineageDetails(source=LineageSource.DashboardLineage),
    )
)

MOCK_DASHBOARD_DETAILS = MetabaseDashboardDetails(
    description="SAMPLE DESCRIPTION", name="test_db", id="1", card_ids=["1", "2", "3"]
)


EXPECTED_DASHBOARD = [
    CreateDashboardRequest(
        name="1",
        displayName="test_db",
        description="SAMPLE DESCRIPTION",
        sourceUrl="http://metabase.com/dashboard/1-test-db",
        charts=[],
        service=FullyQualifiedEntityName("mock_metabase"),
        project="Test Collection",
    )
]

EXPECTED_CHARTS = [
    CreateChartRequest(
        name="1",
        displayName="chart1",
        description="Test Chart",
        chartType="Other",
        sourceUrl="http://metabase.com/question/1-chart1",
        tags=None,
        owners=None,
        service=FullyQualifiedEntityName("mock_metabase"),
    ),
    CreateChartRequest(
        name="2",
        displayName="chart2",
        description="Test Chart",
        chartType="Other",
        sourceUrl="http://metabase.com/question/2-chart2",
        tags=None,
        owners=None,
        service=FullyQualifiedEntityName("mock_metabase"),
    ),
    CreateChartRequest(
        name="3",
        displayName="chart3",
        description=None,
        chartType="Other",
        sourceUrl="http://metabase.com/question/3-chart3",
        tags=None,
        owners=None,
        service=FullyQualifiedEntityName("mock_metabase"),
    ),
]


class MetabaseUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Domo Dashboard Unit Test
    """

    @patch("metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection")
    @patch("metadata.ingestion.source.dashboard.metabase.connection.get_connection")
    def __init__(self, methodName, get_connection, test_connection) -> None:  # noqa: N803
        super().__init__(methodName)
        get_connection.return_value = False
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_config)
        self.metabase: MetabaseSource = MetabaseSource.create(
            mock_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.metabase.client = SimpleNamespace()
        self.metabase.context.get().__dict__["dashboard_service"] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root
        self.metabase.context.get().__dict__["project_name"] = "Test Collection"
        self.metabase.charts_dict = {str(chart.id): chart for chart in MOCK_CHARTS}

    def test_dashboard_name(self):
        assert self.metabase.get_dashboard_name(MOCK_DASHBOARD_DETAILS) == MOCK_DASHBOARD_DETAILS.name

    def test_check_database_schema_name(self):
        self.assertEqual(self.metabase.check_database_schema_name(Mock_DATABASE_SCHEMA), "my_schema")
        self.assertIsNone(self.metabase.check_database_schema_name(Mock_DATABASE_SCHEMA_DEFAULT))

    def test_yield_chart(self):
        """
        Function for testing charts
        """
        chart_list = []
        results = self.metabase.yield_dashboard_chart(MOCK_DASHBOARD_DETAILS)
        for result in results:
            if isinstance(result, Either) and result.right:
                chart_list.append(result.right)  # noqa: PERF401

        for expected, original in zip(EXPECTED_CHARTS, chart_list):  # noqa: B905
            self.assertEqual(expected, original)

    def test_yield_dashboard(self):
        """
        Function for testing charts
        """
        results = list(self.metabase.yield_dashboard(MOCK_DASHBOARD_DETAILS))
        self.assertEqual(EXPECTED_DASHBOARD, [res.right for res in results])

    @patch.object(OpenMetadata, "search_in_any_service", return_value=EXAMPLE_TABLE)
    @patch.object(MetabaseSource, "_get_chart_entity", return_value=EXAMPLE_CHART)
    @patch.object(MetabaseSource, "_get_database_service", return_value=MOCK_DATABASE_SERVICE)
    def test_yield_lineage(self, *_):
        """
        Function to test out lineage
        """
        self.metabase.client.get_database = lambda *_: None
        self.metabase.client.get_table = lambda *_: MetabaseTable(schema="test_schema", display_name="test_table")

        # _yield_lineage_from_api (card 1) + _yield_lineage_from_query (card 2): 2 dashboard lookups
        with patch.object(
            OpenMetadata,
            "get_by_name",
            side_effect=[EXAMPLE_DASHBOARD, EXAMPLE_DASHBOARD],
        ):
            result = self.metabase.yield_dashboard_lineage_details(
                dashboard_details=MOCK_DASHBOARD_DETAILS, db_service_prefix=None
            )
            lineage_results = [r.right for r in result if r.right is not None]
            self.assertIn(EXPECTED_LINEAGE, lineage_results)
            self.assertIn(EXPECTED_CHART_LINEAGE, lineage_results)

        # test out _yield_lineage_from_api (card 1 only): 1 dashboard lookup
        with patch.object(
            OpenMetadata,
            "get_by_name",
            side_effect=[EXAMPLE_DASHBOARD],
        ):
            mock_dashboard = deepcopy(MOCK_DASHBOARD_DETAILS)
            mock_dashboard.card_ids = [MOCK_DASHBOARD_DETAILS.card_ids[0]]
            result = self.metabase.yield_dashboard_lineage_details(
                dashboard_details=mock_dashboard,
                db_service_prefix=f"{MOCK_DATABASE_SERVICE.name}",
            )
            lineage_results = [r.right for r in result if r.right is not None]
            self.assertIn(EXPECTED_LINEAGE, lineage_results)
            self.assertIn(EXPECTED_CHART_LINEAGE, lineage_results)

        # test out _yield_lineage_from_query (card 2 only): 1 dashboard lookup
        with patch.object(
            OpenMetadata,
            "get_by_name",
            side_effect=[EXAMPLE_DASHBOARD],
        ):
            mock_dashboard.card_ids = [MOCK_DASHBOARD_DETAILS.card_ids[1]]
            result = self.metabase.yield_dashboard_lineage_details(
                dashboard_details=mock_dashboard,
                db_service_prefix=f"{MOCK_DATABASE_SERVICE.name}",
            )
            lineage_results = [r.right for r in result if r.right is not None]
            self.assertIn(EXPECTED_LINEAGE, lineage_results)
            self.assertIn(EXPECTED_CHART_LINEAGE, lineage_results)

        # test out missing chart entity: dashboard lineage should still be yielded
        with (
            patch.object(
                MetabaseSource,
                "_get_chart_entity",
                return_value=None,
            ),
            patch.object(
                OpenMetadata,
                "get_by_name",
                side_effect=[EXAMPLE_DASHBOARD],
            ),
        ):
            mock_dashboard.card_ids = [MOCK_DASHBOARD_DETAILS.card_ids[0]]
            result = self.metabase.yield_dashboard_lineage_details(
                dashboard_details=mock_dashboard,
                db_service_prefix=f"{MOCK_DATABASE_SERVICE.name}",
            )
            lineage_results = [r.right for r in result if r.right is not None]
            self.assertIn(EXPECTED_LINEAGE, lineage_results)
            self.assertNotIn(EXPECTED_CHART_LINEAGE, lineage_results)

        # test out missing dashboard entity: chart lineage should still be yielded
        with patch.object(
            OpenMetadata,
            "get_by_name",
            return_value=None,
        ):
            mock_dashboard.card_ids = [MOCK_DASHBOARD_DETAILS.card_ids[0]]
            result = self.metabase.yield_dashboard_lineage_details(
                dashboard_details=mock_dashboard,
                db_service_prefix=f"{MOCK_DATABASE_SERVICE.name}",
            )
            lineage_results = [r.right for r in result if r.right is not None]
            self.assertNotIn(EXPECTED_LINEAGE, lineage_results)
            self.assertIn(EXPECTED_CHART_LINEAGE, lineage_results)

        # test out if no query type
        with patch.object(OpenMetadata, "get_by_name", return_value=EXAMPLE_DASHBOARD):
            mock_dashboard.card_ids = [MOCK_DASHBOARD_DETAILS.card_ids[2]]
            result = self.metabase.yield_dashboard_lineage_details(
                dashboard_details=mock_dashboard, db_service_prefix="db.service.name"
            )
            self.assertEqual(list(result), [])

    def test_include_owners_flag_enabled(self):
        """
        Test that when includeOwners is True, owner information is processed
        """
        # Mock the source config to have includeOwners = True
        self.metabase.source_config.includeOwners = True

        # Test that owner information is processed when includeOwners is True
        self.assertTrue(self.metabase.source_config.includeOwners)

    def test_include_owners_flag_disabled(self):
        """
        Test that when includeOwners is False, owner information is not processed
        """
        # Mock the source config to have includeOwners = False
        self.metabase.source_config.includeOwners = False

        # Test that owner information is not processed when includeOwners is False
        self.assertFalse(self.metabase.source_config.includeOwners)

    def test_include_owners_flag_in_config(self):
        """
        Test that the includeOwners flag is properly set in the configuration
        """
        # Check that the mock configuration includes the includeOwners flag
        config = mock_config["source"]["sourceConfig"]["config"]
        self.assertIn("includeOwners", config)
        self.assertTrue(config["includeOwners"])

    def test_include_owners_flag_affects_owner_processing(self):
        """
        Test that the includeOwners flag affects how owner information is processed
        """
        # Test with includeOwners = True
        self.metabase.source_config.includeOwners = True
        self.assertTrue(self.metabase.source_config.includeOwners)

        # Test with includeOwners = False
        self.metabase.source_config.includeOwners = False
        self.assertFalse(self.metabase.source_config.includeOwners)

    def test_dataset_query_string_parsing(self):
        """
        Test that dataset_query field can handle both string and dict inputs
        """
        # Test 1: dataset_query as a proper dict
        chart_with_dict = MetabaseChart(
            name="test_chart_dict",
            id="100",
            dataset_query={
                "type": "native",
                "native": {"query": "SELECT * FROM users"},
            },
        )
        self.assertIsNotNone(chart_with_dict.dataset_query)
        self.assertEqual(chart_with_dict.dataset_query.type, "native")
        self.assertEqual(chart_with_dict.dataset_query.native.query, "SELECT * FROM users")

        # Test 2: dataset_query as a JSON string
        dataset_query_json = json.dumps({"type": "query", "database": 1, "query": {"source-table": 2}})
        chart_with_json_string = MetabaseChart(name="test_chart_json", id="101", dataset_query=dataset_query_json)
        self.assertIsNotNone(chart_with_json_string.dataset_query)
        self.assertEqual(chart_with_json_string.dataset_query.type, "query")

        # Test 3: dataset_query as a Python dict string (single quotes)
        dataset_query_str = "{'type': 'native', 'native': {'query': 'SELECT COUNT(*) FROM orders'}}"
        chart_with_dict_string = MetabaseChart(name="test_chart_dict_str", id="102", dataset_query=dataset_query_str)
        self.assertIsNotNone(chart_with_dict_string.dataset_query)
        self.assertEqual(chart_with_dict_string.dataset_query.type, "native")
        self.assertEqual(
            chart_with_dict_string.dataset_query.native.query,
            "SELECT COUNT(*) FROM orders",
        )

        # Test 4: dataset_query with None values as string
        dataset_query_with_none = "{'type': 'query', 'native': None, 'database': 1}"
        chart_with_none = MetabaseChart(name="test_chart_none", id="103", dataset_query=dataset_query_with_none)
        self.assertIsNotNone(chart_with_none.dataset_query)
        self.assertEqual(chart_with_none.dataset_query.type, "query")
        self.assertIsNone(chart_with_none.dataset_query.native)

        # Test 5: Invalid dataset_query string should return None
        invalid_dataset_query = "this is not valid json or dict"
        chart_with_invalid = MetabaseChart(name="test_chart_invalid", id="104", dataset_query=invalid_dataset_query)
        self.assertIsNone(chart_with_invalid.dataset_query)

        # Test 6: dataset_query as None
        chart_with_none_value = MetabaseChart(name="test_chart_none_value", id="105", dataset_query=None)
        self.assertIsNone(chart_with_none_value.dataset_query)

        # Test 7: New Metabase format with stages array
        chart_with_stages = MetabaseChart(
            name="test_chart_stages",
            id="106",
            dataset_query={
                "lib/type": "mbql/query",
                "database": 2,
                "stages": [
                    {
                        "lib/type": "mbql.stage/native",
                        "native": "SELECT * FROM new_format_table",
                    }
                ],
            },
        )
        self.assertIsNotNone(chart_with_stages.dataset_query)
        self.assertIsNotNone(chart_with_stages.dataset_query.native)
        self.assertEqual(chart_with_stages.dataset_query.type, "native")
        self.assertEqual(
            chart_with_stages.dataset_query.native.query,
            "SELECT * FROM new_format_table",
        )

    def test_chart_source_state_populated(self):
        """Verify register_record_chart populates chart_source_state after yield_dashboard_chart."""
        self.metabase.chart_source_state = set()
        list(self.metabase.yield_dashboard_chart(MOCK_DASHBOARD_DETAILS))
        assert len(self.metabase.chart_source_state) == 3
        for fqn in self.metabase.chart_source_state:
            assert "mock_metabase" in fqn

        # Test 8: New format with stages but no native query
        chart_with_empty_stages = MetabaseChart(
            name="test_chart_empty_stages",
            id="107",
            dataset_query={
                "lib/type": "mbql/query",
                "database": 2,
                "stages": [{"lib/type": "mbql.stage/mbql"}],
            },
        )
        self.assertIsNotNone(chart_with_empty_stages.dataset_query)
        self.assertIsNone(chart_with_empty_stages.dataset_query.native)

    @patch.object(OpenMetadata, "search_in_any_service", return_value=EXAMPLE_TABLE)
    @patch.object(MetabaseSource, "_get_chart_entity", return_value=EXAMPLE_CHART)
    @patch.object(MetabaseSource, "_get_database_service", return_value=MOCK_DATABASE_SERVICE)
    def test_yield_lineage_optional_clause_blocks(self, *_):
        """
        Lineage is correctly produced for native queries that use Metabase's
        [[...]] optional clause syntax. The blocks must be stripped before the
        query reaches LineageParser so that table references in FROM/JOIN
        clauses (outside the blocks) are correctly found.
        """
        self.metabase.client.get_database = lambda *_: None

        cases = [
            (
                "simple [[WHERE]] block",
                "SELECT id, name FROM test_table [[WHERE name LIKE {{name_filter}}]]",
            ),
            (
                "multiple [[AND]] blocks",
                "SELECT * FROM test_table WHERE 1=1 [[AND col_a = {{a}}]] [[AND col_b = {{b}}]] [[AND col_c = {{c}}]]",
            ),
            (
                "multiline [[...]] block",
                "SELECT * FROM test_table\n[[ AND (\n  ({{filter}} = 'TRUE' AND col > 0) OR\n  ({{filter}} = 'FALSE' AND col <= 0)\n)]]\nLIMIT 100",
            ),
            (
                "JOIN outside blocks with [[AND]] filters",
                "SELECT d.id, c.id FROM test_table d LEFT JOIN other_table c ON d.id = c.id WHERE 1=1 [[AND d.name LIKE {{d}}]] [[AND c.name LIKE {{c}}]]",
            ),
            (
                "complex query replicating customer report",
                "SELECT * FROM test_table WHERE 1=1 [[AND {{f_a}}]] [[AND {{f_b}}]] [[AND col LIKE CONCAT('%', {{f_c}}, '%')]] [[ AND (\n  ({{f_d}} = 'TRUE' AND due_date <= NOW()) OR\n  ({{f_d}} = 'FALSE' AND due_date > NOW())\n)]] AND source != 'val'",
            ),
        ]

        for description, query in cases:
            chart = MetabaseChart(
                name=description,
                id="opt_lineage",
                database_id=1,
                dataset_query=DatasetQuery(type="native", native=Native(query=query)),
                dashboard_ids=[],
            )
            self.metabase.charts_dict = {"opt_lineage": chart}
            dashboard = MetabaseDashboardDetails(name="test", id="1", card_ids=["opt_lineage"])

            with patch.object(OpenMetadata, "get_by_name", return_value=EXAMPLE_DASHBOARD):
                result = list(
                    self.metabase.yield_dashboard_lineage_details(dashboard_details=dashboard, db_service_prefix=None)
                )
                lineage_results = [r.right for r in result if r.right is not None]
                self.assertTrue(
                    len(lineage_results) > 0,
                    f"Expected lineage for case: {description}",
                )

        self.metabase.charts_dict = {str(chart.id): chart for chart in MOCK_CHARTS}


_STRIP = lambda q: re.sub(r"\[\[.*?\]\]", "", q, flags=re.DOTALL)  # noqa: E731


class TestMetabaseOptionalClauseStripping:
    """
    Pure unit tests for the [[...]] optional clause stripping regex.
    These verify the preprocessing step that runs before LineageParser.
    """

    def test_no_optional_blocks_query_unchanged(self):
        q = "SELECT id, name FROM dashboard_entity ORDER BY id DESC LIMIT 50"
        assert _STRIP(q) == q

    def test_single_where_block_fully_removed(self):
        q = "SELECT id FROM dashboard_entity [[WHERE name LIKE 'test']]"
        result = _STRIP(q)
        assert "[[" not in result
        assert "]]" not in result
        assert "WHERE" not in result
        assert "dashboard_entity" in result

    def test_multiple_and_blocks_all_removed(self):
        q = "SELECT * FROM t WHERE 1=1 [[AND a = {{x}}]] [[AND b = {{y}}]] [[AND c = {{z}}]]"
        result = _STRIP(q)
        assert "[[" not in result
        assert "{{" not in result
        assert "FROM t" in result
        assert "WHERE 1=1" in result

    def test_multiline_block_stripped_via_dotall(self):
        q = "SELECT * FROM orders\n[[ AND (\n  ({{f}} = 'TRUE' AND due_date <= NOW()) OR\n  ({{f}} = 'FALSE' AND due_date > NOW())\n)]]\nLIMIT 100"
        result = _STRIP(q)
        assert "[[" not in result
        assert "due_date" not in result
        assert "FROM orders" in result
        assert "LIMIT 100" in result

    def test_template_variable_inside_block_removed(self):
        q = "SELECT * FROM orders [[WHERE status = {{status}}]]"
        result = _STRIP(q)
        assert "{{status}}" not in result
        assert "WHERE" not in result
        assert "FROM orders" in result

    def test_join_table_inside_block_not_in_result(self):
        q = "SELECT d.id FROM dashboard_entity d [[LEFT JOIN chart_entity c ON d.id = c.id WHERE c.name LIKE {{f}}]]"
        result = _STRIP(q)
        assert "dashboard_entity" in result
        assert "chart_entity" not in result

    def test_both_tables_inside_block_neither_visible(self):
        q = "SELECT 1 [[FROM dashboard_entity d JOIN chart_entity c ON d.id = c.id WHERE d.name = {{f}}]]"
        result = _STRIP(q)
        assert "dashboard_entity" not in result
        assert "chart_entity" not in result

    def test_entire_query_in_block_gives_empty_string(self):
        q = "[[SELECT * FROM dashboard_entity WHERE name = {{filter}}]]"
        assert _STRIP(q) == ""

    def test_whitespace_only_after_stripping(self):
        q = "\n  [[SELECT * FROM dashboard_entity WHERE name = {{filter}}]]\n  "
        result = _STRIP(q)
        assert not result.strip()

    def test_empty_optional_block_removed(self):
        q = "SELECT * FROM t [[]]"
        result = _STRIP(q)
        assert "[[" not in result
        assert "FROM t" in result

    def test_complex_customer_query_all_seven_blocks_stripped(self):
        q = """SELECT *
FROM my_schema.my_table
WHERE 1 = 1
  [[AND {{filter_a}}]]
  [[AND {{filter_b}}]]
  [[AND {{filter_c}}]]
  [[AND {{filter_d}}]]
  [[AND {{filter_e}}]]
  [[AND column_name LIKE CONCAT('%', {{filter_f}}, '%')]]
  [[ AND (
      ({{filter_g}} = 'TRUE'  AND due_date <= CURRENT_DATE()) OR
      ({{filter_g}} = 'FALSE' AND due_date >  CURRENT_DATE()) OR
      ({{filter_g}} = NULL)
  )]]
  AND source != 'value'"""
        result = _STRIP(q)
        assert "[[" not in result
        assert "]]" not in result
        assert "my_schema.my_table" in result
        assert "source != 'value'" in result
        assert "filter_a" not in result
        assert "filter_g" not in result
        assert "due_date" not in result
        assert "CURRENT_DATE" not in result

    def test_non_greedy_strips_each_block_independently(self):
        q = "SELECT * FROM t WHERE 1=1 [[AND a = 1]] middle [[AND b = 2]]"
        result = _STRIP(q)
        assert "middle" in result
        assert "AND a" not in result
        assert "AND b" not in result

    def test_whitespace_preserved_outside_blocks(self):
        q = "SELECT id\nFROM t\n[[WHERE x = 1]]\nORDER BY id"
        result = _STRIP(q)
        assert "FROM t" in result
        assert "ORDER BY id" in result
        assert "WHERE" not in result
