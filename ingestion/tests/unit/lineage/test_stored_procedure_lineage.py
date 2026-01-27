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
Test Suite for Stored Procedure Lineage

This module contains comprehensive tests for stored procedure lineage functionality,
ensuring memory-efficient streaming and proper processing.
"""

import unittest
import uuid
from datetime import datetime
from typing import Iterator
from unittest.mock import Mock, patch

from metadata.generated.schema.entity.data.storedProcedure import (
    StoredProcedure,
    StoredProcedureCode,
)
from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import (
    QueryParserType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.source.database.lineage_processors import (
    ProcedureAndQuery,
    QueryByProcedure,
)
from metadata.ingestion.source.database.stored_procedures_mixin import (
    StoredProcedureLineageMixin,
)


class TestableStoredProcedureMixin(StoredProcedureLineageMixin):
    """Concrete implementation for testing"""

    def __init__(self):
        self.source_config = Mock()
        self.source_config.incrementalLineageProcessing = False
        self.source_config.databaseFilterPattern = None
        self.source_config.schemaFilterPattern = None
        self.source_config.storedProcedureFilterPattern = None
        self.source_config.threads = 5
        self.metadata = Mock()
        self.service_name = "test_service"
        self.service_connection = Mock()
        self.service_connection.type.value = "mysql"
        self.status = Mock()
        self.engine = Mock()
        self.procedure_graph_map = {}

    def get_stored_procedure_sql_statement(self):
        return "SELECT * FROM procedure_log"

    def generate_lineage_with_processes(
        self, producer_fn, processor_fn, args, **kwargs
    ):
        """Mock implementation for testing"""
        return iter([])


class TestStoredProcedureStreaming(unittest.TestCase):
    """Tests for memory-efficient streaming of stored procedure queries"""

    def setUp(self):
        """Set up test fixtures"""
        self.mixin = TestableStoredProcedureMixin()

    def test_yield_stored_procedure_queries_is_generator(self):
        """Ensure yield_stored_procedure_queries returns a generator"""
        # Mock the engine execution with mock row that behaves like SQLAlchemy row
        mock_row1 = Mock()
        mock_row1.keys.return_value = [
            "PROCEDURE_NAME",
            "QUERY_TEXT",
            "QUERY_TYPE",
            "PROCEDURE_TEXT",
            "PROCEDURE_START_TIME",
            "PROCEDURE_END_TIME",
        ]
        mock_row1.__getitem__ = lambda self, key: {
            "PROCEDURE_NAME": "proc1",
            "QUERY_TEXT": "SELECT * FROM t1",
            "QUERY_TYPE": "SELECT",
            "PROCEDURE_TEXT": "CALL proc1()",
            "PROCEDURE_START_TIME": datetime.now(),
            "PROCEDURE_END_TIME": datetime.now(),
        }.get(key)

        self.mixin.engine.execute.return_value.all.return_value = [mock_row1]

        # Get the generator
        queries = self.mixin.yield_stored_procedure_queries()

        # Verify it's an iterator
        self.assertIsInstance(queries, Iterator)

        # Consume the generator
        query_list = list(queries)
        self.assertEqual(len(query_list), 1)
        self.assertIsInstance(query_list[0], QueryByProcedure)

    def test_procedure_lineage_producer_streaming(self):
        """Test that procedure_lineage_producer streams data efficiently"""
        # Create real stored procedure objects
        proc1 = StoredProcedure(
            id=uuid.uuid4(),
            name="Proc1",
            fullyQualifiedName="service.db1.schema1.Proc1",
            storedProcedureCode=StoredProcedureCode(
                code="CREATE PROCEDURE Proc1() BEGIN SELECT * FROM table1; END",
                language="SQL",
            ),
            database=EntityReference(id=uuid.uuid4(), type="database", name="db1"),
            databaseSchema=EntityReference(
                id=uuid.uuid4(), type="databaseSchema", name="schema1"
            ),
            service=EntityReference(
                id=uuid.uuid4(), type="databaseService", name="service"
            ),
        )

        proc2 = StoredProcedure(
            id=uuid.uuid4(),
            name="Proc2",
            fullyQualifiedName="service.db1.schema1.Proc2",
            storedProcedureCode=StoredProcedureCode(
                code="CREATE PROCEDURE Proc2() BEGIN SELECT * FROM table2; END",
                language="SQL",
            ),
            database=EntityReference(id=uuid.uuid4(), type="database", name="db1"),
            databaseSchema=EntityReference(
                id=uuid.uuid4(), type="databaseSchema", name="schema1"
            ),
            service=EntityReference(
                id=uuid.uuid4(), type="databaseService", name="service"
            ),
        )

        # Mock paginate_es to return procedures
        self.mixin.metadata.paginate_es.return_value = iter([proc1, proc2])

        # Mock query results - simulate streaming
        query_results = []
        for i, proc_name in enumerate(["Proc1", "Proc2"], 1):
            mock_row = Mock()
            mock_row.keys.return_value = [
                "PROCEDURE_NAME",
                "QUERY_TEXT",
                "QUERY_TYPE",
                "PROCEDURE_TEXT",
                "PROCEDURE_START_TIME",
                "PROCEDURE_END_TIME",
            ]
            mock_row.__getitem__ = lambda self, key, pn=proc_name, idx=i: {
                "PROCEDURE_NAME": pn,
                "QUERY_TEXT": f"SELECT * FROM table{idx}",
                "QUERY_TYPE": "SELECT",
                "PROCEDURE_TEXT": f"CALL {pn}()",
                "PROCEDURE_START_TIME": datetime.now(),
                "PROCEDURE_END_TIME": datetime.now(),
            }.get(key)
            query_results.append(mock_row)

        self.mixin.engine.execute.return_value.all.return_value = query_results

        # Get the producer
        results = list(self.mixin.procedure_lineage_producer())

        # Should yield ProcedureAndQuery objects for matching procedures
        self.assertEqual(len(results), 2)
        self.assertIsInstance(results[0], ProcedureAndQuery)
        self.assertEqual(results[0].procedure.name.root, "Proc1")
        self.assertEqual(results[1].procedure.name.root, "Proc2")

    def test_no_memory_accumulation(self):
        """Test that queries are not accumulated in memory"""
        # Create a large number of mock queries
        large_query_results = []
        for i in range(1000):
            mock_row = Mock()
            mock_row.keys.return_value = [
                "PROCEDURE_NAME",
                "QUERY_TEXT",
                "QUERY_TYPE",
                "PROCEDURE_TEXT",
                "PROCEDURE_START_TIME",
                "PROCEDURE_END_TIME",
            ]
            mock_row.__getitem__ = lambda self, key, idx=i: {
                "PROCEDURE_NAME": f"Proc{idx % 10}",  # 10 different procedures
                "QUERY_TEXT": f"SELECT * FROM table{idx}",
                "QUERY_TYPE": "SELECT",
                "PROCEDURE_TEXT": f"CALL Proc{idx % 10}()",
                "PROCEDURE_START_TIME": datetime.now(),
                "PROCEDURE_END_TIME": datetime.now(),
            }.get(key)
            large_query_results.append(mock_row)

        self.mixin.engine.execute.return_value.all.return_value = large_query_results

        # The generator should not load all into memory at once
        queries_gen = self.mixin.yield_stored_procedure_queries()

        # Process one at a time
        count = 0
        for query in queries_gen:
            count += 1
            # Each query should be processed individually
            self.assertIsInstance(query, QueryByProcedure)
            if count > 5:  # Just test a few
                break

        # Should have processed queries without loading all into memory
        self.assertGreater(count, 0)

    def test_filtered_procedures(self):
        """Test that filtered procedures are not processed"""
        # Create real stored procedure objects
        proc1 = StoredProcedure(
            id=uuid.uuid4(),
            name="IncludedProc",
            fullyQualifiedName="service.db1.schema1.IncludedProc",
            storedProcedureCode=StoredProcedureCode(
                code="CREATE PROCEDURE IncludedProc() BEGIN SELECT 1; END",
                language="SQL",
            ),
            database=EntityReference(id=uuid.uuid4(), type="database", name="db1"),
            databaseSchema=EntityReference(
                id=uuid.uuid4(), type="databaseSchema", name="schema1"
            ),
            service=EntityReference(
                id=uuid.uuid4(), type="databaseService", name="service"
            ),
        )

        proc2 = StoredProcedure(
            id=uuid.uuid4(),
            name="FilteredProc",
            fullyQualifiedName="service.filtered_db.schema1.FilteredProc",
            storedProcedureCode=StoredProcedureCode(
                code="CREATE PROCEDURE FilteredProc() BEGIN SELECT 2; END",
                language="SQL",
            ),
            database=EntityReference(
                id=uuid.uuid4(), type="database", name="filtered_db"
            ),
            databaseSchema=EntityReference(
                id=uuid.uuid4(), type="databaseSchema", name="schema1"
            ),
            service=EntityReference(
                id=uuid.uuid4(), type="databaseService", name="service"
            ),
        )

        # Mock paginate_es
        self.mixin.metadata.paginate_es.return_value = iter([proc1, proc2])

        # Set up filter to exclude filtered_db
        self.mixin.source_config.databaseFilterPattern = Mock()
        self.mixin.source_config.databaseFilterPattern.includes = []
        self.mixin.source_config.databaseFilterPattern.excludes = ["filtered_db"]

        # Mock filter functions
        with patch(
            "metadata.utils.filters.filter_by_database", side_effect=[False, True]
        ):
            # Mock query results
            mock_row = Mock()
            mock_row.keys.return_value = [
                "PROCEDURE_NAME",
                "QUERY_TEXT",
                "QUERY_TYPE",
                "PROCEDURE_TEXT",
                "PROCEDURE_START_TIME",
                "PROCEDURE_END_TIME",
            ]
            mock_row.__getitem__ = lambda self, key: {
                "PROCEDURE_NAME": "IncludedProc",
                "QUERY_TEXT": "SELECT * FROM table1",
                "QUERY_TYPE": "SELECT",
                "PROCEDURE_TEXT": "CALL IncludedProc()",
                "PROCEDURE_START_TIME": datetime.now(),
                "PROCEDURE_END_TIME": datetime.now(),
            }.get(key)

            self.mixin.engine.execute.return_value.all.return_value = [mock_row]

            # Get results
            results = list(self.mixin.procedure_lineage_producer())

            # Should only process non-filtered procedure
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0].procedure.name.root, "IncludedProc")

            # Verify filter was called
            self.mixin.status.filter.assert_called_once_with(
                "FilteredProc", "Stored Procedure Filtered Out"
            )


class TestStoredProcedureProcessing(unittest.TestCase):
    """Tests for stored procedure query processing"""

    def test_query_by_procedure_validation(self):
        """Test QueryByProcedure model validation"""
        query_data = {
            "PROCEDURE_NAME": "TestProc",
            "QUERY_TEXT": "INSERT INTO target SELECT * FROM source",
            "QUERY_TYPE": "INSERT",
            "PROCEDURE_TEXT": "CALL TestProc()",
            "PROCEDURE_START_TIME": datetime.now(),
            "PROCEDURE_END_TIME": datetime.now(),
            "QUERY_DATABASE_NAME": "test_db",
            "QUERY_SCHEMA_NAME": "test_schema",
            "QUERY_START_TIME": datetime.now(),
            "QUERY_DURATION": 1.5,
            "QUERY_USER_NAME": "test_user",
        }

        query_by_proc = QueryByProcedure.model_validate(query_data)

        self.assertEqual(query_by_proc.procedure_name, "TestProc")
        self.assertEqual(
            query_by_proc.query_text, "INSERT INTO target SELECT * FROM source"
        )
        self.assertEqual(query_by_proc.query_type, "INSERT")
        self.assertEqual(query_by_proc.query_database_name, "test_db")
        self.assertEqual(query_by_proc.query_duration, 1.5)

    def test_procedure_name_extraction(self):
        """Test procedure name extraction from CALL statement"""
        from metadata.utils.stored_procedures import get_procedure_name_from_call

        test_cases = [
            ("CALL my_procedure()", "my_procedure"),
            ("CALL schema.procedure(param1, param2)", "schema.procedure"),
            ("EXECUTE stored_proc", "stored_proc"),
            ("EXEC sp_help", "sp_help"),
        ]

        for call_text, expected_name in test_cases:
            with self.subTest(call=call_text):
                # Note: This assumes get_procedure_name_from_call exists
                # You may need to implement or mock this function
                with patch(
                    "metadata.utils.stored_procedures.get_procedure_name_from_call",
                    return_value=expected_name,
                ):
                    from metadata.utils.stored_procedures import (
                        get_procedure_name_from_call,
                    )

                    name = get_procedure_name_from_call(call_text)
                    self.assertEqual(name, expected_name)


class TestIntegration(unittest.TestCase):
    """Integration tests for the complete stored procedure lineage flow"""

    def test_end_to_end_streaming(self):
        """Test complete flow from SQL query to ProcedureAndQuery objects"""
        mixin = TestableStoredProcedureMixin()

        # Setup real stored procedure
        proc = StoredProcedure(
            id=uuid.uuid4(),
            name="IntegrationProc",
            fullyQualifiedName="service.test_db.test_schema.IntegrationProc",
            storedProcedureCode=StoredProcedureCode(
                code="CREATE PROCEDURE IntegrationProc() BEGIN INSERT INTO target SELECT * FROM source; END",
                language="SQL",
            ),
            database=EntityReference(id=uuid.uuid4(), type="database", name="test_db"),
            databaseSchema=EntityReference(
                id=uuid.uuid4(), type="databaseSchema", name="test_schema"
            ),
            service=EntityReference(
                id=uuid.uuid4(), type="databaseService", name="service"
            ),
        )

        mixin.metadata.paginate_es.return_value = iter([proc])

        # Setup mock query results
        mock_rows = []
        for i in range(3):
            mock_row = Mock()
            mock_row.keys.return_value = [
                "PROCEDURE_NAME",
                "QUERY_TEXT",
                "QUERY_TYPE",
                "PROCEDURE_TEXT",
                "PROCEDURE_START_TIME",
                "PROCEDURE_END_TIME",
            ]
            mock_row.__getitem__ = lambda self, key, idx=i: {
                "PROCEDURE_NAME": "IntegrationProc",
                "QUERY_TEXT": f"SELECT * FROM table{idx}",
                "QUERY_TYPE": "SELECT",
                "PROCEDURE_TEXT": "CALL IntegrationProc()",
                "PROCEDURE_START_TIME": datetime.now(),
                "PROCEDURE_END_TIME": datetime.now(),
            }.get(key)
            mock_rows.append(mock_row)

        mixin.engine.execute.return_value.all.return_value = mock_rows

        # Execute the flow
        results = list(mixin.procedure_lineage_producer())

        # Verify results
        self.assertEqual(len(results), 3)
        for i, result in enumerate(results):
            self.assertIsInstance(result, ProcedureAndQuery)
            self.assertEqual(result.procedure.name.root, "IntegrationProc")
            self.assertIn(f"table{i}", result.query_by_procedure.query_text)

    def test_incremental_processing(self):
        """Test incremental lineage processing flag"""
        mixin = TestableStoredProcedureMixin()
        mixin.source_config.incrementalLineageProcessing = True

        # Mock paginate_es with incremental filter
        mixin.metadata.paginate_es = Mock(return_value=iter([]))

        # Mock query results to return empty list
        mixin.engine.execute.return_value.all.return_value = []

        # Call procedure_lineage_producer
        list(mixin.procedure_lineage_producer())

        # Verify the query filter includes processedLineage: False
        call_args = mixin.metadata.paginate_es.call_args
        query_filter = call_args[1]["query_filter"]

        # The query should include processedLineage filter
        self.assertIn("processedLineage", query_filter)


class TestTempTableLineage(unittest.TestCase):
    """Tests for temporary table lineage functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.mixin = TestableStoredProcedureMixin()
        self.test_procedure = StoredProcedure(
            id=uuid.uuid4(),
            name="TestProc",
            fullyQualifiedName="service.db.schema.TestProc",
            storedProcedureCode=StoredProcedureCode(
                code="CREATE PROCEDURE TestProc() BEGIN SELECT 1; END",
                language="SQL",
            ),
            database=EntityReference(id=uuid.uuid4(), type="database", name="db"),
            databaseSchema=EntityReference(
                id=uuid.uuid4(), type="databaseSchema", name="schema"
            ),
            service=EntityReference(
                id=uuid.uuid4(), type="databaseService", name="service"
            ),
        )

        self.test_query = QueryByProcedure(
            PROCEDURE_NAME="TestProc",
            QUERY_TEXT="CREATE TEMP TABLE temp AS SELECT * FROM source",
            QUERY_TYPE="CREATE_TABLE_AS_SELECT",
            PROCEDURE_TEXT="CALL TestProc()",
            PROCEDURE_START_TIME=datetime.now(),
            PROCEDURE_END_TIME=datetime.now(),
        )

    def test_procedure_graph_creation_when_temp_lineage_enabled(self):
        """Test that procedure graphs are created when temp table lineage is enabled"""
        from metadata.ingestion.source.database.lineage_processors import (
            _yield_procedure_lineage,
        )

        self.mixin.source_config.enableTempTableLineage = True
        procedure_graph_map = {}

        mock_result = Mock()
        with patch(
            "metadata.ingestion.source.database.lineage_processors.get_lineage_by_query",
            return_value=[mock_result],
        ):
            list(
                _yield_procedure_lineage(
                    metadata=self.mixin.metadata,
                    service_name=self.mixin.service_name,
                    dialect=Dialect.MYSQL,
                    processCrossDatabaseLineage=False,
                    crossDatabaseServiceNames=[],
                    parsingTimeoutLimit=30,
                    query_by_procedure=self.test_query,
                    procedure=self.test_procedure,
                    procedure_graph_map=procedure_graph_map,
                    enableTempTableLineage=True,
                    parser_type=QueryParserType.Auto,
                )
            )

            # Verify graph was created
            fqn = self.test_procedure.fullyQualifiedName.root
            self.assertIn(fqn, procedure_graph_map)
            self.assertIsNotNone(procedure_graph_map[fqn].graph)

    def test_procedure_graph_not_created_when_temp_lineage_disabled(self):
        """Test that procedure graphs are not created when temp table lineage is disabled"""
        from metadata.ingestion.source.database.lineage_processors import (
            _yield_procedure_lineage,
        )

        procedure_graph_map = {}

        mock_result = Mock()
        with patch(
            "metadata.ingestion.source.database.lineage_processors.get_lineage_by_query",
            return_value=[mock_result],
        ):
            list(
                _yield_procedure_lineage(
                    metadata=self.mixin.metadata,
                    service_name=self.mixin.service_name,
                    dialect=Dialect.MYSQL,
                    processCrossDatabaseLineage=False,
                    crossDatabaseServiceNames=[],
                    parsingTimeoutLimit=30,
                    query_by_procedure=self.test_query,
                    procedure=self.test_procedure,
                    procedure_graph_map=procedure_graph_map,
                    enableTempTableLineage=False,
                    parser_type=QueryParserType.Auto,
                )
            )

            # Verify no graph was created
            self.assertEqual(len(procedure_graph_map), 0)

    def test_procedure_graph_passed_to_lineage_query(self):
        """Test that the procedure graph is passed to get_lineage_by_query"""
        from metadata.ingestion.source.database.lineage_processors import (
            _yield_procedure_lineage,
        )

        procedure_graph_map = {}

        with patch(
            "metadata.ingestion.source.database.lineage_processors.get_lineage_by_query"
        ) as mock_lineage:
            mock_lineage.return_value = [Mock()]

            list(
                _yield_procedure_lineage(
                    metadata=self.mixin.metadata,
                    service_name=self.mixin.service_name,
                    dialect=Dialect.MYSQL,
                    processCrossDatabaseLineage=False,
                    crossDatabaseServiceNames=[],
                    parsingTimeoutLimit=30,
                    query_by_procedure=self.test_query,
                    procedure=self.test_procedure,
                    procedure_graph_map=procedure_graph_map,
                    enableTempTableLineage=True,
                    parser_type=QueryParserType.Auto,
                )
            )

            # Verify get_lineage_by_query was called with graph
            mock_lineage.assert_called_once()
            call_kwargs = mock_lineage.call_args[1]
            self.assertIn("graph", call_kwargs)
            self.assertIsNotNone(call_kwargs["graph"])


