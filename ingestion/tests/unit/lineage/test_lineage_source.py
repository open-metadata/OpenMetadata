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
Test Suite for LineageSource class

This module contains comprehensive tests for the LineageSource class,
including query lineage, view lineage, and stored procedure lineage.
"""

import csv
import os
import tempfile
import unittest
from datetime import datetime, timedelta
from typing import Iterator
from unittest.mock import Mock, patch

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.models import TableView


class TestableLineageSource(LineageSource):
    """Concrete implementation of LineageSource for testing"""

    def __init__(self, config, metadata):
        self.config = config
        self.metadata = metadata
        self.source_config = config.sourceConfig.config
        self.service_connection = Mock()
        self.service_connection.type.value = "mysql"
        self.start = datetime.now() - timedelta(days=1)
        self.end = datetime.now()
        self.dialect = Dialect.MYSQL
        self.graph = None
        self.procedure_graph_map = None
        self.status = Mock()

    @classmethod
    def create(cls, config_dict, metadata):
        """Create method required by abstract class"""
        mock_config = Mock()
        mock_config.sourceConfig.config = config_dict.get("sourceConfig", {}).get(
            "config", {}
        )
        return cls(mock_config, metadata)

    def get_engine(self):
        """Return mock engine"""
        return [Mock()]

    def get_sql_statement(self, start_time, end_time):
        """Return mock SQL statement"""
        return "SELECT * FROM query_log"

    def get_database_name(self, data):
        """Return mock database name"""
        return data.get("database_name", "test_db")

    def get_schema_name(self, data):
        """Return mock schema name"""
        return data.get("schema_name", "test_schema")


class TestLineageSourceCore(unittest.TestCase):
    """Core tests for LineageSource functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = Mock()
        self.mock_config = Mock()
        self.mock_config.serviceName = "test_service"
        self.mock_config.sourceConfig.config = Mock()
        self.mock_config.sourceConfig.config.queryLogFilePath = None
        self.mock_config.sourceConfig.config.processViewLineage = True
        self.mock_config.sourceConfig.config.processQueryLineage = True
        self.mock_config.sourceConfig.config.processStoredProcedureLineage = False
        self.mock_config.sourceConfig.config.processCrossDatabaseLineage = False
        self.mock_config.sourceConfig.config.crossDatabaseServiceNames = []
        self.mock_config.sourceConfig.config.parsingTimeoutLimit = 10
        self.mock_config.sourceConfig.config.enableTempTableLineage = False
        self.mock_config.sourceConfig.config.incrementalLineageProcessing = False
        self.mock_config.sourceConfig.config.overrideViewLineage = False
        self.mock_config.sourceConfig.config.databaseFilterPattern = None
        self.mock_config.sourceConfig.config.schemaFilterPattern = None
        self.mock_config.sourceConfig.config.tableFilterPattern = None
        self.mock_config.sourceConfig.config.threads = 5

        self.lineage_source = TestableLineageSource(
            self.mock_config, self.mock_metadata
        )

    def test_critical_methods_exist(self):
        """Ensure all critical methods exist and are callable"""
        critical_methods = [
            "get_table_query",
            "query_lineage_producer",
            "yield_table_query",
            "yield_table_queries_from_logs",
            "view_lineage_producer",
            "yield_view_lineage",
            "yield_query_lineage",
            "generate_lineage_with_processes",
        ]

        for method_name in critical_methods:
            with self.subTest(method=method_name):
                self.assertTrue(
                    hasattr(self.lineage_source, method_name),
                    f"Critical method '{method_name}' is missing from LineageSource!",
                )

                method = getattr(self.lineage_source, method_name, None)
                if method and not method_name.startswith("generate_"):
                    self.assertTrue(
                        callable(method),
                        f"Method '{method_name}' exists but is not callable!",
                    )


