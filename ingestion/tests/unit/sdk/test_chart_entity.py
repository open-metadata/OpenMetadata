"""
Comprehensive unit tests for Chart entity with full mock coverage.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.entity.data.chart import Chart as ChartEntity
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk import Charts


class TestChartEntity(unittest.TestCase):
    """Comprehensive tests for Chart entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()
        Charts.set_default_client(self.mock_ometa)

        self.chart_id = "150e8400-e29b-41d4-a716-446655440000"
        self.chart_fqn = "dashboard-service.dashboard.chart1"

    def test_create_chart(self):
        """Test creating a chart"""
        create_request = CreateChartRequest(
            name="revenue_chart",
            displayName="Revenue Chart",
            description="Monthly revenue visualization",
            chartType=ChartType.Line,
            service="dashboard-service",
        )

        expected_chart = MagicMock(spec=ChartEntity)
        expected_chart.id = UUID(self.chart_id)
        expected_chart.name = "revenue_chart"
        expected_chart.displayName = "Revenue Chart"
        expected_chart.chartType = ChartType.Line

        self.mock_ometa.create_or_update.return_value = expected_chart

        result = Charts.create(create_request)

        self.assertEqual(str(result.id), self.chart_id)
        self.assertEqual(result.name, "revenue_chart")
        self.assertEqual(result.chartType, ChartType.Line)
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_chart_by_id(self):
        """Test retrieving a chart by ID"""
        expected_chart = MagicMock(spec=ChartEntity)
        expected_chart.id = UUID(self.chart_id)
        expected_chart.name = "revenue_chart"
        expected_chart.description = "Revenue tracking"

        self.mock_ometa.get_by_id.return_value = expected_chart

        result = Charts.retrieve(self.chart_id)

        self.assertEqual(str(result.id), self.chart_id)
        self.assertEqual(result.name, "revenue_chart")
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=ChartEntity, entity_id=self.chart_id, fields=None
        )

    def test_retrieve_chart_with_fields(self):
        """Test retrieving a chart with specific fields"""
        fields = ["owner", "tags", "dashboard", "service"]

        owner = EntityReference(
            id=UUID("750e8400-e29b-41d4-a716-446655440000"),
            type="user",
            name="analyst",
        )

        tags = [
            MagicMock(tagFQN="Department.Finance", labelType="Manual"),
            MagicMock(tagFQN="Priority.High", labelType="Manual"),
        ]

        expected_chart = MagicMock(spec=ChartEntity)
        expected_chart.id = UUID(self.chart_id)
        expected_chart.owner = owner
        expected_chart.tags = tags

        self.mock_ometa.get_by_id.return_value = expected_chart

        result = Charts.retrieve(self.chart_id, fields=fields)

        self.assertIsNotNone(result.owner)
        self.assertEqual(result.owner.name, "analyst")
        self.assertEqual(len(result.tags), 2)
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=ChartEntity, entity_id=self.chart_id, fields=fields
        )

    def test_retrieve_chart_by_name(self):
        """Test retrieving a chart by fully qualified name"""
        expected_chart = MagicMock(spec=ChartEntity)
        expected_chart.id = UUID(self.chart_id)
        expected_chart.fullyQualifiedName = self.chart_fqn

        self.mock_ometa.get_by_name.return_value = expected_chart

        result = Charts.retrieve_by_name(self.chart_fqn)

        self.assertEqual(result.fullyQualifiedName, self.chart_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=ChartEntity, fqn=self.chart_fqn, fields=None
        )

    def test_update_chart(self):
        """Test updating a chart"""
        chart_to_update = MagicMock(spec=ChartEntity)
        chart_to_update.id = UUID(self.chart_id)
        chart_to_update.description = "Updated revenue chart"

        # Mock the get_by_id to return the current state
        current_entity = MagicMock(spec=type(chart_to_update))
        current_entity.id = (
            chart_to_update.id
            if hasattr(chart_to_update, "id")
            else UUID(self.entity_id)
        )
        self.mock_ometa.get_by_id.return_value = current_entity

        # Mock the patch to return the updated entity
        self.mock_ometa.patch.return_value = chart_to_update

        result = Charts.update(chart_to_update)

        self.assertEqual(result.description, "Updated revenue chart")
        self.assertEqual(str(chart_to_update.id), self.chart_id)
        # Verify get_by_id was called to fetch current state
        self.mock_ometa.get_by_id.assert_called_once()
        # Verify patch was called with source and destination
        self.mock_ometa.patch.assert_called_once()

    def test_delete_chart(self):
        """Test deleting a chart"""
        Charts.delete(self.chart_id, recursive=False, hard_delete=False)

        self.mock_ometa.delete.assert_called_once_with(
            entity=ChartEntity,
            entity_id=self.chart_id,
            recursive=False,
            hard_delete=False,
        )

    def test_delete_chart_hard(self):
        """Test hard deleting a chart"""
        Charts.delete(self.chart_id, recursive=True, hard_delete=True)

        self.mock_ometa.delete.assert_called_once_with(
            entity=ChartEntity,
            entity_id=self.chart_id,
            recursive=True,
            hard_delete=True,
        )

    def test_list_charts(self):
        """Test listing charts"""
        mock_chart1 = MagicMock(spec=ChartEntity)
        mock_chart1.name = "chart1"
        mock_chart1.chartType = ChartType.Line

        mock_chart2 = MagicMock(spec=ChartEntity)
        mock_chart2.name = "chart2"
        mock_chart2.chartType = ChartType.Bar

        mock_response = MagicMock()
        mock_response.entities = [mock_chart1, mock_chart2]

        self.mock_ometa.list_entities.return_value = mock_response

        result = Charts.list(limit=10)

        self.assertEqual(len(result.entities), 2)
        self.assertEqual(result.entities[0].name, "chart1")
        self.assertEqual(result.entities[1].chartType, ChartType.Bar)
        self.mock_ometa.list_entities.assert_called_once()

    def test_add_followers(self):
        """Test adding followers to a chart"""
        user_ids = ["user1-uuid", "user2-uuid"]

        updated_chart = MagicMock(spec=ChartEntity)
        updated_chart.id = UUID(self.chart_id)
        updated_chart.followers = user_ids

        # Mock the client.put and get_by_id calls
        self.mock_ometa.client = MagicMock()
        self.mock_ometa.client.put = MagicMock()
        self.mock_ometa.get_suffix = MagicMock(return_value="/api/v1/charts")
        self.mock_ometa.get_by_id.return_value = updated_chart

        result = Charts.add_followers(self.chart_id, user_ids)

        self.assertEqual(result.followers, user_ids)
        # Verify client.put was called for each user
        assert self.mock_ometa.client.put.call_count == len(user_ids)

    def test_remove_followers(self):
        """Test removing followers from a chart"""
        user_ids = ["user1-uuid"]

        updated_chart = MagicMock(spec=ChartEntity)
        updated_chart.id = UUID(self.chart_id)
        updated_chart.followers = ["user2-uuid"]

        # Mock the client.delete and get_by_id calls
        self.mock_ometa.client = MagicMock()
        self.mock_ometa.client.delete = MagicMock()
        self.mock_ometa.get_suffix = MagicMock(return_value="/api/v1/charts")
        self.mock_ometa.get_by_id.return_value = updated_chart

        result = Charts.remove_followers(self.chart_id, user_ids)

        self.assertEqual(result.followers, ["user2-uuid"])
        # Verify client.delete was called for each user
        assert self.mock_ometa.client.delete.call_count == len(user_ids)

    def test_get_versions(self):
        """Test getting all versions of a chart"""
        version1 = MagicMock(spec=ChartEntity)
        version1.version = 0.1
        version2 = MagicMock(spec=ChartEntity)
        version2.version = 0.2

        mock_version_history = MagicMock()
        mock_version_history.versions = [version1, version2]
        self.mock_ometa.get_list_entity_versions.return_value = mock_version_history

        result = Charts.get_versions(self.chart_id)

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].version, 0.1)
        self.mock_ometa.get_list_entity_versions.assert_called_once_with(
            entity=ChartEntity, entity_id=self.chart_id
        )

    def test_get_specific_version(self):
        """Test getting a specific version of a chart"""
        versioned_chart = MagicMock(spec=ChartEntity)
        versioned_chart.id = UUID(self.chart_id)
        versioned_chart.version = 0.2

        self.mock_ometa.get_entity_version.return_value = versioned_chart

        result = Charts.get_specific_version(self.chart_id, "0.2")

        self.assertEqual(result.version, 0.2)
        self.mock_ometa.get_entity_version.assert_called_once_with(
            entity=ChartEntity, entity_id=self.chart_id, version="0.2"
        )

    def test_restore_chart(self):
        """Test restoring a soft-deleted chart"""
        restored_chart = MagicMock(spec=ChartEntity)
        restored_chart.id = UUID(self.chart_id)
        restored_chart.deleted = False
        restored_chart.name = "chart1"
        restored_chart.service = "service1"

        # Mock get_suffix to return proper endpoint
        self.mock_ometa.get_suffix.return_value = "charts"
        # Mock the REST client's put method to return a dict with proper service reference
        self.mock_ometa.client.put.return_value = {
            "id": self.chart_id,
            "name": "chart1",
            "service": {
                "id": "550e8400-e29b-41d4-a716-446655440001",
                "type": "dashboardService",
                "name": "service1",
            },
            "deleted": False,
        }

        result = Charts.restore(self.chart_id)

        # The result should be a Chart entity
        self.assertIsNotNone(result)
        self.assertEqual(str(result.id.root), self.chart_id)
        self.assertFalse(result.deleted)
        self.mock_ometa.client.put.assert_called_once_with(
            "/charts/restore", json={"id": self.chart_id}
        )

    def test_export_charts_csv(self):
        """Test exporting charts to CSV"""
        csv_data = "id,name,type,service\n123,chart1,Line,service1"
        self.mock_ometa.export_csv.return_value = csv_data

        exporter = Charts.export_csv("chart_export")
        result = exporter.execute()

        self.assertEqual(result, csv_data)
        self.mock_ometa.export_csv.assert_called_once_with(
            entity=ChartEntity, name="chart_export"
        )

    def test_import_charts_csv(self):
        """Test importing charts from CSV"""
        csv_data = "id,name,type,service\n123,chart1,Line,service1"
        import_status = "Successfully imported 1 chart"
        self.mock_ometa.import_csv.return_value = import_status

        importer = Charts.import_csv("import_name")
        importer.csv_data = csv_data
        importer.dry_run = False
        result = importer.execute()

        self.assertEqual(result, import_status)
        self.mock_ometa.import_csv.assert_called_once_with(
            entity=ChartEntity, name="import_name", csv_data=csv_data, dry_run=False
        )

    def test_chart_with_dashboard_reference(self):
        """Test chart with dashboard reference"""
        dashboard_ref = EntityReference(
            id=UUID("850e8400-e29b-41d4-a716-446655440000"),
            type="dashboard",
            name="sales_dashboard",
        )

        expected_chart = MagicMock(spec=ChartEntity)
        expected_chart.id = UUID(self.chart_id)
        expected_chart.dashboard = dashboard_ref

        self.mock_ometa.get_by_id.return_value = expected_chart

        result = Charts.retrieve(self.chart_id, fields=["dashboard"])

        self.assertIsNotNone(result.dashboard)
        self.assertEqual(result.dashboard.name, "sales_dashboard")

    def test_error_handling_not_found(self):
        """Test error handling when chart not found"""
        self.mock_ometa.get_by_id.side_effect = Exception("Chart not found")

        with self.assertRaises(Exception) as context:
            Charts.retrieve("non-existent-id")

        self.assertIn("Chart not found", str(context.exception))


if __name__ == "__main__":
    unittest.main()
