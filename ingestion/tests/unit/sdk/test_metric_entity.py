"""
Comprehensive unit tests for Metric entity with full mock coverage.
"""
import unittest
from unittest.mock import MagicMock
from uuid import UUID

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import Metric as MetricEntity
from metadata.generated.schema.entity.data.metric import MetricGranularity, MetricType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.entities.metrics import Metrics


class TestMetricEntity(unittest.TestCase):
    """Comprehensive tests for Metric entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()
        Metrics._default_client = self.mock_ometa

        self.metric_id = "250e8400-e29b-41d4-a716-446655440000"
        self.metric_fqn = "service.metric.revenue_metric"

    def test_create_metric(self):
        """Test creating a metric"""
        create_request = CreateMetricRequest(
            name="revenue_metric",
            displayName="Revenue Metric",
            description="Monthly revenue tracking metric",
            metricType=MetricType.PERCENTAGE,
            granularity=MetricGranularity.MONTH,
        )

        expected_metric = MagicMock(spec=MetricEntity)
        expected_metric.id = UUID(self.metric_id)
        expected_metric.name = "revenue_metric"
        expected_metric.metricType = MetricType.PERCENTAGE
        expected_metric.granularity = MetricGranularity.MONTH

        self.mock_ometa.create_or_update.return_value = expected_metric

        result = Metrics.create(create_request)

        self.assertEqual(str(result.id), self.metric_id)
        self.assertEqual(result.name, "revenue_metric")
        self.assertEqual(result.metricType, MetricType.PERCENTAGE)
        self.assertEqual(result.granularity, MetricGranularity.MONTH)
        self.mock_ometa.create_or_update.assert_called_once_with(create_request)

    def test_retrieve_metric_by_id(self):
        """Test retrieving a metric by ID"""
        expected_metric = MagicMock(spec=MetricEntity)
        expected_metric.id = UUID(self.metric_id)
        expected_metric.name = "revenue_metric"
        expected_metric.metricExpression = MagicMock()

        self.mock_ometa.get_by_id.return_value = expected_metric

        result = Metrics.retrieve(self.metric_id)

        self.assertEqual(str(result.id), self.metric_id)
        self.assertIsNotNone(result.metricExpression)
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=MetricEntity, entity_id=self.metric_id, fields=None
        )

    def test_retrieve_metric_with_fields(self):
        """Test retrieving a metric with specific fields"""
        fields = ["owner", "tags", "relatedMetrics"]

        owner = EntityReference(
            id=UUID("750e8400-e29b-41d4-a716-446655440000"),
            type="team",
            name="analytics-team",
        )

        related_metric = EntityReference(
            id=UUID("350e8400-e29b-41d4-a716-446655440000"),
            type="metric",
            name="profit_metric",
        )

        expected_metric = MagicMock(spec=MetricEntity)
        expected_metric.id = UUID(self.metric_id)
        expected_metric.owner = owner
        expected_metric.relatedMetrics = [related_metric]

        self.mock_ometa.get_by_id.return_value = expected_metric

        result = Metrics.retrieve(self.metric_id, fields=fields)

        self.assertIsNotNone(result.owner)
        self.assertEqual(result.owner.name, "analytics-team")
        self.assertEqual(len(result.relatedMetrics), 1)
        self.assertEqual(result.relatedMetrics[0].name, "profit_metric")

    def test_retrieve_metric_by_name(self):
        """Test retrieving a metric by fully qualified name"""
        expected_metric = MagicMock(spec=MetricEntity)
        expected_metric.id = UUID(self.metric_id)
        expected_metric.fullyQualifiedName = self.metric_fqn

        self.mock_ometa.get_by_name.return_value = expected_metric

        result = Metrics.retrieve_by_name(self.metric_fqn)

        self.assertEqual(result.fullyQualifiedName, self.metric_fqn)
        self.mock_ometa.get_by_name.assert_called_once_with(
            entity=MetricEntity, fqn=self.metric_fqn, fields=None
        )

    def test_update_metric(self):
        """Test updating a metric"""
        metric_to_update = MagicMock(spec=MetricEntity)
        metric_to_update.id = UUID(self.metric_id)
        metric_to_update.description = "Updated revenue metric"
        metric_to_update.metricExpression = MagicMock()

        # Mock the get_by_id to return the current state
        current_entity = MagicMock(spec=type(metric_to_update))
        current_entity.id = (
            metric_to_update.id
            if hasattr(metric_to_update, "id")
            else UUID(self.entity_id)
        )
        self.mock_ometa.get_by_id.return_value = current_entity

        # Mock the patch to return the updated entity
        self.mock_ometa.patch.return_value = metric_to_update

        result = Metrics.update(metric_to_update)

        self.assertEqual(result.description, "Updated revenue metric")
        self.assertIsNotNone(result.metricExpression)
        # Verify get_by_id was called to fetch current state
        self.mock_ometa.get_by_id.assert_called_once()
        # Verify patch was called with source and destination
        self.mock_ometa.patch.assert_called_once()

    def test_patch_metric(self):
        """Test patching a metric"""
        json_patch = [
            {"op": "replace", "path": "/metricType", "value": "COUNT"},
            {"op": "add", "path": "/tags/0", "value": {"tagFQN": "KPI.Revenue"}},
            {"op": "replace", "path": "/granularity", "value": "Week"},
        ]

        patched_metric = MagicMock(spec=MetricEntity)
        patched_metric.id = UUID(self.metric_id)
        patched_metric.metricType = MetricType.COUNT
        patched_metric.granularity = MetricGranularity.WEEK

        self.mock_ometa.patch.return_value = patched_metric

        result = Metrics.patch(self.metric_id, json_patch)

        self.assertEqual(result.metricType, MetricType.COUNT)
        self.assertEqual(result.granularity, MetricGranularity.WEEK)
        self.mock_ometa.patch.assert_called_once_with(
            entity=MetricEntity, entity_id=self.metric_id, json_patch=json_patch
        )

    def test_delete_metric(self):
        """Test deleting a metric"""
        Metrics.delete(self.metric_id, recursive=False, hard_delete=False)

        self.mock_ometa.delete.assert_called_once_with(
            entity=MetricEntity,
            entity_id=self.metric_id,
            recursive=False,
            hard_delete=False,
        )

    def test_list_metrics(self):
        """Test listing metrics"""
        mock_metric1 = MagicMock(spec=MetricEntity)
        mock_metric1.name = "metric1"
        mock_metric1.metricType = MetricType.COUNT

        mock_metric2 = MagicMock(spec=MetricEntity)
        mock_metric2.name = "metric2"
        mock_metric2.metricType = MetricType.PERCENTAGE

        mock_response = MagicMock()
        mock_response.entities = [mock_metric1, mock_metric2]

        self.mock_ometa.list_entities.return_value = mock_response

        result = Metrics.list(limit=10)

        self.assertEqual(len(result.entities), 2)
        self.assertEqual(result.entities[0].name, "metric1")
        self.assertEqual(result.entities[1].metricType, MetricType.PERCENTAGE)

    @unittest.skip("Method not yet implemented in SDK")
    def test_add_followers(self):
        """Test adding followers to a metric"""
        user_ids = ["user1-uuid", "user2-uuid"]

        updated_metric = MagicMock(spec=MetricEntity)
        updated_metric.id = UUID(self.metric_id)
        updated_metric.followers = user_ids

        self.mock_ometa.add_followers.return_value = updated_metric

        result = Metrics.add_followers(self.metric_id, user_ids)

        self.assertEqual(result.followers, user_ids)
        self.mock_ometa.add_followers.assert_called_once_with(
            entity=MetricEntity, entity_id=self.metric_id, user_ids=user_ids
        )

    @unittest.skip("Method not yet implemented in SDK")
    def test_get_versions(self):
        """Test getting all versions of a metric"""
        version1 = MagicMock(spec=MetricEntity)
        version1.version = 0.1
        version1.metricExpression = MagicMock()

        version2 = MagicMock(spec=MetricEntity)
        version2.version = 0.2
        version2.metricExpression = MagicMock()

        self.mock_ometa.get_entity_versions.return_value = [version1, version2]

        result = Metrics.get_versions(self.metric_id)

        self.assertEqual(len(result.entities), 2)
        self.assertEqual(result.entities[0].version, 0.1)
        self.assertIsNotNone(result.entities[1].metricExpression)

    @unittest.skip("Method not yet implemented in SDK")
    def test_restore_metric(self):
        """Test restoring a soft-deleted metric"""
        restored_metric = MagicMock(spec=MetricEntity)
        restored_metric.id = UUID(self.metric_id)
        restored_metric.deleted = False

        self.mock_ometa.restore_entity.return_value = restored_metric

        result = Metrics.restore(self.metric_id)

        self.assertFalse(result.deleted)
        self.mock_ometa.restore_entity.assert_called_once_with(
            entity=MetricEntity, entity_id=self.metric_id
        )

    @unittest.skip("Method not yet implemented in SDK")
    def test_add_related_metrics(self):
        """Test adding related metrics"""
        related_metric_ids = ["metric2-uuid", "metric3-uuid"]

        expected_patch = [
            {"op": "add", "path": "/relatedMetrics/-", "value": {"id": "metric2-uuid"}},
            {"op": "add", "path": "/relatedMetrics/-", "value": {"id": "metric3-uuid"}},
        ]

        updated_metric = MagicMock(spec=MetricEntity)
        updated_metric.id = UUID(self.metric_id)
        updated_metric.relatedMetrics = [
            MagicMock(id="metric2-uuid"),
            MagicMock(id="metric3-uuid"),
        ]

        self.mock_ometa.patch.return_value = updated_metric

        result = Metrics.add_related_metrics(self.metric_id, related_metric_ids)

        self.assertEqual(len(result.relatedMetrics), 2)
        self.mock_ometa.patch.assert_called_once_with(
            entity=MetricEntity, entity_id=self.metric_id, json_patch=expected_patch
        )

    def test_update_metric_type(self):
        """Test updating metric type"""
        new_type = "SUM"

        expected_patch = [{"op": "replace", "path": "/metricType", "value": new_type}]

        updated_metric = MagicMock(spec=MetricEntity)
        updated_metric.id = UUID(self.metric_id)
        updated_metric.metricType = MetricType.SUM

        self.mock_ometa.patch.return_value = updated_metric

        result = Metrics.patch(self.metric_id, expected_patch)

        self.assertEqual(result.metricType, MetricType.SUM)
        self.mock_ometa.patch.assert_called_once_with(
            entity=MetricEntity, entity_id=self.metric_id, json_patch=expected_patch
        )

    def test_export_metrics_csv(self):
        """Test exporting metrics to CSV"""
        csv_data = "id,name,type,formula\n123,revenue,Percentage,SUM(revenue)"
        self.mock_ometa.export_csv.return_value = csv_data

        exporter = result = Metrics.export_csv("metric_export")
        result = exporter.execute()

        self.assertEqual(result, csv_data)
        self.mock_ometa.export_csv.assert_called_once_with(
            entity=MetricEntity, name="metric_export"
        )

    def test_import_metrics_csv(self):
        """Test importing metrics from CSV"""
        csv_data = "id,name,type,formula\n123,revenue,Percentage,SUM(revenue)"
        import_status = "Successfully imported 1 metric"
        self.mock_ometa.import_csv.return_value = import_status

        importer = Metrics.import_csv("import_name")
        importer.csv_data = csv_data
        importer.dry_run = False
        result = importer.execute()

        self.assertEqual(result, import_status)
        self.mock_ometa.import_csv.assert_called_once_with(
            entity=MetricEntity, name="import_name", csv_data=csv_data, dry_run=False
        )

    def test_metric_with_dimensions(self):
        """Test metric with dimensions"""
        dimensions = ["region", "product", "quarter"]

        expected_metric = MagicMock(spec=MetricEntity)
        expected_metric.id = UUID(self.metric_id)
        expected_metric.dimensions = dimensions

        self.mock_ometa.get_by_id.return_value = expected_metric

        result = Metrics.retrieve(self.metric_id, fields=["dimensions"])

        self.assertIsNotNone(result.dimensions)
        self.assertEqual(len(result.dimensions), 3)
        self.assertIn("region", result.dimensions)

    def test_error_handling_invalid_formula(self):
        """Test error handling for invalid formula"""
        invalid_patch = [{"op": "replace", "path": "/metricType", "value": "INVALID"}]
        self.mock_ometa.patch.side_effect = ValueError("Invalid metric type")

        with self.assertRaises(ValueError) as context:
            Metrics.patch(self.metric_id, invalid_patch)

        self.assertIn("Invalid metric type", str(context.exception))


if __name__ == "__main__":
    unittest.main()
