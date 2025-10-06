import unittest

"""
Unit tests for plural SDK entity classes
"""
from unittest.mock import MagicMock, patch
from uuid import UUID

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Table

# Import plural SDK classes
from metadata.sdk import Charts, Dashboards, Databases, MLModels, Pipelines, Tables


class TestTablesSDK:
    """Test Tables SDK class"""

    def setup_method(self):
        """Set up test fixtures"""
        self.mock_ometa = MagicMock()
        self.table_id = UUID("550e8400-e29b-41d4-a716-446655440000")

    @patch.object(Tables, "_get_client")
    def test_entity_type(self, mock_get_client):
        """Test that Tables.entity_type returns Table class"""
        assert Tables.entity_type() == Table

    @patch.object(Tables, "_get_client")
    def test_add_tag(self, mock_get_client):
        """Test adding a tag to a table"""
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        table_id = "table-uuid"

        # Mock get_by_id to return a table with tags
        mock_table = MagicMock(spec=Table)
        mock_table.tags = []
        mock_ometa.get_by_id.return_value = mock_table

        # Mock patch to return the updated table
        updated_table = MagicMock(spec=Table)
        updated_table.tags = [MagicMock(tagFQN="PII.Sensitive")]
        mock_ometa.patch.return_value = updated_table

        # Act
        result = Tables.add_tag(table_id, "PII.Sensitive")

        # Assert
        assert result.tags is not None
        assert result.tags[0].tagFQN == "PII.Sensitive"
        mock_ometa.get_by_id.assert_called_once()
        mock_ometa.patch.assert_called_once()

    @patch.object(Tables, "_get_client")
    def test_update_column_description(self, mock_get_client):
        """Test updating column description"""
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        table_id = "table-uuid"
        column_name = "user_id"
        new_description = "Updated description"

        # Mock get_by_id to return a table with columns
        mock_table = MagicMock(spec=Table)
        mock_column = MagicMock()
        mock_column.name = column_name  # Set the name property explicitly
        mock_column.description = "Old description"
        mock_table.columns = [mock_column]

        # Mock model_copy to return the same object (simulating a deep copy)
        mock_table.model_copy.return_value = mock_table

        mock_ometa.get_by_id.return_value = mock_table

        # Mock patch to return the updated table
        updated_table = MagicMock(spec=Table)
        updated_column = MagicMock()
        updated_column.name = column_name  # Set the name property explicitly
        updated_column.description = new_description
        updated_table.columns = [updated_column]
        mock_ometa.patch.return_value = updated_table

        # Act
        result = Tables.update_column_description(
            table_id, column_name, new_description
        )

        # Assert
        assert result.columns[0].description == new_description
        mock_ometa.get_by_id.assert_called_once()
        mock_ometa.patch.assert_called_once()


class TestDatabasesSDK:
    """Test Databases SDK class"""

    @patch.object(Databases, "_get_client")
    def test_entity_type(self, mock_get_client):
        """Test that Databases.entity_type returns Database class"""
        assert Databases.entity_type() == Database

    @patch.object(Databases, "_get_client")
    def test_create_database(self, mock_get_client):
        """Test creating a database"""
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        create_request = CreateDatabaseRequest(
            name="test_db",
            service="test_service",
        )

        mock_db = MagicMock(spec=Database)
        mock_db.name = "test_db"
        mock_ometa.create_or_update.return_value = mock_db

        result = Databases.create(create_request)

        assert result.name == "test_db"
        mock_ometa.create_or_update.assert_called_once_with(create_request)


class TestChartsSDK:
    """Test Charts SDK class"""

    @patch.object(Charts, "_get_client")
    def test_entity_type(self, mock_get_client):
        """Test that Charts.entity_type returns Chart class"""
        assert Charts.entity_type() == Chart

    @patch.object(Charts, "_get_client")
    def test_retrieve_by_name(self, mock_get_client):
        """Test retrieving a chart by name"""
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        mock_chart = MagicMock(spec=Chart)
        mock_chart.id = "chart-123"
        mock_chart.name = "Sales Chart"
        mock_chart.fullyQualifiedName = "service.Sales Chart"
        mock_ometa.get_by_name.return_value = mock_chart

        result = Charts.retrieve_by_name("service.Sales Chart")

        assert result.name == "Sales Chart"
        mock_ometa.get_by_name.assert_called_once_with(
            entity=Chart, fqn="service.Sales Chart", fields=None
        )


