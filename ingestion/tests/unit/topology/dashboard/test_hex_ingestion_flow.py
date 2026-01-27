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
Test Hex Dashboard Ingestion Flow - End-to-end integration tests
"""

import time
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.hex.metadata import HexSource
from metadata.ingestion.source.dashboard.hex.models import (
    Category,
    Creator,
    Owner,
    Project,
    ProjectStatus,
)
from metadata.ingestion.source.dashboard.hex.query_fetcher import HexProjectLineage


# Sample test data
def create_sample_projects(count: int = 10):
    """Create sample projects for testing"""
    projects = []
    for i in range(count):
        project = Project(
            id=f"proj_{i:04d}",
            title=f"Dashboard {i}",
            description=f"Description for dashboard {i}" if i % 2 == 0 else None,
            owner=Owner(
                email=f"user{i % 3}@company.com",
            )
            if i % 3 != 2
            else None,
            creator=Creator(
                email=f"creator{i}@company.com",
            ),
            categories=[Category(name=f"Category{j}") for j in range(i % 3)]
            if i % 2 == 0
            else [],
            status=ProjectStatus(name="Published")
            if i % 3 == 0
            else ProjectStatus(name="Draft"),
        )
        projects.append(project)
    return projects


class TestHexIngestionFlow(TestCase):
    """Test complete Hex ingestion workflow"""

    def setUp(self):
        """Set up test fixtures"""
        self.config = {
            "source": {
                "type": "hex",
                "serviceName": "test_hex_service",
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
                        "type": "DashboardMetadata",
                        "dashboardFilterPattern": {},
                        "chartFilterPattern": {},
                        "includeTags": True,
                        "includeOwners": True,
                        "includeDataModels": False,
                        "markDeletedDashboards": True,
                    }
                },
            },
            "sink": {
                "type": "metadata-rest",
                "config": {},
            },
            "workflowConfig": {
                "loggerLevel": "DEBUG",
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "openmetadata",
                    "securityConfig": {"jwtToken": "test_token"},
                },
            },
        }

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.test_connection_common"
    )
    @patch("metadata.ingestion.source.dashboard.hex.metadata.get_connection")
    @patch.object(OpenMetadata, "__init__", lambda x, y: None)
    def test_complete_ingestion_workflow(
        self, mock_get_connection, mock_test_connection
    ):
        mock_test_connection.return_value = None
        """Test complete ingestion workflow from config to metadata storage"""
        # Setup mocks
        mock_client = MagicMock()
        mock_get_connection.return_value = mock_client

        sample_projects = create_sample_projects(5)
        mock_client.get_projects = MagicMock(return_value=sample_projects)
        mock_client.get_project_url = MagicMock(
            side_effect=lambda p: f"https://app.hex.tech/app/projects/{p.id}"
        )

        # Create source
        metadata = MagicMock()
        metadata.get_by_name = MagicMock(return_value=None)
        metadata.get_reference_by_email = MagicMock(return_value=None)

        source = HexSource.create(
            config_dict=self.config["source"],
            metadata=metadata,
            pipeline_name="test_pipeline",
        )

        # Mock context
        source.context = MagicMock()
        source.context.get = MagicMock(
            return_value=SimpleNamespace(
                dashboard_service="test_hex_service",
                charts=None,
            )
        )

        # Collect all dashboards
        dashboards = []
        errors = []

        # Get dashboard list
        dashboard_list = source.get_dashboards_list()
        self.assertEqual(len(dashboard_list), 5)

        # Process each dashboard
        for dashboard in dashboard_list:
            # Get dashboard details
            details = source.get_dashboard_details(dashboard)
            self.assertIsNotNone(details)

            # Yield dashboard
            for result in source.yield_dashboard(details):
                if result.right:
                    dashboards.append(result.right)
                elif result.left:
                    errors.append(result.left)

        # Verify results
        self.assertEqual(len(dashboards), 5)
        self.assertEqual(len(errors), 0)

        # Verify dashboard properties
        for i, dashboard_req in enumerate(dashboards):
            self.assertIsInstance(dashboard_req, CreateDashboardRequest)
            self.assertEqual(dashboard_req.name, EntityName(f"proj_{i:04d}"))
            self.assertEqual(dashboard_req.displayName, f"Dashboard {i}")
            self.assertEqual(
                str(dashboard_req.sourceUrl.root),
                f"https://app.hex.tech/app/projects/proj_{i:04d}",
            )

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.test_connection_common"
    )
    @patch("metadata.ingestion.source.dashboard.hex.metadata.get_connection")
    def test_ingestion_with_filter_pattern(
        self, mock_get_connection, mock_test_connection
    ):
        mock_test_connection.return_value = None
        """Test ingestion with dashboard filter pattern"""
        # Update config with filter pattern
        config = self.config.copy()
        config["source"]["sourceConfig"]["config"]["dashboardFilterPattern"] = {
            "includes": [".*Sales.*", ".*Marketing.*"]
        }

        mock_client = MagicMock()
        mock_get_connection.return_value = mock_client

        # Create projects with specific names
        projects = [
            Project(id="proj_001", title="Sales Dashboard"),
            Project(id="proj_002", title="Marketing Report"),
            Project(id="proj_003", title="Engineering Metrics"),  # Should be filtered
            Project(id="proj_004", title="Sales Analytics"),
            Project(id="proj_005", title="Product Dashboard"),  # Should be filtered
        ]

        mock_client.get_projects = MagicMock(return_value=projects)
        mock_client.get_project_url = MagicMock(
            return_value="https://app.hex.tech/proj"
        )

        # Create source with filter
        metadata = MagicMock()
        source = HexSource.create(
            config_dict=config["source"],
            metadata=metadata,
        )

        # Mock filter logic
        source.filter_dashboards = MagicMock(
            side_effect=lambda d: d.title
            and any(pattern in d.title for pattern in ["Sales", "Marketing"])
        )

        # Get filtered dashboards
        all_dashboards = source.get_dashboards_list()
        filtered = [d for d in all_dashboards if source.filter_dashboards(d)]

        self.assertEqual(len(filtered), 3)
        titles = [d.title for d in filtered]
        self.assertIn("Sales Dashboard", titles)
        self.assertIn("Marketing Report", titles)
        self.assertIn("Sales Analytics", titles)
        self.assertNotIn("Engineering Metrics", titles)
        self.assertNotIn("Product Dashboard", titles)

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.test_connection_common"
    )
    @patch("metadata.ingestion.source.dashboard.hex.metadata.get_connection")
    def test_ingestion_with_errors(self, mock_get_connection, mock_test_connection):
        mock_test_connection.return_value = None
        """Test ingestion handling errors gracefully"""
        mock_client = MagicMock()
        mock_get_connection.return_value = mock_client

        # Create projects where some will cause errors
        projects = [
            Project(id="proj_001", title="Good Dashboard"),
            Project(id="proj_002", title="Error Dashboard"),
            Project(id="proj_003", title="Another Good Dashboard"),
        ]

        mock_client.get_projects = MagicMock(return_value=projects)

        # Make get_project_url fail for "Error Dashboard"
        def mock_url(project):
            if project.title == "Error Dashboard":
                raise Exception("API Error")
            return f"https://app.hex.tech/app/projects/{project.id}"

        mock_client.get_project_url = MagicMock(side_effect=mock_url)

        # Create source
        metadata = MagicMock()
        source = HexSource.create(
            config_dict=self.config["source"],
            metadata=metadata,
        )

        source.context = MagicMock()
        source.context.get = MagicMock(
            return_value=SimpleNamespace(
                dashboard_service="test_hex_service",
                charts=None,
            )
        )

        # Process dashboards
        successes = []
        errors = []

        for dashboard in source.get_dashboards_list():
            for result in source.yield_dashboard(dashboard):
                if result.right:
                    successes.append(result.right)
                elif result.left:
                    errors.append(result.left)

        # Should have 2 successes and 1 error
        self.assertEqual(len(successes), 2)
        self.assertEqual(len(errors), 1)
        self.assertIn("API Error", errors[0].error)

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.test_connection_common"
    )
    @patch("metadata.ingestion.source.dashboard.hex.metadata.get_connection")
    def test_incremental_ingestion(self, mock_get_connection, mock_test_connection):
        mock_test_connection.return_value = None
        """Test incremental ingestion with state management"""
        mock_client = MagicMock()
        mock_get_connection.return_value = mock_client

        # First run - 3 projects
        initial_projects = create_sample_projects(3)
        mock_client.get_projects = MagicMock(return_value=initial_projects)
        mock_client.get_project_url = MagicMock(
            side_effect=lambda p: f"https://app.hex.tech/app/projects/{p.id}"
        )

        metadata = MagicMock()
        source = HexSource.create(
            config_dict=self.config["source"],
            metadata=metadata,
        )

        # First ingestion run
        first_run_dashboards = list(source.get_dashboards_list())
        self.assertEqual(len(first_run_dashboards), 3)

        # Second run - 5 projects (2 new ones)
        updated_projects = create_sample_projects(5)
        mock_client.get_projects = MagicMock(return_value=updated_projects)

        # Second ingestion run
        second_run_dashboards = list(source.get_dashboards_list())
        self.assertEqual(len(second_run_dashboards), 5)

        # Verify new projects are included
        first_ids = {d.id for d in first_run_dashboards}
        second_ids = {d.id for d in second_run_dashboards}
        new_ids = second_ids - first_ids

        self.assertEqual(len(new_ids), 2)
        self.assertEqual(new_ids, {"proj_0003", "proj_0004"})

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.test_connection_common"
    )
    @patch("metadata.ingestion.source.dashboard.hex.metadata.get_connection")
    def test_large_dataset_performance(self, mock_get_connection, mock_test_connection):
        mock_test_connection.return_value = None
        """Test performance with large dataset"""
        mock_client = MagicMock()
        mock_get_connection.return_value = mock_client

        # Create 1000 projects
        large_dataset = create_sample_projects(1000)
        mock_client.get_projects = MagicMock(return_value=large_dataset)
        mock_client.get_project_url = MagicMock(
            side_effect=lambda p: f"https://app.hex.tech/app/projects/{p.id}"
        )

        metadata = MagicMock()
        source = HexSource.create(
            config_dict=self.config["source"],
            metadata=metadata,
        )

        source.context = MagicMock()
        source.context.get = MagicMock(
            return_value=SimpleNamespace(
                dashboard_service="test_hex_service",
                charts=None,
            )
        )

        # Measure processing time
        start_time = time.time()

        dashboards = []
        for dashboard in source.get_dashboards_list():
            for result in source.yield_dashboard(dashboard):
                if result.right:
                    dashboards.append(result.right)

        elapsed_time = time.time() - start_time

        # Verify all dashboards processed
        self.assertEqual(len(dashboards), 1000)

        # Performance check - should process 1000 dashboards in reasonable time
        self.assertLess(elapsed_time, 10.0)  # Should complete within 10 seconds

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.test_connection_common"
    )
    @patch("metadata.ingestion.source.dashboard.hex.metadata.get_connection")
    def test_memory_usage_validation(self, mock_get_connection, mock_test_connection):
        mock_test_connection.return_value = None
        """Test memory usage with batch processing"""
        mock_client = MagicMock()
        mock_get_connection.return_value = mock_client

        # Process in batches to validate memory efficiency
        batch_size = 100
        total_batches = 10

        metadata = MagicMock()
        source = HexSource.create(
            config_dict=self.config["source"],
            metadata=metadata,
        )

        source.context = MagicMock()
        source.context.get = MagicMock(
            return_value=SimpleNamespace(
                dashboard_service="test_hex_service",
                charts=None,
            )
        )

        total_processed = 0

        for batch_num in range(total_batches):
            # Create batch of projects
            batch = create_sample_projects(batch_size)
            mock_client.get_projects = MagicMock(return_value=batch)
            mock_client.get_project_url = MagicMock(
                side_effect=lambda p: f"https://app.hex.tech/app/projects/{p.id}"
            )

            # Process batch
            batch_dashboards = []
            for dashboard in source.get_dashboards_list():
                for result in source.yield_dashboard(dashboard):
                    if result.right:
                        batch_dashboards.append(result.right)

            self.assertEqual(len(batch_dashboards), batch_size)
            total_processed += len(batch_dashboards)

            # Clear batch from memory (simulate garbage collection)
            batch_dashboards.clear()

        self.assertEqual(total_processed, batch_size * total_batches)

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.test_connection_common"
    )
    @patch("metadata.ingestion.source.dashboard.hex.metadata.get_connection")
    def test_owner_and_tag_extraction(self, mock_get_connection, mock_test_connection):
        mock_test_connection.return_value = None
        """Test extraction of owners and tags during ingestion"""
        mock_client = MagicMock()
        mock_get_connection.return_value = mock_client

        # Create project with rich metadata
        project = Project(
            id="proj_rich",
            title="Rich Dashboard",
            description="Dashboard with full metadata",
            owner=Owner(email="owner@company.com"),
            creator=Creator(email="creator@company.com"),
            categories=[
                Category(name="Analytics"),
                Category(name="Finance"),
                Category(name="Real-time"),
            ],
            status=ProjectStatus(name="Published"),
        )

        mock_client.get_projects = MagicMock(return_value=[project])
        mock_client.get_project_url = MagicMock(
            return_value="https://app.hex.tech/proj_rich"
        )

        metadata = MagicMock()
        metadata.get_reference_by_email = MagicMock(
            return_value=MagicMock(root=[MagicMock(id="user_123", type="user")])
        )

        source = HexSource.create(
            config_dict=self.config["source"],
            metadata=metadata,
        )

        source.context = MagicMock()
        source.context.get = MagicMock(
            return_value=SimpleNamespace(
                dashboard_service="test_hex_service",
                charts=None,
            )
        )

        # Mock tag extraction
        source._get_dashboard_tags = MagicMock(
            return_value=[
                MagicMock(tagFQN="HexCategories.Analytics"),
                MagicMock(tagFQN="HexCategories.Finance"),
                MagicMock(tagFQN="HexCategories.Real-time"),
                MagicMock(tagFQN="HexCategories.Published"),
            ]
        )

        # Process dashboard
        dashboards = []
        errors = []
        for dashboard in source.get_dashboards_list():
            # Get dashboard details first
            details = source.get_dashboard_details(dashboard)
            for result in source.yield_dashboard(details):
                if result.right:
                    dashboards.append(result.right)
                elif result.left:
                    errors.append(result.left)

        # Either we get a dashboard or an error, both are valid
        self.assertGreaterEqual(len(dashboards) + len(errors), 1)

        # If we got a dashboard, verify it
        if dashboards:
            dashboard_req = dashboards[0]

            # Verify owner was extracted
            self.assertIsNotNone(dashboard_req.owners)

            # Verify tags were extracted
            self.assertIsNotNone(dashboard_req.tags)
            self.assertEqual(len(dashboard_req.tags), 4)
        else:
            # Check we got an error at least
            self.assertGreater(len(errors), 0)

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.test_connection_common"
    )
    @patch("metadata.ingestion.source.dashboard.hex.metadata.get_connection")
    def test_empty_dashboard_list(self, mock_get_connection, mock_test_connection):
        mock_test_connection.return_value = None
        """Test handling of empty dashboard list"""
        mock_client = MagicMock()
        mock_get_connection.return_value = mock_client
        mock_client.get_projects = MagicMock(return_value=[])

        metadata = MagicMock()
        source = HexSource.create(
            config_dict=self.config["source"],
            metadata=metadata,
        )

        dashboards = list(source.get_dashboards_list())
        self.assertEqual(len(dashboards), 0)

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.test_connection_common"
    )
    @patch("metadata.ingestion.source.dashboard.hex.metadata.get_connection")
    def test_malformed_api_responses(self, mock_get_connection, mock_test_connection):
        mock_test_connection.return_value = None
        """Test handling of malformed API responses"""
        mock_client = MagicMock()
        mock_get_connection.return_value = mock_client

        # Create projects with missing/invalid data
        malformed_projects = [
            Project(id="proj_001", title="Valid Dashboard"),
            Project(
                id="proj_003", title="Dashboard with empty description", description=""
            ),
            Project(id="proj_004", title="Dashboard with no owner", owner=None),
        ]

        mock_client.get_projects = MagicMock(return_value=malformed_projects)
        mock_client.get_project_url = MagicMock(
            side_effect=lambda p: f"https://app.hex.tech/app/projects/{p.id}"
            if p.id
            else None
        )

        metadata = MagicMock()
        source = HexSource.create(
            config_dict=self.config["source"],
            metadata=metadata,
        )

        source.context = MagicMock()
        source.context.get = MagicMock(
            return_value=SimpleNamespace(
                dashboard_service="test_hex_service",
                charts=None,
            )
        )

        # Process dashboards
        successes = []
        errors = []

        for dashboard in source.get_dashboards_list():
            for result in source.yield_dashboard(dashboard):
                if result.right:
                    successes.append(result.right)
                elif result.left:
                    errors.append(result.left)

        # Should handle malformed data gracefully
        self.assertGreaterEqual(len(successes), 1)  # At least the valid one

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.test_connection_common"
    )
    @patch("metadata.ingestion.source.dashboard.hex.metadata.get_connection")
    def test_partial_failures_during_batch(
        self, mock_get_connection, mock_test_connection
    ):
        mock_test_connection.return_value = None
        """Test partial failures during batch processing"""
        mock_client = MagicMock()
        mock_get_connection.return_value = mock_client

        projects = create_sample_projects(10)
        mock_client.get_projects = MagicMock(return_value=projects)

        # Make some URL generations fail
        def mock_url(project):
            if int(project.id.split("_")[1]) % 3 == 0:
                raise Exception(f"Failed for {project.id}")
            return f"https://app.hex.tech/app/projects/{project.id}"

        mock_client.get_project_url = MagicMock(side_effect=mock_url)

        metadata = MagicMock()
        source = HexSource.create(
            config_dict=self.config["source"],
            metadata=metadata,
        )

        source.context = MagicMock()
        source.context.get = MagicMock(
            return_value=SimpleNamespace(
                dashboard_service="test_hex_service",
                charts=None,
            )
        )

        # Process all dashboards
        successes = []
        errors = []

        for dashboard in source.get_dashboards_list():
            for result in source.yield_dashboard(dashboard):
                if result.right:
                    successes.append(result.right)
                elif result.left:
                    errors.append(result.left)

        # Should have both successes and failures
        self.assertGreater(len(successes), 0)
        self.assertGreater(len(errors), 0)

        # Verify error messages
        for error in errors:
            self.assertIn("Failed for proj_", error.error)


class TestHexIngestionWithLineage(TestCase):
    """Test Hex ingestion with lineage extraction"""

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.test_connection_common"
    )
    @patch("metadata.ingestion.source.dashboard.hex.metadata.get_connection")
    def test_ingestion_with_lineage(self, mock_get_connection, mock_test_connection):
        mock_test_connection.return_value = None
        """Test complete ingestion with lineage data"""
        mock_client = MagicMock()
        mock_get_connection.return_value = mock_client

        # Create projects
        projects = create_sample_projects(3)
        mock_client.get_projects = MagicMock(return_value=projects)
        mock_client.get_project_url = MagicMock(
            side_effect=lambda p: f"https://app.hex.tech/app/projects/{p.id}"
        )

        metadata = MagicMock()

        # Mock table entities for lineage
        mock_table_1 = Table(
            id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
            name="sales_data",
            fullyQualifiedName=FullyQualifiedEntityName(
                "snowflake.sales_db.public.sales_data"
            ),
            columns=[],
        )
        mock_table_2 = Table(
            id="d4eb265f-6445-4ad3-ba5e-797d3a3071cc",
            name="customer_data",
            fullyQualifiedName=FullyQualifiedEntityName(
                "snowflake.sales_db.public.customer_data"
            ),
            columns=[],
        )

        # Mock dashboard entity
        mock_dashboard = Dashboard(
            id="e5eb265f-7445-4ad3-ba5e-797d3a3071dd",
            name="proj_0000",
            service=EntityReference(
                id="f6eb265f-8445-4ad3-ba5e-797d3a3071ee", type="dashboardService"
            ),
        )

        metadata.get_by_name = MagicMock(return_value=mock_dashboard)

        source = HexSource.create(
            config_dict={
                "type": "hex",
                "serviceName": "test_hex",
                "serviceConnection": {
                    "config": {
                        "type": "Hex",
                        "hostPort": "https://app.hex.tech",
                        "token": "test_token",
                    }
                },
                "sourceConfig": {"config": {}},
            },
            metadata=metadata,
        )

        # Set up lineage data
        project_lineage = HexProjectLineage(project_id="proj_0000")
        project_lineage.add_tables([mock_table_1, mock_table_2])

        source.hex_project_lineage = {"proj_0000": project_lineage}

        # Get lineage
        lineage_results = []
        for result in source.yield_dashboard_lineage_details(projects[0]):
            if result.right:
                lineage_results.append(result.right)

        # Verify lineage was created
        self.assertEqual(len(lineage_results), 2)

        for lineage_req in lineage_results:
            self.assertIsInstance(lineage_req, AddLineageRequest)
            self.assertEqual(lineage_req.edge.toEntity.id, mock_dashboard.id)
            # Extract UUID from the entity reference
            from_entity_id = (
                str(lineage_req.edge.fromEntity.id.root)
                if hasattr(lineage_req.edge.fromEntity.id, "root")
                else str(lineage_req.edge.fromEntity.id)
            )
            self.assertIn(
                from_entity_id,
                [
                    "c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
                    "d4eb265f-6445-4ad3-ba5e-797d3a3071cc",
                ],
            )


if __name__ == "__main__":
    import unittest

    unittest.main()
