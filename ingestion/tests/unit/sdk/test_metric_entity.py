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
from metadata.sdk import Metrics


class TestMetricEntity(unittest.TestCase):
    """Comprehensive tests for Metric entity operations"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()
        Metrics.set_default_client(self.mock_ometa)

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

    def test_add_followers(self):
        """Test adding followers to a metric"""
        user_ids = ["user1-uuid", "user2-uuid"]

        updated_metric = MagicMock(spec=MetricEntity)
        updated_metric.id = UUID(self.metric_id)
        updated_metric.followers = user_ids

        # Mock the client.put and get_by_id calls
        self.mock_ometa.client = MagicMock()
        self.mock_ometa.client.put = MagicMock()
        self.mock_ometa.get_suffix = MagicMock(return_value="/api/v1/metrics")
        self.mock_ometa.get_by_id.return_value = updated_metric

        result = Metrics.add_followers(self.metric_id, user_ids)

        self.assertEqual(result.followers, user_ids)
        # Verify client.put was called for each user
        assert self.mock_ometa.client.put.call_count == len(user_ids)

    def test_get_versions(self):
        """Test getting all versions of a metric"""
        version1 = MagicMock(spec=MetricEntity)
        version1.version = 0.1
        version1.metricExpression = MagicMock()

        version2 = MagicMock(spec=MetricEntity)
        version2.version = 0.2
        version2.metricExpression = MagicMock()

        mock_version_history = MagicMock()
        mock_version_history.versions = [version1, version2]
        self.mock_ometa.get_list_entity_versions.return_value = mock_version_history

        result = Metrics.get_versions(self.metric_id)

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].version, 0.1)
        self.assertIsNotNone(result[1].metricExpression)

    def test_restore_metric(self):
        """Test restoring a soft-deleted metric"""
        restored_metric = MagicMock(spec=MetricEntity)
        restored_metric.id = UUID(self.metric_id)
        restored_metric.deleted = False
        restored_metric.name = "revenue_metric"

        # Mock get_suffix to return proper endpoint
        self.mock_ometa.get_suffix.return_value = "metrics"
        # Mock the REST client's put method to return a dict
        self.mock_ometa.client.put.return_value = {
            "id": self.metric_id,
            "name": "revenue_metric",
            "deleted": False,
        }

        result = Metrics.restore(self.metric_id)

        # The result should be a Metric entity
        self.assertIsNotNone(result)
        self.assertEqual(str(result.id.root), self.metric_id)
        self.assertFalse(result.deleted)
        self.mock_ometa.client.put.assert_called_once_with(
            "/metrics/restore", json={"id": self.metric_id}
        )

    def test_add_related_metrics(self):
        """Test adding related metrics"""
        related_metric_ids = [
            "350e8400-e29b-41d4-a716-446655440001",
            "350e8400-e29b-41d4-a716-446655440002",
        ]

        # Mock get_by_id to return current metric without related metrics
        current_metric = MagicMock(spec=MetricEntity)
        current_metric.id = UUID(self.metric_id)
        current_metric.relatedMetrics = None
        current_metric.model_copy = MagicMock(return_value=current_metric)
        self.mock_ometa.get_by_id.return_value = current_metric

        # Mock patch to return updated metric
        updated_metric = MagicMock(spec=MetricEntity)
        updated_metric.id = UUID(self.metric_id)
        updated_metric.relatedMetrics = [
            MagicMock(id=UUID(related_metric_ids[0])),
            MagicMock(id=UUID(related_metric_ids[1])),
        ]
        self.mock_ometa.patch.return_value = updated_metric

        result = Metrics.add_related_metrics(self.metric_id, related_metric_ids)

        self.assertEqual(len(result.relatedMetrics), 2)
        # Verify get_by_id was called
        self.mock_ometa.get_by_id.assert_called_once_with(
            entity=MetricEntity, entity_id=self.metric_id, fields=["relatedMetrics"]
        )
        # Verify patch was called with source and destination
        self.mock_ometa.patch.assert_called_once()

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


if __name__ == "__main__":
    unittest.main()