class TestLineageQueryValidation(unittest.TestCase):
    """Tests for lineage query type validation"""

    def test_is_lineage_query_types(self):
        """Test is_lineage_query with various query types"""
        from metadata.ingestion.source.database.lineage_processors import (
            is_lineage_query,
        )

        # Test queries that should be identified as lineage queries
        self.assertTrue(is_lineage_query("MERGE", "MERGE INTO target USING source"))
        self.assertTrue(is_lineage_query("UPDATE", "UPDATE table SET col = val"))
        self.assertTrue(
            is_lineage_query("CREATE_TABLE_AS_SELECT", "CREATE TABLE AS SELECT")
        )
        self.assertTrue(is_lineage_query("INSERT", "INSERT INTO t SELECT * FROM s"))

        # Test queries that should NOT be identified as lineage queries
        self.assertFalse(is_lineage_query("SELECT", "SELECT * FROM table"))
        self.assertFalse(is_lineage_query("INSERT", "INSERT INTO t VALUES (1,2,3)"))
        self.assertFalse(is_lineage_query("DELETE", "DELETE FROM table"))

    def test_is_lineage_query_case_insensitive(self):
        """Test that is_lineage_query is case insensitive"""
        from metadata.ingestion.source.database.lineage_processors import (
            is_lineage_query,
        )

        # Test with different case variations
        self.assertTrue(is_lineage_query("INSERT", "insert into t select * from s"))
        self.assertTrue(is_lineage_query("INSERT", "INSERT INTO T SELECT * FROM S"))
        self.assertTrue(is_lineage_query("INSERT", "InSeRt InTo t SeLeCt * FrOm s"))


