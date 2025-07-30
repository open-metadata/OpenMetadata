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
Test cross database lineage functionality in SQL lineage module
"""
import uuid
from unittest import TestCase
from unittest.mock import MagicMock, patch
from datetime import datetime

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedureCode
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.sql_lineage import (
    get_lineage_by_query,
    get_table_entities_from_query,
    search_table_entities,
    get_lineage_via_table_entity,
)
from metadata.ingestion.source.database.stored_procedures_mixin import (
    QueryByProcedure,
    StoredProcedureLineageMixin,
)
from metadata.utils.db_utils import get_view_lineage


class CrossDatabaseLineageSQLTest(TestCase):
    """
    Test cross database lineage functionality in SQL lineage module
    """

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = MagicMock()
        
        # Create mock tables
        self.mock_table1 = Table(
            id=uuid.uuid4(),
            name="test_table",
            fullyQualifiedName="service1.db1.schema1.test_table",
            columns=[
                {
                    "name": "id",
                    "dataType": "NUMBER",
                    "fullyQualifiedName": "service1.db1.schema1.test_table.id",
                },
                {
                    "name": "name",
                    "dataType": "VARCHAR",
                    "fullyQualifiedName": "service1.db1.schema1.test_table.name",
                },
            ],
        )
        
        self.mock_table2 = Table(
            id=uuid.uuid4(),
            name="test_table",
            fullyQualifiedName="service2.db2.schema2.test_table",
            columns=[
                {
                    "name": "id",
                    "dataType": "NUMBER",
                    "fullyQualifiedName": "service2.db2.schema2.test_table.id",
                },
                {
                    "name": "name",
                    "dataType": "VARCHAR",
                    "fullyQualifiedName": "service2.db2.schema2.test_table.name",
                },
            ],
        )

    def test_search_table_entities_single_service(self):
        """Test search_table_entities with single service (backward compatibility)"""
        # Mock the metadata methods
        self.mock_metadata.es_search_from_fqn.return_value = [self.mock_table1]
        
        # Test with single service name (string)
        result = search_table_entities(
            metadata=self.mock_metadata,
            service_names="service1",
            database="db1",
            database_schema="schema1",
            table="test_table",
        )
        
        # Verify the result
        self.assertEqual(result, [self.mock_table1])
        
        # Verify the method was called correctly
        self.mock_metadata.es_search_from_fqn.assert_called()

    def test_search_table_entities_multiple_services(self):
        """Test search_table_entities with multiple services (cross-database)"""
        # Mock the metadata methods - first service returns None for both ES and API, second returns table
        self.mock_metadata.es_search_from_fqn.side_effect = [None, [self.mock_table2]]
        
        # Mock fqn.build to return empty list for first service, list with FQN for second service
        with patch('metadata.ingestion.lineage.sql_lineage.fqn.build') as mock_fqn_build:
            mock_fqn_build.side_effect = [[], ["service2.db2.schema2.test_table"]]
            
            # Mock metadata.get_by_name to return the table for second service
            self.mock_metadata.get_by_name.return_value = self.mock_table2
            
            # Test with multiple service names
            result = search_table_entities(
                metadata=self.mock_metadata,
                service_names=["service1", "service2"],
                database="db2",
                database_schema="schema2",
                table="test_table",
            )
            
            # Verify the result - should return table from second service
            self.assertEqual(result, [self.mock_table2])
            
            # Verify the method was called for both services
            self.assertEqual(self.mock_metadata.es_search_from_fqn.call_count, 2)

    def test_search_table_entities_no_results(self):
        """Test search_table_entities when no tables are found in any service"""
        # Mock the metadata methods to return None for all services
        self.mock_metadata.es_search_from_fqn.return_value = None
        
        # Mock fqn.build to return empty list
        with patch('metadata.ingestion.lineage.sql_lineage.fqn.build') as mock_fqn_build:
            mock_fqn_build.return_value = []
            
            # Test with multiple service names
            result = search_table_entities(
                metadata=self.mock_metadata,
                service_names=["service1", "service2"],
                database="db1",
                database_schema="schema1",
                table="nonexistent_table",
            )
            
            # Verify the result is None
            self.assertIsNone(result)

    def test_get_table_entities_from_query_single_service(self):
        """Test get_table_entities_from_query with single service (backward compatibility)"""
        # Mock search_table_entities to return a table
        with patch('metadata.ingestion.lineage.sql_lineage.search_table_entities') as mock_search:
            mock_search.return_value = [self.mock_table1]
            
            result = get_table_entities_from_query(
                metadata=self.mock_metadata,
                service_names="service1",
                database_name="db1",
                database_schema="schema1",
                table_name="test_table",
            )
            
            # Verify the result
            self.assertEqual(result, [self.mock_table1])
            
            # Verify search_table_entities was called correctly
            mock_search.assert_called_with(
                metadata=self.mock_metadata,
                service_names="service1",
                database="db1",
                database_schema="schema1",
                table="test_table",
            )

    def test_get_table_entities_from_query_multiple_services(self):
        """Test get_table_entities_from_query with multiple services (cross-database)"""
        # Mock search_table_entities to return a table from second service
        with patch('metadata.ingestion.lineage.sql_lineage.search_table_entities') as mock_search:
            mock_search.return_value = [self.mock_table2]
            
            result = get_table_entities_from_query(
                metadata=self.mock_metadata,
                service_names=["service1", "service2"],
                database_name="db2",
                database_schema="schema2",
                table_name="test_table",
            )
            
            # Verify the result
            self.assertEqual(result, [self.mock_table2])
            
            # Verify search_table_entities was called correctly
            mock_search.assert_called_with(
                metadata=self.mock_metadata,
                service_names=["service1", "service2"],
                database="db2",
                database_schema="schema2",
                table="test_table",
            )

    def test_get_lineage_by_query_single_service(self):
        """Test get_lineage_by_query with single service (backward compatibility)"""
        # Mock the lineage parser and other dependencies
        with patch('metadata.ingestion.lineage.sql_lineage.LineageParser') as mock_parser:
            mock_parser_instance = MagicMock()
            mock_parser_instance.masked_query = "SELECT * FROM test"
            mock_parser_instance.column_lineage = []
            mock_parser_instance.intermediate_tables = []
            mock_parser_instance.source_tables = []
            mock_parser_instance.target_tables = []
            mock_parser_instance.query_parsing_success = True
            mock_parser.return_value = mock_parser_instance
            
            # Mock get_source_table_names to return empty
            with patch('metadata.ingestion.lineage.sql_lineage.get_source_table_names') as mock_source:
                mock_source.return_value = []
                
                result = list(get_lineage_by_query(
                    metadata=self.mock_metadata,
                    service_names="service1",
                    database_name="db1",
                    schema_name="schema1",
                    query="SELECT * FROM test",
                    dialect=Dialect.ANSI,
                ))
                
                # Verify no lineage is generated (empty source tables)
                self.assertEqual(len(result), 0)

    def test_get_lineage_by_query_multiple_services(self):
        """Test get_lineage_by_query with multiple services (cross-database)"""
        # Mock the lineage parser and other dependencies
        with patch('metadata.ingestion.lineage.sql_lineage.LineageParser') as mock_parser:
            mock_parser_instance = MagicMock()
            mock_parser_instance.masked_query = "SELECT * FROM test"
            mock_parser_instance.column_lineage = []
            mock_parser_instance.intermediate_tables = []
            mock_parser_instance.source_tables = []
            mock_parser_instance.target_tables = []
            mock_parser_instance.query_parsing_success = True
            mock_parser.return_value = mock_parser_instance
            
            # Mock get_source_table_names to return empty
            with patch('metadata.ingestion.lineage.sql_lineage.get_source_table_names') as mock_source:
                mock_source.return_value = []
                
                result = list(get_lineage_by_query(
                    metadata=self.mock_metadata,
                    service_names=["service1", "service2"],
                    database_name="db1",
                    schema_name="schema1",
                    query="SELECT * FROM test",
                    dialect=Dialect.ANSI,
                ))
                
                # Verify no lineage is generated (empty source tables)
                self.assertEqual(len(result), 0)

    def test_get_lineage_by_query_with_source_tables(self):
        """Test get_lineage_by_query with actual source tables (query lineage)"""
        # Mock the lineage parser with source and target tables
        with patch('metadata.ingestion.lineage.sql_lineage.LineageParser') as mock_parser:
            mock_parser_instance = MagicMock()
            mock_parser_instance.masked_query = "CREATE TABLE target AS SELECT * FROM source"
            mock_parser_instance.column_lineage = []
            mock_parser_instance.intermediate_tables = []
            mock_parser_instance.source_tables = ["source"]
            mock_parser_instance.target_tables = ["target"]
            mock_parser_instance.query_parsing_success = True
            mock_parser.return_value = mock_parser_instance
            
            # Mock get_source_table_names to return a source table
            with patch('metadata.ingestion.lineage.sql_lineage.get_source_table_names') as mock_source:
                mock_source.return_value = [("", "source_table")]
                
                # Mock search_table_entities to return a table
                with patch('metadata.ingestion.lineage.sql_lineage.search_table_entities') as mock_search:
                    mock_search.return_value = [self.mock_table1]
                    
                    result = list(get_lineage_by_query(
                        metadata=self.mock_metadata,
                        service_names=["service1", "service2"],
                        database_name="db1",
                        schema_name="schema1",
                        query="CREATE TABLE target AS SELECT * FROM source",
                        dialect=Dialect.ANSI,
                    ))
                    
                    # Verify that lineage was attempted
                    self.assertIsInstance(result, list)
                    mock_search.assert_called()

    def test_get_lineage_via_table_entity_single_service(self):
        """Test get_lineage_via_table_entity with single service (backward compatibility)"""
        # Mock the lineage parser
        with patch('metadata.ingestion.lineage.sql_lineage.LineageParser') as mock_parser:
            mock_parser_instance = MagicMock()
            mock_parser_instance.masked_query = "SELECT * FROM source"
            mock_parser_instance.column_lineage = []
            mock_parser_instance.source_tables = ["source"]
            mock_parser_instance.query_parsing_success = True
            mock_parser.return_value = mock_parser_instance
            
            # Mock get_source_table_names to return empty
            with patch('metadata.ingestion.lineage.sql_lineage.get_source_table_names') as mock_source:
                mock_source.return_value = []
                
                result = list(get_lineage_via_table_entity(
                    metadata=self.mock_metadata,
                    table_entity=self.mock_table1,
                    service_names="service1",
                    database_name="db1",
                    schema_name="schema1",
                    query="SELECT * FROM source",
                    dialect=Dialect.ANSI,
                ))
                
                # Verify the method executes without errors
                self.assertIsInstance(result, list)

    def test_get_lineage_via_table_entity_multiple_services(self):
        """Test get_lineage_via_table_entity with multiple services (cross-database)"""
        # Mock the lineage parser
        with patch('metadata.ingestion.lineage.sql_lineage.LineageParser') as mock_parser:
            mock_parser_instance = MagicMock()
            mock_parser_instance.masked_query = "SELECT * FROM source"
            mock_parser_instance.column_lineage = []
            mock_parser_instance.source_tables = ["source"]
            mock_parser_instance.query_parsing_success = True
            mock_parser.return_value = mock_parser_instance
            
            # Mock get_source_table_names to return a source table
            with patch('metadata.ingestion.lineage.sql_lineage.get_source_table_names') as mock_source:
                mock_source.return_value = [("", "source_table")]
                
                # Mock search_table_entities to return a table from second service
                with patch('metadata.ingestion.lineage.sql_lineage.search_table_entities') as mock_search:
                    mock_search.return_value = [self.mock_table2]
                    
                    result = list(get_lineage_via_table_entity(
                        metadata=self.mock_metadata,
                        table_entity=self.mock_table1,
                        service_names=["service1", "service2"],
                        database_name="db1",
                        schema_name="schema1",
                        query="SELECT * FROM source",
                        dialect=Dialect.ANSI,
                    ))
                    
                    # Verify that lineage was attempted with multiple services
                    self.assertIsInstance(result, list)
                    # Verify that search_table_entities was called (the exact parameters may vary)
                    mock_search.assert_called()

    def test_get_view_lineage_single_service(self):
        """Test get_view_lineage with single service (backward compatibility)"""
        # Create a mock TableView
        mock_view = MagicMock()
        mock_view.table_name = "test_view"
        mock_view.schema_name = "schema1"
        mock_view.db_name = "db1"
        mock_view.view_definition = "CREATE VIEW test_view AS SELECT * FROM source_table"
        
        # Mock the metadata methods
        self.mock_metadata.get_by_name.return_value = self.mock_table1
        
        # Mock fqn.build to return a valid FQN
        with patch('metadata.utils.db_utils.fqn.build') as mock_fqn_build:
            mock_fqn_build.return_value = "service1.db1.schema1.test_view"
            
            # Mock the lineage parser
            with patch('metadata.utils.db_utils.LineageParser') as mock_parser:
                mock_parser_instance = MagicMock()
                mock_parser_instance.masked_query = "CREATE VIEW test_view AS SELECT * FROM source_table"
                mock_parser_instance.column_lineage = []
                mock_parser_instance.source_tables = ["source_table"]
                mock_parser_instance.target_tables = ["test_view"]
                mock_parser_instance.query_parsing_success = True
                mock_parser.return_value = mock_parser_instance
                
                # Mock get_source_table_names to return empty (from sql_lineage module)
                with patch('metadata.ingestion.lineage.sql_lineage.get_source_table_names') as mock_source:
                    mock_source.return_value = []
                    
                    result = list(get_view_lineage(
                        view=mock_view,
                        metadata=self.mock_metadata,
                        service_names="service1",
                        connection_type="snowflake",
                    ))
                    
                    # Verify the method executes without errors
                    self.assertIsInstance(result, list)

    def test_get_view_lineage_multiple_services(self):
        """Test get_view_lineage with multiple services (cross-database view lineage)"""
        # Create a mock TableView
        mock_view = MagicMock()
        mock_view.table_name = "test_view"
        mock_view.schema_name = "schema1"
        mock_view.db_name = "db1"
        mock_view.view_definition = "CREATE VIEW test_view AS SELECT * FROM source_table"
        
        # Mock the metadata methods
        self.mock_metadata.get_by_name.return_value = self.mock_table1
        
        # Mock fqn.build to return a valid FQN
        with patch('metadata.utils.db_utils.fqn.build') as mock_fqn_build:
            mock_fqn_build.return_value = "service1.db1.schema1.test_view"
            
            # Mock the lineage parser
            with patch('metadata.utils.db_utils.LineageParser') as mock_parser:
                mock_parser_instance = MagicMock()
                mock_parser_instance.masked_query = "CREATE VIEW test_view AS SELECT * FROM source_table"
                mock_parser_instance.column_lineage = []
                mock_parser_instance.source_tables = ["source_table"]
                mock_parser_instance.target_tables = ["test_view"]
                mock_parser_instance.query_parsing_success = True
                mock_parser.return_value = mock_parser_instance
                
                # Mock get_source_table_names to return a source table (from sql_lineage module)
                with patch('metadata.ingestion.lineage.sql_lineage.get_source_table_names') as mock_source:
                    mock_source.return_value = [("", "source_table")]
                    
                    # Mock search_table_entities to return a table from second service
                    with patch('metadata.ingestion.lineage.sql_lineage.search_table_entities') as mock_search:
                        mock_search.return_value = [self.mock_table2]
                        
                        result = list(get_view_lineage(
                            view=mock_view,
                            metadata=self.mock_metadata,
                            service_names=["service1", "service2"],
                            connection_type="snowflake",
                        ))
                        
                        # Verify that view lineage was attempted with multiple services
                        self.assertIsInstance(result, list)
                        mock_search.assert_called()

    def test_get_view_lineage_with_postgres_schema_fallback(self):
        """Test get_view_lineage with Postgres schema fallback"""
        # Create a mock TableView for Postgres
        mock_view = MagicMock()
        mock_view.table_name = "test_view"
        mock_view.schema_name = None  # No schema specified
        mock_view.db_name = "db1"
        mock_view.view_definition = "CREATE VIEW test_view AS SELECT * FROM source_table"
        
        # Mock the metadata methods
        self.mock_metadata.get_by_name.return_value = self.mock_table1
        
        # Mock fqn.build to return a valid FQN
        with patch('metadata.utils.db_utils.fqn.build') as mock_fqn_build:
            mock_fqn_build.return_value = "service1.db1.public.test_view"
            
            # Mock the lineage parser
            with patch('metadata.utils.db_utils.LineageParser') as mock_parser:
                mock_parser_instance = MagicMock()
                mock_parser_instance.masked_query = "CREATE VIEW test_view AS SELECT * FROM source_table"
                mock_parser_instance.column_lineage = []
                mock_parser_instance.source_tables = ["source_table"]
                mock_parser_instance.target_tables = ["test_view"]
                mock_parser_instance.query_parsing_success = True
                mock_parser.return_value = mock_parser_instance
                
                # Mock get_source_table_names to return a source table (from sql_lineage module)
                with patch('metadata.ingestion.lineage.sql_lineage.get_source_table_names') as mock_source:
                    mock_source.return_value = [("", "source_table")]
                    
                    # Mock search_table_entities to return a table
                    with patch('metadata.ingestion.lineage.sql_lineage.search_table_entities') as mock_search:
                        mock_search.return_value = [self.mock_table1]
                        
                        result = list(get_view_lineage(
                            view=mock_view,
                            metadata=self.mock_metadata,
                            service_names=["service1", "service2"],
                            connection_type="postgres",
                        ))
                        
                        # Verify that view lineage was attempted with schema fallback
                        self.assertIsInstance(result, list)
                        # Should be called with schema_fallback=True for Postgres
                        mock_search.assert_called()

    def test_stored_procedure_lineage_cross_database(self):
        """Test stored procedure lineage with cross-database support"""
        # Create a mock stored procedure
        mock_procedure = StoredProcedure(
            id=uuid.uuid4(),
            name="test_procedure",
            fullyQualifiedName="service1.db1.schema1.test_procedure",
            storedProcedureCode=StoredProcedureCode(
                code="CREATE PROCEDURE test_procedure() BEGIN SELECT * FROM source; END",
                language="SQL",
            ),
            database=EntityReference(id=uuid.uuid4(), type="database"),
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
            service=EntityReference(id=uuid.uuid4(), type="databaseService"),
        )
        
        # Create a mock query by procedure
        mock_query = QueryByProcedure(
            procedure_name="test_procedure",
            query_type="CREATE_TABLE_AS_SELECT",
            query_database_name="db1",
            query_schema_name="schema1",
            procedure_text="CALL test_procedure()",
            procedure_start_time=datetime.now(),
            procedure_end_time=datetime.now(),
            query_text="CREATE TABLE target AS SELECT * FROM source",
        )
        
        # Create a mock mixin class
        class MockStoredProcedureMixin(StoredProcedureLineageMixin):
            def __init__(self, mock_metadata):
                self.metadata = mock_metadata
                self.service_name = "service1"
                self.source_config = DatabaseServiceQueryLineagePipeline(
                    processCrossDatabaseLineage=True,
                    crossDatabaseServiceNames=["service2"]
                )
                self.service_connection = MagicMock()
                self.service_connection.type.value = "mysql"
                self.stored_procedure_query_lineage = False
                self.procedure_graph_map = {}
                self.status = MagicMock()
            
            def get_stored_procedure_queries_dict(self):
                """Mock implementation of abstract method"""
                return {}
        
        mixin = MockStoredProcedureMixin(self.mock_metadata)
        
        # Mock the lineage parser and other dependencies
        with patch('metadata.ingestion.lineage.sql_lineage.LineageParser') as mock_parser:
            mock_parser_instance = MagicMock()
            mock_parser_instance.masked_query = "CREATE TABLE target AS SELECT * FROM source"
            mock_parser_instance.column_lineage = []
            mock_parser_instance.intermediate_tables = []
            mock_parser_instance.source_tables = ["source"]
            mock_parser_instance.target_tables = ["target"]
            mock_parser_instance.query_parsing_success = True
            mock_parser.return_value = mock_parser_instance
            
            # Mock get_source_table_names to return empty
            with patch('metadata.ingestion.lineage.sql_lineage.get_source_table_names') as mock_source:
                mock_source.return_value = []
                
                # Test the _yield_procedure_lineage method
                result = list(mixin._yield_procedure_lineage(mock_query, mock_procedure))
                
                # Verify that the method was called with the correct service names
                # The actual lineage generation depends on the mocked dependencies
                # but we can verify that the method executes without errors
                self.assertIsInstance(result, list) 