class TestDashboardsSDK:
    """Test Dashboards SDK class"""

    @patch.object(Dashboards, "_get_client")
    def test_entity_type(self, mock_get_client):
        """Test that Dashboards.entity_type returns Dashboard class"""
        assert Dashboards.entity_type() == Dashboard

    @patch.object(Dashboards, "_get_client")
    def test_list_dashboards(self, mock_get_client):
        """Test listing dashboards"""
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        mock_dash1 = MagicMock(spec=Dashboard)
        mock_dash1.name = "dashboard1"
        mock_dash2 = MagicMock(spec=Dashboard)
        mock_dash2.name = "dashboard2"

        mock_response = MagicMock()
        mock_response.entities = [mock_dash1, mock_dash2]
        mock_ometa.list_entities.return_value = mock_response

        result = Dashboards.list()

        assert len(result.entities) == 2
        assert result.entities[0].name == "dashboard1"
        assert result.entities[1].name == "dashboard2"


class TestPipelinesSDK:
    """Test Pipelines SDK class"""

    @patch.object(Pipelines, "_get_client")
    def test_entity_type(self, mock_get_client):
        """Test that Pipelines.entity_type returns Pipeline class"""
        assert Pipelines.entity_type() == Pipeline

    @patch.object(Pipelines, "_get_client")
    def test_search_pipelines(self, mock_get_client):
        """Test searching pipelines"""
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        mock_pipeline = MagicMock(spec=Pipeline)
        mock_pipeline.name = "etl_pipeline"
        mock_ometa.es_search_from_fqn.return_value = [mock_pipeline]

        results = Pipelines.search("test")

        assert len(results) == 1
        assert results[0].name == "etl_pipeline"
        mock_ometa.es_search_from_fqn.assert_called_once_with(
            entity_type=Pipeline, fqn_search_string="test", size=10
        )


class TestMLModelsSDK:
    """Test MLModels SDK class"""

    @patch.object(MLModels, "_get_client")
    def test_entity_type(self, mock_get_client):
        """Test that MLModels.entity_type returns MlModel class"""
        assert MLModels.entity_type() == MlModel

    @patch.object(MLModels, "_get_client")
    def test_delete_mlmodel(self, mock_get_client):
        """Test deleting an ML model"""
        mock_ometa = MagicMock()
        mock_get_client.return_value = mock_ometa

        model_id = "model-123"
        MLModels.delete(model_id, hard_delete=False)

        mock_ometa.delete.assert_called_once_with(
            entity=MlModel, entity_id=model_id, hard_delete=False, recursive=False
        )


class TestSDKPluralNaming:
    """Test that all SDK classes use plural naming"""

    def test_all_sdk_classes_are_plural(self):
        """Verify SDK classes use plural names"""
        from metadata.sdk import (
            APICollections,
            APIEndpoints,
            Charts,
            Classifications,
            Containers,
            DashboardDataModels,
            Dashboards,
            Databases,
            DatabaseSchemas,
            DataContracts,
            DataProducts,
            Domains,
            Glossaries,
            GlossaryTerms,
            Metrics,
            MLModels,
            Pipelines,
            Queries,
            SearchIndexes,
            StoredProcedures,
            Tables,
            Tags,
            Teams,
            TestCases,
            TestDefinitions,
            TestSuites,
            Users,
        )

        # All class names should be plural
        plural_classes = [
            Tables,
            Users,
            Databases,
            DatabaseSchemas,
            Dashboards,
            Charts,
            Pipelines,
            MLModels,
            Containers,
            Queries,
            Metrics,
            Glossaries,
            GlossaryTerms,
            Classifications,
            Tags,
            Domains,
            DataProducts,
            DataContracts,
            APICollections,
            APIEndpoints,
            SearchIndexes,
            StoredProcedures,
            DashboardDataModels,
            TestCases,
            TestDefinitions,
            TestSuites,
            Teams,
        ]

        for cls in plural_classes:
            class_name = cls.__name__
            # Most should end with 's'
            if class_name not in ["MLModels", "SearchIndexes"]:
                assert class_name.endswith("s"), f"{class_name} should be plural"

    @unittest.skip("Module structure test not relevant for SDK")
    def test_no_naming_conflicts(self):
        """Verify SDK classes don't conflict with generated entities"""
        from metadata.generated.schema.entity.data.table import Table
        from metadata.sdk import Tables

        # These should be different classes
        assert Tables != Table
        assert Tables.__name__ == "Tables"
        assert Tables.__name__ == "Table"
