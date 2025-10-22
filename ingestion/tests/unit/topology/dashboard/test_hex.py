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
Test Hex Dashboard using the topology
"""

from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
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
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.dashboard.hex.metadata import HexSource
from metadata.ingestion.source.dashboard.hex.models import (
    Category,
    Creator,
    Owner,
    Project,
    ProjectStatus,
)
from metadata.ingestion.source.dashboard.hex.query_fetcher import HexProjectLineage

# Mock Services
MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName("mock_hex"),
    name="mock_hex",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.Hex,
)

MOCK_DATABASE_SERVICE = DatabaseService(
    id="d3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName("mock_snowflake"),
    name="mock_snowflake",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Snowflake,
)

# Sample Data
SAMPLE_PROJECT = Project(
    id="proj_123456789",
    title="Sales Analytics Dashboard",
    description="Monthly sales performance metrics and KPIs",
    owner=Owner(email="john.doe@company.com"),
    creator=Creator(email="jane.smith@company.com"),
    categories=[
        Category(name="Analytics"),
        Category(name="Sales"),
    ],
    status=ProjectStatus(name="Published"),
)

SAMPLE_PROJECT_2 = Project(
    id="proj_987654321",
    title="Marketing Dashboard",
    description="Marketing campaign performance tracker",
    owner=Owner(email="alice@company.com"),
    categories=[Category(name="Marketing")],
    status=ProjectStatus(name="Draft"),
)

SAMPLE_PROJECT_NO_OWNER = Project(
    id="proj_555555555",
    title="Test Dashboard",
    description=None,
    owner=None,
    creator=None,
    categories=[],
    status=None,
)

EXAMPLE_TABLE = Table(
    id="0bd6bd6f-7fea-4a98-98c7-3b37073629c7",
    name="sales_data",
    fullyQualifiedName=FullyQualifiedEntityName(
        "mock_snowflake.sales_db.public.sales_data"
    ),
    columns=[],
)

EXAMPLE_DASHBOARD = LineageDashboard(
    id="7b3766b1-7eb4-4ad4-b7c8-15a8b16edfdd",
    name="proj_123456789",
    displayName="Sales Analytics Dashboard",
    service=EntityReference(
        id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="dashboardService"
    ),
)

# Mock configuration
MOCK_CONFIG = {
    "source": {
        "type": "hex",
        "serviceName": "mock_hex",
        "serviceConnection": {
            "config": {
                "type": "Hex",
                "hostPort": "https://app.hex.tech",
                "token": "test_token_123456",
                "tokenType": "personal",
            }
        },
        "sourceConfig": {
            "config": {
                "dashboardFilterPattern": {},
                "chartFilterPattern": {},
                "includeTags": True,
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "test_token"},
        },
    },
}


class TestHexSource(TestCase):
    """Test Hex connector source functionality"""

    @patch.object(HexSource, "__init__", lambda self, config, metadata: None)
    def setUp(self):
        """Set up test fixtures"""
        self.config = MagicMock()
        self.metadata = MagicMock()

        self.hex_source = HexSource(
            config=MagicMock(),
            metadata=self.metadata,
        )

        # Initialize required attributes
        self.hex_source.config = self.config
        self.hex_source.metadata = self.metadata
        self.hex_source.service_connection = MagicMock()
        self.hex_source.source_config = MagicMock()
        self.hex_source.source_config.includeTags = True
        self.hex_source.context = MagicMock()
        self.hex_source.context.get = MagicMock(
            return_value=SimpleNamespace(
                dashboard_service="mock_hex",
                charts=None,
            )
        )

        # Mock client
        self.hex_source.client = MagicMock()
        self.hex_source.client.get_projects = MagicMock(
            return_value=[SAMPLE_PROJECT, SAMPLE_PROJECT_2]
        )
        self.hex_source.client.get_project_url = MagicMock(
            return_value="https://app.hex.tech/app/projects/proj_123456789"
        )

        # Initialize lineage components
        self.hex_source.hex_project_lineage = {}
        self.hex_source.query_fetcher = MagicMock()

        # Mock register_record
        self.hex_source.register_record = MagicMock()

    def test_get_dashboards_list(self):
        """Test fetching dashboard list"""
        dashboards = self.hex_source.get_dashboards_list()

        self.assertEqual(len(dashboards), 2)
        self.assertEqual(dashboards[0].id, "proj_123456789")
        self.assertEqual(dashboards[0].title, "Sales Analytics Dashboard")
        self.assertEqual(dashboards[1].id, "proj_987654321")

    def test_get_dashboard_name(self):
        """Test getting dashboard name"""
        name = self.hex_source.get_dashboard_name(SAMPLE_PROJECT)
        self.assertEqual(name, "Sales Analytics Dashboard")

    def test_get_dashboard_details(self):
        """Test getting dashboard details"""
        details = self.hex_source.get_dashboard_details(SAMPLE_PROJECT)
        self.assertEqual(details.id, "proj_123456789")
        self.assertEqual(
            details.description, "Monthly sales performance metrics and KPIs"
        )

    def test_get_owner_ref_with_owner(self):
        """Test getting owner reference when owner exists"""
        mock_owner_ref = EntityReferenceList(
            root=[
                EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="user")
            ]
        )
        self.hex_source.metadata.get_reference_by_email = MagicMock(
            return_value=mock_owner_ref
        )

        owner_ref = self.hex_source.get_owner_ref(SAMPLE_PROJECT)

        self.hex_source.metadata.get_reference_by_email.assert_called_once_with(
            "john.doe@company.com"
        )
        self.assertEqual(owner_ref, mock_owner_ref)

    def test_get_owner_ref_with_creator_fallback(self):
        """Test getting owner reference falls back to creator"""
        project = Project(
            id="proj_test",
            title="Test",
            owner=None,
            creator=Creator(email="creator@company.com"),
        )

        mock_owner_ref = EntityReferenceList(
            root=[
                EntityReference(id="d3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="user")
            ]
        )
        self.hex_source.metadata.get_reference_by_email = MagicMock(
            return_value=mock_owner_ref
        )

        owner_ref = self.hex_source.get_owner_ref(project)

        self.hex_source.metadata.get_reference_by_email.assert_called_once_with(
            "creator@company.com"
        )
        self.assertEqual(owner_ref, mock_owner_ref)

    def test_get_owner_ref_no_owner(self):
        """Test getting owner reference when no owner or creator"""
        owner_ref = self.hex_source.get_owner_ref(SAMPLE_PROJECT_NO_OWNER)
        self.assertIsNone(owner_ref)

    def test_extract_tags_from_project(self):
        """Test extracting tags from project categories and status"""
        tags = self.hex_source._extract_tags_from_project(SAMPLE_PROJECT)

        self.assertIn("Analytics", tags)
        self.assertIn("Sales", tags)
        self.assertIn("Published", tags)
        self.assertEqual(len(tags), 3)

    def test_extract_tags_from_project_no_tags(self):
        """Test extracting tags when project has no categories or status"""
        tags = self.hex_source._extract_tags_from_project(SAMPLE_PROJECT_NO_OWNER)
        self.assertEqual(tags, [])

    @patch("metadata.ingestion.source.dashboard.hex.metadata.get_tag_labels")
    def test_get_dashboard_tags(self, mock_get_tag_labels):
        """Test getting dashboard tags"""
        mock_tag_labels = [
            TagLabel(
                tagFQN="HexCategories.Analytics",
                labelType=LabelType.Manual,
                state=State.Suggested,
                source=TagSource.Classification,
            )
        ]
        mock_get_tag_labels.return_value = mock_tag_labels

        tags = self.hex_source._get_dashboard_tags(SAMPLE_PROJECT)

        mock_get_tag_labels.assert_called_once()
        self.assertEqual(tags, mock_tag_labels)

    def test_yield_dashboard_success(self):
        """Test successful dashboard creation"""
        # Mock tag labels
        mock_tag_labels = [
            TagLabel(
                tagFQN="HexCategories.Analytics",
                labelType=LabelType.Manual,
                state=State.Suggested,
                source=TagSource.Classification,
            )
        ]
        self.hex_source._get_dashboard_tags = MagicMock(return_value=mock_tag_labels)

        # Mock owner ref
        mock_owner_ref = EntityReferenceList(
            root=[
                EntityReference(id="e3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="user")
            ]
        )
        self.hex_source.get_owner_ref = MagicMock(return_value=mock_owner_ref)

        results = list(self.hex_source.yield_dashboard(SAMPLE_PROJECT))

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], Either)
        self.assertIsNotNone(results[0].right)

        dashboard_request = results[0].right
        self.assertIsInstance(dashboard_request, CreateDashboardRequest)
        self.assertEqual(dashboard_request.name, EntityName("proj_123456789"))
        self.assertEqual(dashboard_request.displayName, "Sales Analytics Dashboard")
        self.assertEqual(
            dashboard_request.description,
            Markdown("Monthly sales performance metrics and KPIs"),
        )
        self.assertEqual(
            dashboard_request.sourceUrl,
            SourceUrl("https://app.hex.tech/app/projects/proj_123456789"),
        )
        self.assertEqual(dashboard_request.tags, mock_tag_labels)
        self.assertEqual(dashboard_request.owners, mock_owner_ref)

    def test_yield_dashboard_error(self):
        """Test dashboard creation with error"""
        self.hex_source.client.get_project_url = MagicMock(
            side_effect=Exception("API Error")
        )

        results = list(self.hex_source.yield_dashboard(SAMPLE_PROJECT))

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], Either)
        self.assertIsNotNone(results[0].left)
        self.assertIn("API Error", results[0].left.error)

    def test_yield_dashboard_lineage_details(self):
        """Test lineage creation between dashboard and tables"""
        # Set up lineage data
        project_lineage = HexProjectLineage(project_id="proj_123456789")
        project_lineage.add_table(EXAMPLE_TABLE)
        self.hex_source.hex_project_lineage = {"proj_123456789": project_lineage}

        # Mock dashboard entity
        self.hex_source.metadata.get_by_name = MagicMock(return_value=EXAMPLE_DASHBOARD)
        self.hex_source.config = MagicMock()
        self.hex_source.config.serviceName = "mock_hex"

        results = list(self.hex_source.yield_dashboard_lineage_details(SAMPLE_PROJECT))

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], Either)
        self.assertIsNotNone(results[0].right)

        lineage_request = results[0].right
        self.assertIsInstance(lineage_request, AddLineageRequest)
        self.assertEqual(lineage_request.edge.fromEntity.id, EXAMPLE_TABLE.id)
        self.assertEqual(lineage_request.edge.toEntity.id, EXAMPLE_DASHBOARD.id)

    def test_yield_dashboard_lineage_no_data(self):
        """Test lineage when no lineage data exists"""
        results = list(self.hex_source.yield_dashboard_lineage_details(SAMPLE_PROJECT))
        self.assertEqual(len(results), 0)

    def test_yield_dashboard_chart(self):
        """Test that Hex doesn't yield separate charts"""
        # yield_dashboard_chart returns None, not an iterable
        result = self.hex_source.yield_dashboard_chart(SAMPLE_PROJECT)
        self.assertIsNone(result)

    @patch("metadata.ingestion.source.dashboard.hex.metadata.get_connection")
    def test_create_source(self, mock_get_connection):
        """Test creating HexSource instance"""
        mock_get_connection.return_value = MagicMock()

        config = WorkflowSource.model_validate(MOCK_CONFIG["source"])
        metadata = MagicMock()

        source = HexSource.create(
            config_dict=MOCK_CONFIG["source"],
            metadata=metadata,
            pipeline_name="test_pipeline",
        )

        self.assertIsInstance(source, HexSource)
        self.assertEqual(source.config, config)
        self.assertEqual(source.metadata, metadata)

    def test_prepare_with_lineage(self):
        """Test prepare method with lineage fetching"""
        # Mock query fetcher
        mock_project_lineage = HexProjectLineage(project_id="proj_123456789")
        mock_project_lineage.add_table(EXAMPLE_TABLE)

        self.hex_source.query_fetcher.fetch_hex_queries_from_service_prefix = MagicMock(
            return_value={"proj_123456789": mock_project_lineage}
        )

        # Mock get_db_service_prefixes
        self.hex_source.get_db_service_prefixes = MagicMock(
            return_value=["mock_snowflake"]
        )

        self.hex_source.prepare()

        self.assertIn("proj_123456789", self.hex_source.hex_project_lineage)
        self.assertEqual(
            len(self.hex_source.hex_project_lineage["proj_123456789"].upstream_tables),
            1,
        )

    def test_prepare_with_multiple_warehouses(self):
        """Test prepare method with multiple warehouse prefixes"""
        # First warehouse data
        lineage1 = HexProjectLineage(project_id="proj_123456789")
        lineage1.add_table(EXAMPLE_TABLE)

        # Second warehouse data (same project, different table)
        table2 = Table(
            id="f3eb265f-5445-4ad3-ba5e-797d3a3071bb",
            name="marketing_data",
            fullyQualifiedName=FullyQualifiedEntityName(
                "mock_bigquery.marketing.public.campaigns"
            ),
            columns=[],
        )
        lineage2 = HexProjectLineage(project_id="proj_123456789")
        lineage2.add_table(table2)

        self.hex_source.query_fetcher.fetch_hex_queries_from_service_prefix = MagicMock(
            side_effect=[
                {"proj_123456789": lineage1},
                {"proj_123456789": lineage2},
            ]
        )

        self.hex_source.get_db_service_prefixes = MagicMock(
            return_value=["mock_snowflake", "mock_bigquery"]
        )

        self.hex_source.prepare()

        # Should merge tables from both warehouses
        self.assertIn("proj_123456789", self.hex_source.hex_project_lineage)
        self.assertEqual(
            len(self.hex_source.hex_project_lineage["proj_123456789"].upstream_tables),
            2,
        )

    def test_prepare_with_error(self):
        """Test prepare method handling errors gracefully"""
        self.hex_source.query_fetcher.fetch_hex_queries_from_service_prefix = MagicMock(
            side_effect=Exception("Connection failed")
        )

        self.hex_source.get_db_service_prefixes = MagicMock(
            return_value=["mock_snowflake"]
        )

        # Should not raise exception
        self.hex_source.prepare()

        # Should have empty lineage
        self.assertEqual(len(self.hex_source.hex_project_lineage), 0)


