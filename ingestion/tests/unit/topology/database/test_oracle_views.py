import unittest
from unittest.mock import MagicMock, patch
from sqlalchemy import text
from metadata.ingestion.source.database.oracle.utils import (
    get_all_view_definitions,
    get_view_definition,
)
from metadata.ingestion.source.database.oracle.queries import (
    ORACLE_ALL_VIEW_DEFINITIONS,
    ORACLE_VIEW_DEFINITIONS_BY_SCHEMA,
)

class TestOracleViews(unittest.TestCase):

    def setUp(self):
        self.mock_connection = MagicMock()
        self.mock_connection.engine.url.database = "test_db"
        self.dialect_instance = MagicMock()
        # Mocking info_cache required by reflection.cache
        self.dialect_instance.info_cache = {} 
        
    def test_get_all_view_definitions_no_schema(self):
        # Mock result
        mock_result = [
            MagicMock(view_name="view1", schema="schema1", view_def="SELECT 1"),
        ]
        self.mock_connection.execute.return_value = mock_result
        
        # Bypass cache decorator for direct testing if possible, or just call it.
        # Since it's decorated, we might need to rely on its behavior.
        # But we can also check side effects on dialect_instance.
        
        get_all_view_definitions(self.dialect_instance, self.mock_connection, ORACLE_ALL_VIEW_DEFINITIONS)
        
        # Check that connection.execute was called with the correct query
        self.mock_connection.execute.assert_called_with(ORACLE_ALL_VIEW_DEFINITIONS)
        
        # Check that the results were stored in all_view_definitions
        self.assertEqual(self.dialect_instance.all_view_definitions[("view1", "schema1")], "SELECT 1")

    def test_get_all_view_definitions_with_schema(self):
        # Mock result
        mock_result = [
            MagicMock(view_name="view2", schema="schema2", view_def="SELECT 2"),
        ]
        self.mock_connection.execute.return_value = mock_result
        
        get_all_view_definitions(self.dialect_instance, self.mock_connection, ORACLE_VIEW_DEFINITIONS_BY_SCHEMA, schema="schema2")
        
        # Check if executed with params
        args, kwargs = self.mock_connection.execute.call_args
        self.assertEqual(str(args[0]), str(text(ORACLE_VIEW_DEFINITIONS_BY_SCHEMA)))
        self.assertEqual(args[1], {"owner": "schema2"})
        
        self.assertEqual(self.dialect_instance.all_view_definitions[("view2", "schema2")], "SELECT 2")

    def test_get_view_definition_uses_cache(self):
        self.dialect_instance.all_view_definitions = {("myview", "myschema"): "SELECT CACHED"}
        self.dialect_instance.current_db = "test_db"
        
        definition = get_view_definition(self.dialect_instance, self.mock_connection, "myview", schema="myschema")
        
        self.assertEqual(definition, "SELECT CACHED")
        self.mock_connection.execute.assert_not_called()

    def test_get_view_definition_fetches_all_if_no_schema(self):
        # Reset attributes to simulate fresh state
        if hasattr(self.dialect_instance, "all_view_definitions"):
             del self.dialect_instance.all_view_definitions
        
        # Mock that get_all_view_definitions populates the cache
        def side_effect(conn, query, schema=None):
            self.dialect_instance.all_view_definitions = {("view1", None): "DEF"}
        
        self.dialect_instance.get_all_view_definitions.side_effect = side_effect

        get_view_definition(self.dialect_instance, self.mock_connection, "view1")
        
        self.dialect_instance.get_all_view_definitions.assert_called_with(self.mock_connection, ORACLE_ALL_VIEW_DEFINITIONS)

    def test_get_view_definition_fetches_by_schema(self):
        # Reset attributes
        if hasattr(self.dialect_instance, "all_view_definitions"):
             del self.dialect_instance.all_view_definitions
             
        def side_effect(conn, query, schema=None):
            self.dialect_instance.all_view_definitions = {("view1", "myschema"): "DEF_SCHEMA"}
        
        self.dialect_instance.get_all_view_definitions.side_effect = side_effect

        get_view_definition(self.dialect_instance, self.mock_connection, "view1", schema="myschema")
        
        self.dialect_instance.get_all_view_definitions.assert_called_with(self.mock_connection, ORACLE_VIEW_DEFINITIONS_BY_SCHEMA, "myschema")
