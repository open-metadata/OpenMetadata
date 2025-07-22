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
Test Stored Procedure Lineage Functionality

This module tests the stored procedure lineage processing functionality including:
1. Temp table lineage support with graph creation and management
2. Database and schema filtering for stored procedures and views
3. Procedure graph processing and lineage generation
4. Lineage query type detection and validation
"""
import uuid
from datetime import datetime
from unittest import TestCase
from unittest.mock import Mock, patch

from networkx import DiGraph

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.storedProcedure import (
    StoredProcedure,
    StoredProcedureCode,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import LineageDetails
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.status import Status
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_procedure_graph
from metadata.ingestion.source.database.stored_procedures_mixin import (
    ProcedureAndProcedureGraph,
    QueryByProcedure,
    StoredProcedureLineageMixin,
)
from metadata.ingestion.source.models import TableView


class MockStoredProcedureSource(StoredProcedureLineageMixin):
    """Mock implementation for testing stored procedure lineage functionality"""

    def __init__(self):
        self.status = Status()
        self.source_config = Mock(spec=DatabaseServiceQueryLineagePipeline)
        self.source_config.enableTempTableLineage = True
        self.source_config.databaseFilterPattern = None
        self.source_config.schemaFilterPattern = None
        self.source_config.storedProcedureFilterPattern = None
        self.source_config.incrementalLineageProcessing = False
        self.source_config.parsingTimeoutLimit = 30

        self.metadata = Mock()
        self.service_name = "test_service"
        self.service_connection = Mock()
        self.service_connection.type.value = "mysql"
        self.procedure_graph_map = {}
        self.engine = Mock()

    def get_stored_procedure_queries_dict(self):
        return {}


class StoredProcedureLineageTest(TestCase):
    """Test cases for stored procedure lineage functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.source = MockStoredProcedureSource()

        # Create test stored procedure
        self.test_procedure = StoredProcedure(
            id=uuid.uuid4(),
            name=EntityName("test_procedure"),
            fullyQualifiedName=FullyQualifiedEntityName(
                "test_service.test_db.test_schema.test_procedure"
            ),
            storedProcedureCode=StoredProcedureCode(
                language="SQL", code="INSERT INTO target SELECT * FROM source"
            ),
            database=EntityReference(id=uuid.uuid4(), name="test_db", type="database"),
            databaseSchema=EntityReference(
                id=uuid.uuid4(), name="test_schema", type="databaseSchema"
            ),
        )

        # Create test query
        self.test_query = QueryByProcedure(
            procedure_name="test_procedure",
            query_type="INSERT",
            query_database_name="test_db",
            query_schema_name="test_schema",
            procedure_text="CALL test_procedure()",
            procedure_start_time=datetime.now(),
            procedure_end_time=datetime.now(),
            query_start_time=datetime.now(),
            query_duration=1.5,
            query_text="INSERT INTO target SELECT * FROM source",
            query_user_name="test_user",
        )

    # ==========================================
    # TEMP TABLE LINEAGE FUNCTIONALITY
    # ==========================================

    def test_procedure_graph_creation_when_temp_lineage_enabled(self):
        """Test that procedure graphs are created when temp table lineage is enabled"""
        self.source.source_config.enableTempTableLineage = True

        # Create a mock lineage result
        mock_result = Either(
            right=AddLineageRequest(
                edge={
                    "fromEntity": EntityReference(id=uuid.uuid4(), type="table"),
                    "toEntity": EntityReference(id=uuid.uuid4(), type="table"),
                    "lineageDetails": None,
                }
            )
        )

        with patch(
            "metadata.ingestion.source.database.stored_procedures_mixin.get_lineage_by_query"
        ) as mock_lineage:
            mock_lineage.return_value = [mock_result]

            # Call the method that should create the graph
            list(
                self.source._yield_procedure_lineage(
                    self.test_query, self.test_procedure
                )
            )

            # Verify graph was created
            fqn = self.test_procedure.fullyQualifiedName.root
            self.assertIn(fqn, self.source.procedure_graph_map)
            self.assertIsInstance(self.source.procedure_graph_map[fqn].graph, DiGraph)

    def test_procedure_graph_not_created_when_temp_lineage_disabled(self):
        """Test that procedure graphs are not created when temp table lineage is disabled"""
        self.source.source_config.enableTempTableLineage = False

        # Create a mock lineage result
        mock_result = Either(
            right=AddLineageRequest(
                edge={
                    "fromEntity": EntityReference(id=uuid.uuid4(), type="table"),
                    "toEntity": EntityReference(id=uuid.uuid4(), type="table"),
                    "lineageDetails": None,
                }
            )
        )

        with patch(
            "metadata.ingestion.source.database.stored_procedures_mixin.get_lineage_by_query"
        ) as mock_lineage:
            mock_lineage.return_value = [mock_result]

            list(
                self.source._yield_procedure_lineage(
                    self.test_query, self.test_procedure
                )
            )

            # Verify no graph was created
            self.assertEqual(len(self.source.procedure_graph_map), 0)

    def test_procedure_graph_passed_to_lineage_query(self):
        """Test that the procedure graph is passed to get_lineage_by_query"""
        self.source.source_config.enableTempTableLineage = True

        # Create a mock lineage result
        mock_result = Either(
            right=AddLineageRequest(
                edge={
                    "fromEntity": EntityReference(id=uuid.uuid4(), type="table"),
                    "toEntity": EntityReference(id=uuid.uuid4(), type="table"),
                    "lineageDetails": None,
                }
            )
        )

        with patch(
            "metadata.ingestion.source.database.stored_procedures_mixin.get_lineage_by_query"
        ) as mock_lineage:
            mock_lineage.return_value = [
                mock_result
            ]  # Return a result so the loop iterates

            list(
                self.source._yield_procedure_lineage(
                    self.test_query, self.test_procedure
                )
            )

            # Verify get_lineage_by_query was called with the graph
            mock_lineage.assert_called_once()
            call_kwargs = mock_lineage.call_args[1]
            self.assertIn("graph", call_kwargs)
            self.assertIsInstance(call_kwargs["graph"], DiGraph)

    # ==========================================
    # DATABASE AND SCHEMA FILTERING
    # ==========================================

    def test_view_database_filtering(self):
        """Test view filtering by database patterns"""
        from metadata.utils.filters import filter_by_database

        # Create test views
        test_views = [
            TableView(
                table_name="view1",
                db_name="test_db",
                schema_name="test_schema",
                view_definition="SELECT 1",
            ),
            TableView(
                table_name="view2",
                db_name="other_db",
                schema_name="test_schema",
                view_definition="SELECT 2",
            ),
        ]

        # Test database filtering
        db_filter = FilterPattern(includes=["test_db"])

        filtered_views = []
        for view in test_views:
            if not filter_by_database(db_filter, view.db_name):
                filtered_views.append(view)

        # Should include only view from test_db
        self.assertEqual(len(filtered_views), 1)
        self.assertEqual(filtered_views[0].table_name, "view1")

    def test_combined_filtering_logic(self):
        """Test combined filtering by database, schema, and procedure patterns"""
        from metadata.utils.filters import (
            filter_by_database,
            filter_by_schema,
            filter_by_stored_procedure,
        )

        # Test procedure that should pass all filters
        test_procedure = StoredProcedure(
            id=uuid.uuid4(),
            name=EntityName("sp_test_procedure"),
            fullyQualifiedName=FullyQualifiedEntityName(
                "test_service.prod_db.public.sp_test_procedure"
            ),
            storedProcedureCode=StoredProcedureCode(language="SQL", code="SELECT 1"),
            database=EntityReference(id=uuid.uuid4(), name="prod_db", type="database"),
            databaseSchema=EntityReference(
                id=uuid.uuid4(), name="public", type="databaseSchema"
            ),
        )

        # Set up filters
        db_filter = FilterPattern(includes=["prod_.*"])
        schema_filter = FilterPattern(excludes=["temp.*"])
        procedure_filter = FilterPattern(includes=["sp_.*"])

        # Test filtering
        should_filter = (
            filter_by_database(db_filter, test_procedure.database.name)
            and filter_by_schema(schema_filter, test_procedure.databaseSchema.name)
            and filter_by_stored_procedure(procedure_filter, test_procedure.name.root)
        )

        # Should not be filtered (all filters pass)
        self.assertFalse(should_filter)

    # ==========================================
    # PROCEDURE GRAPH PROCESSING
    # ==========================================

    def test_get_lineage_by_procedure_graph_empty_map(self):
        """Test that empty procedure graph map returns no lineage"""
        procedure_graph_map = {}
        lineages = list(
            get_lineage_by_procedure_graph(procedure_graph_map, self.source.metadata)
        )
        self.assertEqual(len(lineages), 0)

    def test_get_lineage_by_procedure_graph_sets_pipeline_reference(self):
        """Test that procedure pipeline reference is set in lineage details"""
        # Create procedure and graph
        test_graph = DiGraph()
        procedure_and_graph = ProcedureAndProcedureGraph(
            procedure=self.test_procedure, graph=test_graph
        )

        procedure_graph_map = {
            self.test_procedure.fullyQualifiedName.root: procedure_and_graph
        }

        # Mock get_lineage_by_graph to return a test lineage
        mock_lineage = Either(
            right=AddLineageRequest(
                edge={
                    "fromEntity": EntityReference(id=uuid.uuid4(), type="table"),
                    "toEntity": EntityReference(id=uuid.uuid4(), type="table"),
                    "lineageDetails": LineageDetails(columnsLineage=[], pipeline=None),
                }
            )
        )

        with patch(
            "metadata.ingestion.lineage.sql_lineage.get_lineage_by_graph"
        ) as mock_get_lineage:
            mock_get_lineage.return_value = [mock_lineage]

            lineages = list(
                get_lineage_by_procedure_graph(
                    procedure_graph_map, self.source.metadata
                )
            )

            # Verify pipeline reference was set
            lineage = lineages[0]
            self.assertEqual(
                lineage.right.edge.lineageDetails.pipeline.id, self.test_procedure.id
            )
            self.assertEqual(
                lineage.right.edge.lineageDetails.pipeline.type, "storedProcedure"
            )

    # ==========================================
    # LINEAGE QUERY TYPE DETECTION
    # ==========================================

    def test_is_lineage_query_types(self):
        """Test that correct query types are identified as lineage queries"""
        # Test positive cases
        self.assertTrue(
            self.source.is_lineage_query("MERGE", "MERGE INTO target USING source")
        )
        self.assertTrue(
            self.source.is_lineage_query("UPDATE", "UPDATE table SET col = 1")
        )
        self.assertTrue(
            self.source.is_lineage_query(
                "CREATE_TABLE_AS_SELECT", "CREATE TABLE new AS SELECT * FROM old"
            )
        )
        self.assertTrue(
            self.source.is_lineage_query(
                "INSERT", "INSERT INTO target SELECT * FROM source"
            )
        )

        # Test negative cases
        self.assertFalse(
            self.source.is_lineage_query(
                "INSERT", "INSERT INTO target VALUES (1, 2, 3)"
            )
        )
        self.assertFalse(self.source.is_lineage_query("SELECT", "SELECT * FROM table"))

    def test_is_lineage_query_case_insensitive(self):
        """Test that lineage query detection is case insensitive"""
        self.assertTrue(
            self.source.is_lineage_query(
                "INSERT", "insert into target select * from source"
            )
        )
        self.assertTrue(
            self.source.is_lineage_query(
                "INSERT", "INSERT INTO TARGET SELECT * FROM SOURCE"
            )
        )

    # ==========================================
    # GRAPH MAP INITIALIZATION AND MANAGEMENT
    # ==========================================

    def test_procedure_graph_map_initialization(self):
        """Test that procedure_graph_map is properly initialized"""
        # Test that it starts as empty dict
        self.assertEqual(self.source.procedure_graph_map, {})

        # Test that it can be populated
        test_graph = DiGraph()
        procedure_and_graph = ProcedureAndProcedureGraph(
            procedure=self.test_procedure, graph=test_graph
        )

        self.source.procedure_graph_map["test_key"] = procedure_and_graph
        self.assertEqual(len(self.source.procedure_graph_map), 1)
        self.assertIn("test_key", self.source.procedure_graph_map)

    # ==========================================
    # ERROR HANDLING AND ROBUSTNESS
    # ==========================================

    def test_procedure_lineage_with_exception_handling(self):
        """Test that exceptions in lineage processing propagate up (current behavior)"""
        with patch(
            "metadata.ingestion.source.database.stored_procedures_mixin.get_lineage_by_query"
        ) as mock_lineage:
            mock_lineage.side_effect = Exception("Test exception")

            # Current implementation lets exceptions propagate up
            with self.assertRaises(Exception) as cm:
                list(
                    self.source._yield_procedure_lineage(
                        self.test_query, self.test_procedure
                    )
                )

            # Verify the exception message
            self.assertEqual(str(cm.exception), "Test exception")

    # ==========================================
    # INTEGRATION AND END-TO-END TESTING
    # ==========================================

    def test_temp_table_lineage_integration(self):
        """Test integration of temp table lineage processing"""
        # Enable temp table lineage
        self.source.source_config.enableTempTableLineage = True

        # Create a mock lineage result
        mock_result = Either(
            right=AddLineageRequest(
                edge={
                    "fromEntity": EntityReference(id=uuid.uuid4(), type="table"),
                    "toEntity": EntityReference(id=uuid.uuid4(), type="table"),
                    "lineageDetails": None,
                }
            )
        )

        # Mock lineage processing
        with patch(
            "metadata.ingestion.source.database.stored_procedures_mixin.get_lineage_by_query"
        ) as mock_lineage:
            mock_lineage.return_value = [
                mock_result
            ]  # Return a result so the loop iterates

            # Process lineage
            list(
                self.source._yield_procedure_lineage(
                    self.test_query, self.test_procedure
                )
            )

            # Verify graph was created
            fqn = self.test_procedure.fullyQualifiedName.root
            self.assertIn(fqn, self.source.procedure_graph_map)

            # Verify get_lineage_by_query was called with graph
            mock_lineage.assert_called_once()
            call_kwargs = mock_lineage.call_args[1]
            self.assertIsInstance(call_kwargs["graph"], DiGraph)

    def test_procedure_graph_creation_and_reuse(self):
        """Test that procedure graphs are created once and reused"""
        self.source.source_config.enableTempTableLineage = True

        # Create a mock lineage result
        mock_result = Either(
            right=AddLineageRequest(
                edge={
                    "fromEntity": EntityReference(id=uuid.uuid4(), type="table"),
                    "toEntity": EntityReference(id=uuid.uuid4(), type="table"),
                    "lineageDetails": None,
                }
            )
        )

        with patch(
            "metadata.ingestion.source.database.stored_procedures_mixin.get_lineage_by_query"
        ) as mock_lineage:
            mock_lineage.return_value = [mock_result]

            # Call twice with same procedure
            list(
                self.source._yield_procedure_lineage(
                    self.test_query, self.test_procedure
                )
            )
            list(
                self.source._yield_procedure_lineage(
                    self.test_query, self.test_procedure
                )
            )

            # Should have only one graph entry
            self.assertEqual(len(self.source.procedure_graph_map), 1)

    def test_filtering_patterns_with_none_values(self):
        """Test that None filter patterns are handled correctly"""
        from metadata.utils.filters import (
            filter_by_database,
            filter_by_schema,
            filter_by_stored_procedure,
        )

        # Test with None patterns (should not filter anything)
        self.assertFalse(filter_by_database(None, "any_database"))
        self.assertFalse(filter_by_schema(None, "any_schema"))
        self.assertFalse(filter_by_stored_procedure(None, "any_procedure"))

    def test_multiple_procedure_graph_handling(self):
        """Test handling of multiple procedure graphs"""
        # Create second procedure
        second_procedure = StoredProcedure(
            id=uuid.uuid4(),
            name=EntityName("second_procedure"),
            fullyQualifiedName=FullyQualifiedEntityName(
                "test_service.test_db.test_schema.second_procedure"
            ),
            storedProcedureCode=StoredProcedureCode(
                language="SQL", code="UPDATE target SET col = 1"
            ),
        )

        # Create graphs for both procedures
        test_graph_1 = DiGraph()
        test_graph_2 = DiGraph()

        procedure_and_graph_1 = ProcedureAndProcedureGraph(
            procedure=self.test_procedure, graph=test_graph_1
        )
        procedure_and_graph_2 = ProcedureAndProcedureGraph(
            procedure=second_procedure, graph=test_graph_2
        )

        procedure_graph_map = {
            self.test_procedure.fullyQualifiedName.root: procedure_and_graph_1,
            second_procedure.fullyQualifiedName.root: procedure_and_graph_2,
        }

        # Mock get_lineage_by_graph to return lineages for both
        mock_lineage = Either(
            right=AddLineageRequest(
                edge={
                    "fromEntity": EntityReference(id=uuid.uuid4(), type="table"),
                    "toEntity": EntityReference(id=uuid.uuid4(), type="table"),
                    "lineageDetails": LineageDetails(columnsLineage=[], pipeline=None),
                }
            )
        )

        with patch(
            "metadata.ingestion.lineage.sql_lineage.get_lineage_by_graph"
        ) as mock_get_lineage:
            mock_get_lineage.return_value = [mock_lineage]

            lineages = list(
                get_lineage_by_procedure_graph(
                    procedure_graph_map, self.source.metadata
                )
            )

            # Should return lineages for both procedures
            self.assertEqual(len(lineages), 2)

            # Verify get_lineage_by_graph was called twice
            self.assertEqual(mock_get_lineage.call_count, 2)