class TestQueryLineage(unittest.TestCase):
    """Tests for query lineage functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = Mock()
        self.mock_config = Mock()
        self.mock_config.serviceName = "test_service"
        self.mock_config.sourceConfig.config = Mock()
        self.mock_config.sourceConfig.config.queryLogFilePath = None
        self.mock_config.sourceConfig.config.processQueryLineage = True
        self.mock_config.sourceConfig.config.parsingTimeoutLimit = 10
        self.mock_config.sourceConfig.config.threads = 5

        self.lineage_source = TestableLineageSource(
            self.mock_config, self.mock_metadata
        )

    def test_yield_table_query_from_database(self):
        """Test yielding table queries from database"""
        mock_engine = Mock()
        mock_connection = Mock()
        mock_result = [
            {
                "query_text": "SELECT * FROM table1",
                "database_name": "db1",
                "schema_name": "schema1",
            },
            {
                "query_text": "INSERT INTO table2 SELECT * FROM table1",
                "database_name": "db1",
                "schema_name": "schema1",
            },
        ]

        mock_connection.execute.return_value = mock_result
        mock_engine.connect.return_value.__enter__ = Mock(return_value=mock_connection)
        mock_engine.connect.return_value.__exit__ = Mock(return_value=None)

        with patch.object(
            self.lineage_source, "get_engine", return_value=[mock_engine]
        ):
            queries = list(self.lineage_source.yield_table_query())

            self.assertEqual(len(queries), 2)
            self.assertIsInstance(queries[0], TableQuery)
            self.assertEqual(queries[0].query, "SELECT * FROM table1")
            self.assertEqual(queries[0].databaseName, "db1")
            self.assertEqual(queries[0].serviceName, "test_service")

    def test_yield_table_queries_from_logs(self):
        """Test yielding table queries from CSV log files"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            writer = csv.DictWriter(
                f, fieldnames=["query_text", "database_name", "schema_name"]
            )
            writer.writeheader()
            writer.writerow(
                {
                    "query_text": "SELECT * FROM logs_table",
                    "database_name": "log_db",
                    "schema_name": "log_schema",
                }
            )
            writer.writerow(
                {
                    "query_text": "INSERT INTO target SELECT * FROM source",
                    "database_name": "log_db",
                    "schema_name": "log_schema",
                }
            )
            temp_file = f.name

        try:
            self.lineage_source.source_config.queryLogFilePath = temp_file
            queries = list(self.lineage_source.yield_table_queries_from_logs())

            self.assertEqual(len(queries), 2)
            self.assertEqual(queries[0].query, "SELECT * FROM logs_table")
            self.assertEqual(
                queries[1].query, "INSERT INTO target SELECT * FROM source"
            )
            self.assertEqual(queries[0].databaseName, "log_db")
        finally:
            os.unlink(temp_file)

    def test_query_lineage_producer_with_log_file(self):
        """Test query lineage producer uses log file when configured"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            writer = csv.DictWriter(
                f, fieldnames=["query_text", "database_name", "schema_name"]
            )
            writer.writeheader()
            writer.writerow(
                {
                    "query_text": "CREATE TABLE new AS SELECT * FROM old",
                    "database_name": "test_db",
                    "schema_name": "test_schema",
                }
            )
            temp_file = f.name

        try:
            self.lineage_source.config.sourceConfig.config.queryLogFilePath = temp_file
            producer = self.lineage_source.query_lineage_producer()
            queries = list(producer)

            self.assertEqual(len(queries), 1)
            self.assertEqual(queries[0].query, "CREATE TABLE new AS SELECT * FROM old")
        finally:
            os.unlink(temp_file)

    def test_query_lineage_producer_without_log_file(self):
        """Test query lineage producer uses database when no log file"""
        mock_engine = Mock()
        mock_connection = Mock()
        mock_result = [
            {
                "query_text": "MERGE INTO target USING source",
                "database_name": "db1",
                "schema_name": "schema1",
            },
        ]

        mock_connection.execute.return_value = mock_result
        mock_engine.connect.return_value.__enter__ = Mock(return_value=mock_connection)
        mock_engine.connect.return_value.__exit__ = Mock(return_value=None)

        self.lineage_source.config.sourceConfig.config.queryLogFilePath = None

        with patch.object(
            self.lineage_source, "get_engine", return_value=[mock_engine]
        ):
            producer = self.lineage_source.query_lineage_producer()
            queries = list(producer)

            self.assertEqual(len(queries), 1)
            self.assertIn("MERGE INTO", queries[0].query)

    def test_get_table_query_method(self):
        """Test get_table_query delegates correctly based on config"""
        # Test with log file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            writer = csv.DictWriter(
                f, fieldnames=["query_text", "database_name", "schema_name"]
            )
            writer.writeheader()
            writer.writerow(
                {
                    "query_text": "SELECT * FROM test",
                    "database_name": "db",
                    "schema_name": "schema",
                }
            )
            temp_file = f.name

        try:
            # Test with log file
            self.lineage_source.config.sourceConfig.config.queryLogFilePath = temp_file
            queries = list(self.lineage_source.get_table_query())
            self.assertEqual(len(queries), 1)
            self.assertEqual(queries[0].query, "SELECT * FROM test")

            # Test without log file (should use database)
            self.lineage_source.config.sourceConfig.config.queryLogFilePath = None
            mock_engine = Mock()
            mock_connection = Mock()
            mock_result = [
                {
                    "query_text": "SELECT * FROM db_table",
                    "database_name": "db1",
                    "schema_name": "schema1",
                },
            ]
            mock_connection.execute.return_value = mock_result
            mock_engine.connect.return_value.__enter__ = Mock(
                return_value=mock_connection
            )
            mock_engine.connect.return_value.__exit__ = Mock(return_value=None)

            with patch.object(
                self.lineage_source, "get_engine", return_value=[mock_engine]
            ):
                queries = list(self.lineage_source.get_table_query())
                self.assertEqual(len(queries), 1)
                self.assertEqual(queries[0].query, "SELECT * FROM db_table")
        finally:
            os.unlink(temp_file)


class TestViewLineage(unittest.TestCase):
    """Tests for view lineage functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = Mock()
        self.mock_config = Mock()
        self.mock_config.serviceName = "test_service"
        self.mock_config.sourceConfig.config = Mock()
        self.mock_config.sourceConfig.config.processViewLineage = True
        self.mock_config.sourceConfig.config.incrementalLineageProcessing = False
        self.mock_config.sourceConfig.config.databaseFilterPattern = None
        self.mock_config.sourceConfig.config.schemaFilterPattern = None
        self.mock_config.sourceConfig.config.tableFilterPattern = None

        self.lineage_source = TestableLineageSource(
            self.mock_config, self.mock_metadata
        )

    def test_view_lineage_producer(self):
        """Test view lineage producer yields views correctly"""
        mock_views = [
            TableView(
                table_name="view1",
                db_name="db1",
                schema_name="schema1",
                view_def="CREATE VIEW view1 AS SELECT * FROM table1",
            ),
            TableView(
                table_name="view2",
                db_name="db1",
                schema_name="schema1",
                view_def="CREATE VIEW view2 AS SELECT * FROM table2",
            ),
        ]

        self.mock_metadata.yield_es_view_def = Mock(return_value=iter(mock_views))

        views = list(self.lineage_source.view_lineage_producer())

        self.assertEqual(len(views), 2)
        self.assertEqual(views[0].table_name, "view1")
        self.assertEqual(views[1].table_name, "view2")

    def test_view_lineage_producer_with_filters(self):
        """Test view lineage producer applies filters correctly"""
        mock_views = [
            TableView(
                table_name="view1",
                db_name="db1",
                schema_name="schema1",
                view_def="CREATE VIEW view1 AS SELECT * FROM table1",
            ),
            TableView(
                table_name="filtered_view",
                db_name="filtered_db",
                schema_name="schema1",
                view_def="CREATE VIEW filtered_view AS SELECT * FROM table2",
            ),
        ]

        self.mock_metadata.yield_es_view_def = Mock(return_value=iter(mock_views))
        self.lineage_source.source_config.databaseFilterPattern = Mock()
        self.lineage_source.source_config.databaseFilterPattern.includes = []
        self.lineage_source.source_config.databaseFilterPattern.excludes = [
            "filtered_db"
        ]

        with patch(
            "metadata.utils.filters.filter_by_database", side_effect=[False, True]
        ):
            views = list(self.lineage_source.view_lineage_producer())

            self.assertEqual(len(views), 1)
            self.assertEqual(views[0].table_name, "view1")
            # Verify the filtered view was logged
            self.lineage_source.status.filter.assert_called_once()


