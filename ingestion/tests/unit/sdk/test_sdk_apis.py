"""
Unit tests for SDK API operations (Search, Lineage)
"""
import asyncio
import unittest
from unittest.mock import MagicMock

from metadata.sdk.api import Lineage, Search


class TestSDKAPIs(unittest.TestCase):
    """Test SDK API operations"""

    def setUp(self):
        """Set up test fixtures"""
        # Create mock OMeta instance
        self.mock_ometa = MagicMock()

        # Set default clients for API classes
        Search.set_default_client(self.mock_ometa)
        Lineage.set_default_client(self.mock_ometa)

    def test_search_basic(self):
        """Test basic search"""
        mock_results = {"hits": {"total": {"value": 10}, "hits": []}}
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

        results = (
            Search.builder()
            .query("customer")
            .index("table_index")
            .size(50)
            .sort_field("name")
            .execute()
        )

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
        """Test deleting lineage builds an EntitiesEdge"""
        from metadata.generated.schema.type.entityLineage import EntitiesEdge

        Lineage.delete_lineage(
            from_entity="550e8400-e29b-41d4-a716-446655440000",
            from_entity_type="table",
            to_entity="550e8400-e29b-41d4-a716-446655440001",
            to_entity_type="dashboard",
        )

        self.mock_ometa.delete_lineage_edge.assert_called_once()
        edge = self.mock_ometa.delete_lineage_edge.call_args[0][0]
        self.assertIsInstance(edge, EntitiesEdge)
        self.assertEqual(edge.fromEntity.type, "table")
        self.assertEqual(edge.toEntity.type, "dashboard")

    def test_lineage_builder(self):
        """Test lineage builder pattern"""
        mock_lineage = MagicMock()
        self.mock_ometa.get_lineage_by_name.return_value = mock_lineage

        result = (
            Lineage.builder()
            .entity("service.database.schema.table")
            .upstream_depth(3)
            .downstream_depth(2)
            .execute()
        )

        self.assertEqual(result, mock_lineage)

    def test_search_async(self):
        """Test async search operations"""
        # Just verify async functions are callable without testing actual async behavior
        # Full async testing would require asyncio test framework
        self.mock_ometa.es_search_from_es.return_value = {"hits": []}
        self.mock_ometa.get_suggest_entities.return_value = []

        # Verify the methods exist and are callable
        self.assertTrue(asyncio.iscoroutinefunction(Search.search_async))
        self.assertTrue(asyncio.iscoroutinefunction(Search.suggest_async))

    def test_lineage_async(self):
        """Test async lineage operations"""
        # Just verify async functions are callable without testing actual async behavior
        self.mock_ometa.get_lineage_by_name.return_value = MagicMock()
        self.mock_ometa.add_lineage.return_value = {}

        # Verify the methods exist and are callable
        self.assertTrue(asyncio.iscoroutinefunction(Lineage.get_lineage_async))
        self.assertTrue(asyncio.iscoroutinefunction(Lineage.add_lineage_async))


if __name__ == "__main__":
    unittest.main()