class TestHexProjectLineage(TestCase):
    """Test HexProjectLineage class"""

    def test_add_table(self):
        """Test adding a table to lineage"""
        lineage = HexProjectLineage(project_id="proj_123")

        lineage.add_table(EXAMPLE_TABLE)

        self.assertEqual(len(lineage.upstream_tables), 1)
        self.assertEqual(lineage.upstream_tables[0].id, EXAMPLE_TABLE.id)

    def test_add_duplicate_table(self):
        """Test that duplicate tables are not added"""
        lineage = HexProjectLineage(project_id="proj_123")

        lineage.add_table(EXAMPLE_TABLE)
        lineage.add_table(EXAMPLE_TABLE)  # Try to add same table again

        self.assertEqual(len(lineage.upstream_tables), 1)

    def test_add_tables(self):
        """Test adding multiple tables"""
        lineage = HexProjectLineage(project_id="proj_123")

        table2 = Table(
            id="a3eb265f-5445-4ad3-ba5e-797d3a3071bb",
            name="table2",
            fullyQualifiedName=FullyQualifiedEntityName("service.db.schema.table2"),
            columns=[],
        )

        lineage.add_tables([EXAMPLE_TABLE, table2])

        self.assertEqual(len(lineage.upstream_tables), 2)

    def test_add_none_table(self):
        """Test handling None table"""
        lineage = HexProjectLineage(project_id="proj_123")

        lineage.add_table(None)

        self.assertEqual(len(lineage.upstream_tables), 0)


if __name__ == "__main__":
    import unittest

    unittest.main()