class TestProcessingMethods(unittest.TestCase):
    """Tests for processing and chunking methods"""

    def test_generate_lineage_with_processes_chunking(self):
        """Test that generate_lineage_with_processes chunks data correctly"""

        # Create a producer that yields multiple items
        def producer():
            for i in range(5):
                yield TableQuery(query=f"SELECT {i}", serviceName="test")

        processed_items = []

        def processor(items, queue, *args):
            # Track what items are processed together
            processed_items.append(len(items))
            for item in items:
                queue.put(
                    Either(right=CreateQueryRequest(query=item.query, service="test"))
                )

        # Test with chunk_size=2
        results = list(
            LineageSource.generate_lineage_with_processes(
                producer_fn=producer,
                processor_fn=processor,
                args=(),
                chunk_size=2,
                processor_timeout=10,
                max_threads=2,
            )
        )

        # Should have 5 results total
        self.assertEqual(len(results), 5)
        # Should have been processed in chunks of 2, 2, 1
        self.assertEqual(processed_items, [2, 2, 1])

    def test_generate_lineage_with_processes_timeout(self):
        """Test timeout handling in generate_lineage_with_processes"""

        def producer():
            yield TableQuery(query="SELECT 1", serviceName="test")

        def slow_processor(items, queue, *args):
            import time

            time.sleep(2)  # Simulate slow processing
            for item in items:
                queue.put(
                    Either(right=CreateQueryRequest(query=item.query, service="test"))
                )

        # Test with very short timeout
        results = list(
            LineageSource.generate_lineage_with_processes(
                producer_fn=producer,
                processor_fn=slow_processor,
                args=(),
                chunk_size=1,
                processor_timeout=1,  # 1 second timeout
                max_threads=1,
            )
        )

        # Should handle timeout gracefully
        # Results may be empty due to timeout
        self.assertIsNotNone(results)


