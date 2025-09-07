"""
Unit tests for SDK API operations (Search, Lineage, Bulk)
"""
import unittest
from unittest.mock import MagicMock, patch

from metadata.sdk import OpenMetadata, OpenMetadataConfig
from metadata.sdk.api import Bulk, Lineage, Search


class TestSDKAPIs(unittest.TestCase):
    """Test SDK API operations"""

    @patch("metadata.sdk.client.OMeta")
    def setUp(self, mock_ometa_class):
        """Set up test fixtures"""
        # Create mock OMeta instance
        self.mock_ometa = MagicMock()
        mock_ometa_class.return_value = self.mock_ometa
        
        self.config = OpenMetadataConfig(
            server_url="http://localhost:8585",
            jwt_token="test-token",
        )
        self.client = OpenMetadata(self.config)
        
        # Set default clients
        Search.set_default_client(self.client)
        Lineage.set_default_client(self.client)
        Bulk.set_default_client(self.client)

    def test_search_basic(self):
        """Test basic search"""
        mock_results = {
            "hits": {
                "total": {"value": 10},
                "hits": [{"_source": {"name": "test_table"}}],
            }
        }
        self.mock_ometa.es_search_from_es.return_value = mock_results
        
        results = Search.search("test query")
        
        self.assertEqual(results["hits"]["total"]["value"], 10)
        self.mock_ometa.es_search_from_es.assert_called_once()

    def test_search_with_params(self):
        """Test search with parameters"""
        mock_results = {"hits": {"hits": []}}
        self.mock_ometa.es_search_from_es.return_value = mock_results
        
        Search.search(
            query="test",
            index="table_index",
            from_=10,
            size=20,
            sort_field="name",
            sort_order="asc",
        )
        
        self.mock_ometa.es_search_from_es.assert_called_once()
        call_kwargs = self.mock_ometa.es_search_from_es.call_args[1]
        self.assertEqual(call_kwargs["query_string"], "test")

    def test_search_suggest(self):
        """Test search suggestions"""
        mock_suggestions = ["table1", "table2", "table3"]
        self.mock_ometa.get_suggest_entities.return_value = mock_suggestions
        
        results = Search.suggest("tab", size=5)
        
        self.assertEqual(results, mock_suggestions)
        self.mock_ometa.get_suggest_entities.assert_called_once_with(
            query_string="tab",
            field=None,
            size=5,
        )

    def test_search_builder(self):
        """Test search builder pattern"""
        mock_results = {"hits": {"hits": []}}
        self.mock_ometa.es_search_from_es.return_value = mock_results
        
        results = Search.builder() \
            .query("customer") \
            .index("table_index") \
            .size(50) \
            .sort_field("name") \
            .execute()
        
        self.mock_ometa.es_search_from_es.assert_called_once()

    def test_lineage_get(self):
        """Test getting lineage"""
        mock_lineage = MagicMock()
        self.mock_ometa.get_lineage_by_name.return_value = mock_lineage
        
        result = Lineage.get_lineage("service.database.schema.table", 2, 3)
        
        self.assertEqual(result, mock_lineage)
        self.mock_ometa.get_lineage_by_name.assert_called_once_with(
            entity="service.database.schema.table",
            up_depth=2,
            down_depth=3,
        )

    def test_lineage_add(self):
        """Test adding lineage"""
        mock_response = {"status": "success"}
        self.mock_ometa.add_lineage.return_value = mock_response
        
        result = Lineage.add_lineage(
            from_entity_id="550e8400-e29b-41d4-a716-446655440000",
            from_entity_type="table",
            to_entity_id="550e8400-e29b-41d4-a716-446655440001",
            to_entity_type="dashboard",
            description="Test lineage",
        )
        
        self.assertEqual(result["status"], "success")
        self.mock_ometa.add_lineage.assert_called_once()

    def test_lineage_delete(self):
        """Test deleting lineage"""
        Lineage.delete_lineage(
            from_entity="entity1",
            from_entity_type="table",
            to_entity="entity2",
            to_entity_type="dashboard",
        )
        
        self.mock_ometa.delete_lineage_edge.assert_called_once_with(
            from_entity="entity1",
            from_entity_type="table",
            to_entity="entity2",
            to_entity_type="dashboard",
        )

    def test_lineage_builder(self):
        """Test lineage builder pattern"""
        mock_lineage = MagicMock()
        self.mock_ometa.get_lineage_by_name.return_value = mock_lineage
        
        result = Lineage.builder() \
            .entity("service.database.schema.table") \
            .upstream_depth(3) \
            .downstream_depth(2) \
            .execute()
        
        self.assertEqual(result, mock_lineage)

    def test_bulk_import_csv(self):
        """Test bulk CSV import"""
        mock_response = {"imported": 10}
        self.mock_ometa.import_csv.return_value = mock_response
        
        csv_data = "name,description\ntable1,desc1\ntable2,desc2"
        result = Bulk.import_csv("table", csv_data, dry_run=True)
        
        self.assertEqual(result["imported"], 10)
        self.mock_ometa.import_csv.assert_called_once_with(
            entity_type="table",
            csv_data=csv_data,
            dry_run=True,
        )

    def test_bulk_export_csv(self):
        """Test bulk CSV export"""
        mock_csv = "name,description\ntable1,desc1"
        self.mock_ometa.export_csv.return_value = mock_csv
        
        result = Bulk.export_csv("table", "test_export")
        
        self.assertEqual(result, mock_csv)
        self.mock_ometa.export_csv.assert_called_once_with(
            entity_type="table",
            name="test_export",
        )

    def test_bulk_delete(self):
        """Test bulk delete"""
        ids = ["id1", "id2", "id3"]
        
        # Mock successful deletes
        self.mock_ometa.delete.return_value = None
        
        result = Bulk.delete("table", ids, hard_delete=True)
        
        self.assertEqual(result, ids)
        self.assertEqual(self.mock_ometa.delete.call_count, 3)

    def test_bulk_builder(self):
        """Test bulk builder pattern"""
        mock_csv = "exported data"
        self.mock_ometa.export_csv.return_value = mock_csv
        
        result = Bulk.builder() \
            .entity_type("table") \
            .for_export() \
            .name("export_name") \
            .execute()
        
        self.assertEqual(result, mock_csv)

    def test_search_async(self):
        """Test async search operations"""
        # Just verify async functions are callable without testing actual async behavior
        # Full async testing would require asyncio test framework
        import asyncio
        
        self.mock_ometa.es_search_from_es.return_value = {"hits": []}
        self.mock_ometa.get_suggest_entities.return_value = []
        
        # Verify the methods exist and are callable
        self.assertTrue(asyncio.iscoroutinefunction(Search.search_async))
        self.assertTrue(asyncio.iscoroutinefunction(Search.suggest_async))

    def test_lineage_async(self):
        """Test async lineage operations"""
        # Just verify async functions are callable without testing actual async behavior
        import asyncio
        
        self.mock_ometa.get_lineage_by_name.return_value = MagicMock()
        self.mock_ometa.add_lineage.return_value = {}
        
        # Verify the methods exist and are callable
        self.assertTrue(asyncio.iscoroutinefunction(Lineage.get_lineage_async))
        self.assertTrue(asyncio.iscoroutinefunction(Lineage.add_lineage_async))

    def test_bulk_async(self):
        """Test async bulk operations"""
        # Just verify async functions are callable without testing actual async behavior
        import asyncio
        
        self.mock_ometa.import_csv.return_value = {}
        self.mock_ometa.export_csv.return_value = ""
        
        # Verify the methods exist and are callable
        self.assertTrue(asyncio.iscoroutinefunction(Bulk.import_csv_async))
        self.assertTrue(asyncio.iscoroutinefunction(Bulk.export_csv_async))


if __name__ == "__main__":
    unittest.main()