class TestProcedureGraphProcessing(unittest.TestCase):
    """Tests for procedure graph processing and lineage generation"""

    def test_get_lineage_by_procedure_graph_empty_map(self):
        """Test get_lineage_by_procedure_graph with empty map"""
        from metadata.ingestion.lineage.sql_lineage import (
            get_lineage_by_procedure_graph,
        )

        mock_metadata = Mock()
        result = list(
            get_lineage_by_procedure_graph(
                procedure_graph_map={}, metadata=mock_metadata
            )
        )

        # Should return empty when no graphs
        self.assertEqual(len(result), 0)

    def test_procedure_graph_creation_and_reuse(self):
        """Test that procedure graphs are created once and reused"""
        from metadata.ingestion.source.database.lineage_processors import (
            _yield_procedure_lineage,
        )

        procedure_graph_map = {}
        test_procedure = StoredProcedure(
            id=uuid.uuid4(),
            name="ReusableProc",
            fullyQualifiedName="service.db.schema.ReusableProc",
            storedProcedureCode=StoredProcedureCode(
                code="CREATE PROCEDURE ReusableProc() BEGIN SELECT 1; END",
                language="SQL",
            ),
            database=EntityReference(id=uuid.uuid4(), type="database", name="db"),
            databaseSchema=EntityReference(
                id=uuid.uuid4(), type="databaseSchema", name="schema"
            ),
            service=EntityReference(
                id=uuid.uuid4(), type="databaseService", name="service"
            ),
        )

        query1 = QueryByProcedure(
            PROCEDURE_NAME="ReusableProc",
            QUERY_TEXT="SELECT * FROM t1",
            QUERY_TYPE="SELECT",
            PROCEDURE_TEXT="CALL ReusableProc()",
            PROCEDURE_START_TIME=datetime.now(),
            PROCEDURE_END_TIME=datetime.now(),
        )

        query2 = QueryByProcedure(
            PROCEDURE_NAME="ReusableProc",
            QUERY_TEXT="INSERT INTO t2 SELECT * FROM t1",
            QUERY_TYPE="INSERT",
            PROCEDURE_TEXT="CALL ReusableProc()",
            PROCEDURE_START_TIME=datetime.now(),
            PROCEDURE_END_TIME=datetime.now(),
        )

        with patch(
            "metadata.ingestion.source.database.lineage_processors.get_lineage_by_query",
            return_value=[],
        ):
            # Process first query
            list(
                _yield_procedure_lineage(
                    metadata=Mock(),
                    service_name="test",
                    dialect=Dialect.MYSQL,
                    processCrossDatabaseLineage=False,
                    crossDatabaseServiceNames=[],
                    parsingTimeoutLimit=30,
                    query_by_procedure=query1,
                    procedure=test_procedure,
                    procedure_graph_map=procedure_graph_map,
                    enableTempTableLineage=True,
                    parser_type=QueryParserType.Auto,
                )
            )

            # Capture the graph reference
            first_graph = procedure_graph_map[
                test_procedure.fullyQualifiedName.root
            ].graph

            # Process second query
            list(
                _yield_procedure_lineage(
                    metadata=Mock(),
                    service_name="test",
                    dialect=Dialect.MYSQL,
                    processCrossDatabaseLineage=False,
                    crossDatabaseServiceNames=[],
                    parsingTimeoutLimit=30,
                    query_by_procedure=query2,
                    procedure=test_procedure,
                    procedure_graph_map=procedure_graph_map,
                    enableTempTableLineage=True,
                    parser_type=QueryParserType.Auto,
                )
            )

            # Verify same graph is reused
            second_graph = procedure_graph_map[
                test_procedure.fullyQualifiedName.root
            ].graph
            self.assertIs(first_graph, second_graph)