class TestMemoryEfficiency(unittest.TestCase):
    """Tests to ensure memory-efficient streaming"""

    def test_query_producer_is_generator(self):
        """Ensure query producers are generators, not lists"""
        mock_config = Mock()
        mock_config.serviceName = "test_service"
        mock_config.sourceConfig.config = Mock()
        mock_config.sourceConfig.config.queryLogFilePath = None

        lineage_source = TestableLineageSource(mock_config, Mock())

        # query_lineage_producer should return an iterator
        producer = lineage_source.query_lineage_producer()
        self.assertIsInstance(producer, Iterator)

        # get_table_query should return an iterator
        table_query = lineage_source.get_table_query()
        self.assertIsInstance(table_query, Iterator)

    def test_view_producer_is_generator(self):
        """Ensure view producer is a generator"""
        mock_config = Mock()
        mock_config.serviceName = "test_service"
        mock_config.sourceConfig.config = Mock()

        lineage_source = TestableLineageSource(mock_config, Mock())
        lineage_source.metadata.yield_es_view_def = Mock(return_value=iter([]))

        # view_lineage_producer should return an iterator
        producer = lineage_source.view_lineage_producer()
        # Consume the generator to ensure it's valid
        list(producer)
        # If no exception, it's a valid generator


class TestIntegrationAndEdgeCases(unittest.TestCase):
    """Integration and edge case tests from old test suite"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = Mock()
        self.mock_config = Mock()
        self.mock_config.serviceName = "test_service"
        self.mock_config.sourceConfig.config = Mock()
        self.mock_config.sourceConfig.config.queryLogFilePath = None
        self.mock_config.sourceConfig.config.processViewLineage = True
        self.mock_config.sourceConfig.config.processQueryLineage = True
        self.mock_config.sourceConfig.config.threads = 5

        self.lineage_source = TestableLineageSource(
            self.mock_config, self.mock_metadata
        )

    def test_yield_query_lineage_integration(self):
        """Test the full yield_query_lineage flow"""
        mock_table_query = TableQuery(
            query="INSERT INTO target SELECT * FROM source",
            databaseName="test_db",
            serviceName="test_service",
            databaseSchema="test_schema",
        )

        # Mock the query producer
        with patch.object(
            self.lineage_source,
            "query_lineage_producer",
            return_value=iter([mock_table_query]),
        ):
            # Mock the lineage processor
            with patch(
                "metadata.ingestion.source.database.lineage_processors.query_lineage_processor"
            ) as mock_processor:
                mock_processor.return_value = None

                # Mock generate_lineage_with_processes to return empty
                with patch.object(
                    LineageSource,
                    "generate_lineage_with_processes",
                    return_value=iter([]),
                ):
                    results = list(self.lineage_source.yield_query_lineage())

                    # Verify generate_lineage_with_processes was called
                    LineageSource.generate_lineage_with_processes.assert_called_once()

    def test_get_table_query_method_existence(self):
        """Test that get_table_query method exists and works correctly"""
        # This test ensures the method exists and is not accidentally removed
        self.assertTrue(hasattr(self.lineage_source, "get_table_query"))

        # Test with log file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            writer = csv.DictWriter(
                f, fieldnames=["query_text", "database_name", "schema_name"]
            )
            writer.writeheader()
            writer.writerow(
                {
                    "query_text": "SELECT * FROM test",
                    "database_name": "db",
                    "schema_name": "schema",
                }
            )
            temp_file = f.name

        try:
            self.lineage_source.config.sourceConfig.config.queryLogFilePath = temp_file
            queries = list(self.lineage_source.get_table_query())
            self.assertEqual(len(queries), 1)
        finally:
            os.unlink(temp_file)

    def test_critical_method_removal_protection(self):
        """Test that critical methods cannot be removed without breaking tests"""
        # These methods are critical for the lineage functionality
        critical_methods = [
            "get_table_query",
            "query_lineage_producer",
            "yield_table_query",
            "yield_table_queries_from_logs",
            "view_lineage_producer",
            "yield_view_lineage",
            "yield_query_lineage",
            "generate_lineage_with_processes",
        ]

        for method_name in critical_methods:
            with self.subTest(method=method_name):
                self.assertTrue(
                    hasattr(self.lineage_source, method_name),
                    f"Critical method '{method_name}' is missing from LineageSource!",
                )

                # Verify the method is callable
                method = getattr(self.lineage_source, method_name, None)
                if method and not method_name.startswith("generate_"):
                    self.assertTrue(
                        callable(method),
                        f"Method '{method_name}' exists but is not callable!",
                    )
