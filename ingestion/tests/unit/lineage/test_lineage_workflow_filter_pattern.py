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
Test lineage workflow filter pattern functionality

This module tests the filtering logic for both views and stored procedures
in lineage ingestion workflows to ensure proper filtering behavior.
"""
import uuid
from unittest import TestCase

from metadata.generated.schema.entity.data.storedProcedure import (
    StoredProcedure,
    StoredProcedureCode,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
from metadata.generated.schema.type.basic import EntityName
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.api.status import Status
from metadata.ingestion.source.models import TableView
from metadata.utils.filters import filter_by_stored_procedure, filter_by_table


class LineageWorkflowFilterPatternTest(TestCase):
    """Test lineage workflow filter pattern functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.source_config = DatabaseServiceQueryLineagePipeline()
        self.status = Status()

    # ==========================================
    # VIEW FILTERING TESTS
    # ==========================================

    def test_view_filtering_by_table_pattern_include_only(self):
        """Test view filtering with include patterns only"""
        # Setup filter pattern to include only views starting with "public_"
        self.source_config.tableFilterPattern = FilterPattern(includes=["^public_.*"])

        # Create test views
        views = [
            TableView(
                table_name="public_view1",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM table1",
            ),
            TableView(
                table_name="internal_view",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM table2",
            ),
            TableView(
                table_name="public_view2",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM table3",
            ),
        ]

        # Test the filtering logic
        filtered_views = []
        for view in views:
            if filter_by_table(
                self.source_config.tableFilterPattern,
                view.table_name,
            ):
                self.status.filter(
                    view.table_name,
                    "View Filtered Out",
                )
            else:
                filtered_views.append(view)

        # Should only include views starting with "public_"
        self.assertEqual(len(filtered_views), 2)
        self.assertEqual(filtered_views[0].table_name, "public_view1")
        self.assertEqual(filtered_views[1].table_name, "public_view2")

        # Check that the internal_view was filtered out
        self.assertEqual(len(self.status.filtered), 1)
        self.assertIn(
            "internal_view", [list(f.keys())[0] for f in self.status.filtered]
        )

    def test_view_filtering_by_table_pattern_exclude_only(self):
        """Test view filtering with exclude patterns only"""
        # Reset status for new test
        self.status = Status()

        # Setup filter pattern to exclude views containing "temp"
        self.source_config.tableFilterPattern = FilterPattern(excludes=[".*temp.*"])

        # Create test views
        views = [
            TableView(
                table_name="user_view",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM users",
            ),
            TableView(
                table_name="temp_view",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM temp_table",
            ),
            TableView(
                table_name="order_view",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM orders",
            ),
        ]

        # Test the filtering logic
        filtered_views = []
        for view in views:
            if filter_by_table(
                self.source_config.tableFilterPattern,
                view.table_name,
            ):
                self.status.filter(
                    view.table_name,
                    "View Filtered Out",
                )
            else:
                filtered_views.append(view)

        # Should exclude views containing "temp"
        self.assertEqual(len(filtered_views), 2)
        self.assertEqual(filtered_views[0].table_name, "user_view")
        self.assertEqual(filtered_views[1].table_name, "order_view")

        # Check that the temp_view was filtered out
        self.assertEqual(len(self.status.filtered), 1)
        self.assertIn("temp_view", [list(f.keys())[0] for f in self.status.filtered])

    def test_view_filtering_by_table_pattern_include_exclude(self):
        """Test view filtering with both include and exclude patterns"""
        # Reset status for new test
        self.status = Status()

        # Setup filter pattern to include views starting with "public_" but exclude those containing "temp"
        self.source_config.tableFilterPattern = FilterPattern(
            includes=["^public_.*"], excludes=[".*temp.*"]
        )

        # Create test views
        views = [
            TableView(
                table_name="public_view1",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM table1",
            ),
            TableView(
                table_name="internal_view",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM table2",
            ),
            TableView(
                table_name="public_temp_view",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM temp_table",
            ),
        ]

        # Test the filtering logic
        filtered_views = []
        for view in views:
            if filter_by_table(
                self.source_config.tableFilterPattern,
                view.table_name,
            ):
                self.status.filter(
                    view.table_name,
                    "View Filtered Out",
                )
            else:
                filtered_views.append(view)

        # Should include only "public_view1" (includes "public_" but excludes "temp")
        self.assertEqual(len(filtered_views), 1)
        self.assertEqual(filtered_views[0].table_name, "public_view1")

        # Check that both internal_view and public_temp_view were filtered out
        self.assertEqual(len(self.status.filtered), 2)
        filtered_names = [list(f.keys())[0] for f in self.status.filtered]
        self.assertIn("internal_view", filtered_names)
        self.assertIn("public_temp_view", filtered_names)

    def test_view_filtering_no_pattern(self):
        """Test view filtering behavior when no filter pattern is set"""
        # Reset status for new test
        self.status = Status()

        # No filter pattern set
        self.source_config.tableFilterPattern = None

        # Create test views
        views = [
            TableView(
                table_name="view1",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM table1",
            ),
            TableView(
                table_name="view2",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM table2",
            ),
        ]

        # Test the filtering logic
        filtered_views = []
        for view in views:
            if filter_by_table(
                self.source_config.tableFilterPattern,
                view.table_name,
            ):
                self.status.filter(
                    view.table_name,
                    "View Filtered Out",
                )
            else:
                filtered_views.append(view)

        # Should include all views when no filter pattern is set
        self.assertEqual(len(filtered_views), 2)
        self.assertEqual(len(self.status.filtered), 0)

    def test_view_filtering_complex_regex(self):
        """Test view filtering with complex regex patterns"""
        # Reset status for new test
        self.status = Status()

        # Complex regex pattern
        self.source_config.tableFilterPattern = FilterPattern(
            includes=["^(public|customer)_.*"], excludes=[".*_(temp|test)$"]
        )

        # Create test views
        views = [
            TableView(
                table_name="public_view1",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM table1",
            ),
            TableView(
                table_name="customer_orders",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM orders",
            ),
            TableView(
                table_name="public_view_temp",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM temp_table",
            ),
            TableView(
                table_name="internal_view",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM internal",
            ),
            TableView(
                table_name="customer_test",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT * FROM test_table",
            ),
        ]

        # Test the filtering logic
        filtered_views = []
        for view in views:
            if filter_by_table(
                self.source_config.tableFilterPattern,
                view.table_name,
            ):
                self.status.filter(
                    view.table_name,
                    "View Filtered Out",
                )
            else:
                filtered_views.append(view)

        # Should include only "public_view1" and "customer_orders"
        self.assertEqual(len(filtered_views), 2)
        filtered_names = [v.table_name for v in filtered_views]
        self.assertIn("public_view1", filtered_names)
        self.assertIn("customer_orders", filtered_names)

        # Check that the excluded views were filtered out
        self.assertEqual(len(self.status.filtered), 3)
        filtered_names = [list(f.keys())[0] for f in self.status.filtered]
        self.assertIn("public_view_temp", filtered_names)
        self.assertIn("internal_view", filtered_names)
        self.assertIn("customer_test", filtered_names)

    # ==========================================
    # STORED PROCEDURE FILTERING TESTS
    # ==========================================

    def test_stored_procedure_filtering_by_procedure_pattern_include_only(self):
        """Test stored procedure filtering with include patterns only"""
        # Reset status for new test
        self.status = Status()

        # Setup filter pattern to include only procedures starting with "sp_"
        self.source_config.storedProcedureFilterPattern = FilterPattern(
            includes=["^sp_.*"]
        )

        # Create test stored procedures
        procedures = [
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("sp_get_users"),
                fullyQualifiedName="test_service.test_db.public.sp_get_users",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT * FROM users"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("get_orders"),
                fullyQualifiedName="test_service.test_db.public.get_orders",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT * FROM orders"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("sp_update_inventory"),
                fullyQualifiedName="test_service.test_db.public.sp_update_inventory",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="UPDATE inventory SET quantity = 0"
                ),
            ),
        ]

        # Test the filtering logic
        filtered_procedures = []
        for procedure in procedures:
            if filter_by_stored_procedure(
                self.source_config.storedProcedureFilterPattern,
                procedure.name.root,
            ):
                self.status.filter(
                    procedure.name.root,
                    "Stored Procedure Filtered Out",
                )
            else:
                filtered_procedures.append(procedure)

        # Should only include procedures starting with "sp_"
        self.assertEqual(len(filtered_procedures), 2)
        self.assertEqual(filtered_procedures[0].name.root, "sp_get_users")
        self.assertEqual(filtered_procedures[1].name.root, "sp_update_inventory")

        # Check that the get_orders procedure was filtered out
        self.assertEqual(len(self.status.filtered), 1)
        self.assertIn("get_orders", [list(f.keys())[0] for f in self.status.filtered])

    def test_stored_procedure_filtering_by_procedure_pattern_exclude_only(self):
        """Test stored procedure filtering with exclude patterns only"""
        # Reset status for new test
        self.status = Status()

        # Setup filter pattern to exclude procedures containing "temp"
        self.source_config.storedProcedureFilterPattern = FilterPattern(
            excludes=[".*temp.*"]
        )

        # Create test stored procedures
        procedures = [
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("sp_get_users"),
                fullyQualifiedName="test_service.test_db.public.sp_get_users",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT * FROM users"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("temp_procedure"),
                fullyQualifiedName="test_service.test_db.public.temp_procedure",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="CREATE TEMP TABLE temp_data AS SELECT 1"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("sp_update_inventory"),
                fullyQualifiedName="test_service.test_db.public.sp_update_inventory",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="UPDATE inventory SET quantity = 0"
                ),
            ),
        ]

        # Test the filtering logic
        filtered_procedures = []
        for procedure in procedures:
            if filter_by_stored_procedure(
                self.source_config.storedProcedureFilterPattern,
                procedure.name.root,
            ):
                self.status.filter(
                    procedure.name.root,
                    "Stored Procedure Filtered Out",
                )
            else:
                filtered_procedures.append(procedure)

        # Should exclude procedures containing "temp"
        self.assertEqual(len(filtered_procedures), 2)
        self.assertEqual(filtered_procedures[0].name.root, "sp_get_users")
        self.assertEqual(filtered_procedures[1].name.root, "sp_update_inventory")

        # Check that the temp_procedure was filtered out
        self.assertEqual(len(self.status.filtered), 1)
        self.assertIn(
            "temp_procedure", [list(f.keys())[0] for f in self.status.filtered]
        )

    def test_stored_procedure_filtering_by_procedure_pattern_include_exclude(self):
        """Test stored procedure filtering with both include and exclude patterns"""
        # Reset status for new test
        self.status = Status()

        # Setup filter pattern to include procedures starting with "sp_" but exclude those containing "temp"
        self.source_config.storedProcedureFilterPattern = FilterPattern(
            includes=["^sp_.*"], excludes=[".*temp.*"]
        )

        # Create test stored procedures
        procedures = [
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("sp_get_users"),
                fullyQualifiedName="test_service.test_db.public.sp_get_users",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT * FROM users"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("get_orders"),
                fullyQualifiedName="test_service.test_db.public.get_orders",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT * FROM orders"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("sp_temp_procedure"),
                fullyQualifiedName="test_service.test_db.public.sp_temp_procedure",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="CREATE TEMP TABLE temp_sp AS SELECT 1"
                ),
            ),
        ]

        # Test the filtering logic
        filtered_procedures = []
        for procedure in procedures:
            if filter_by_stored_procedure(
                self.source_config.storedProcedureFilterPattern,
                procedure.name.root,
            ):
                self.status.filter(
                    procedure.name.root,
                    "Stored Procedure Filtered Out",
                )
            else:
                filtered_procedures.append(procedure)

        # Should include only "sp_get_users" (includes "sp_" but excludes "temp")
        self.assertEqual(len(filtered_procedures), 1)
        self.assertEqual(filtered_procedures[0].name.root, "sp_get_users")

        # Check that both get_orders and sp_temp_procedure were filtered out
        self.assertEqual(len(self.status.filtered), 2)
        filtered_names = [list(f.keys())[0] for f in self.status.filtered]
        self.assertIn("get_orders", filtered_names)
        self.assertIn("sp_temp_procedure", filtered_names)

    def test_stored_procedure_filtering_no_pattern(self):
        """Test stored procedure filtering behavior when no filter pattern is set"""
        # Reset status for new test
        self.status = Status()

        # No filter pattern set
        self.source_config.storedProcedureFilterPattern = None

        # Create test stored procedures
        procedures = [
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("procedure1"),
                fullyQualifiedName="test_service.test_db.public.procedure1",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT 1"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("procedure2"),
                fullyQualifiedName="test_service.test_db.public.procedure2",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT 2"
                ),
            ),
        ]

        # Test the filtering logic
        filtered_procedures = []
        for procedure in procedures:
            if filter_by_stored_procedure(
                self.source_config.storedProcedureFilterPattern,
                procedure.name.root,
            ):
                self.status.filter(
                    procedure.name.root,
                    "Stored Procedure Filtered Out",
                )
            else:
                filtered_procedures.append(procedure)

        # Should include all procedures when no filter pattern is set
        self.assertEqual(len(filtered_procedures), 2)
        self.assertEqual(len(self.status.filtered), 0)

    def test_stored_procedure_filtering_complex_regex(self):
        """Test stored procedure filtering with complex regex patterns"""
        # Reset status for new test
        self.status = Status()

        # Complex regex pattern
        self.source_config.storedProcedureFilterPattern = FilterPattern(
            includes=["^(sp|usp)_.*"], excludes=[".*_(temp|test)$"]
        )

        # Create test stored procedures
        procedures = [
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("sp_get_users"),
                fullyQualifiedName="test_service.test_db.public.sp_get_users",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT * FROM users"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("usp_update_orders"),
                fullyQualifiedName="test_service.test_db.public.usp_update_orders",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="UPDATE orders SET status = 'completed'"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("sp_procedure_temp"),
                fullyQualifiedName="test_service.test_db.public.sp_procedure_temp",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="CREATE TEMP TABLE temp_data AS SELECT 1"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("get_inventory"),
                fullyQualifiedName="test_service.test_db.public.get_inventory",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT * FROM inventory"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("usp_data_test"),
                fullyQualifiedName="test_service.test_db.public.usp_data_test",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT * FROM test_data"
                ),
            ),
        ]

        # Test the filtering logic
        filtered_procedures = []
        for procedure in procedures:
            if filter_by_stored_procedure(
                self.source_config.storedProcedureFilterPattern,
                procedure.name.root,
            ):
                self.status.filter(
                    procedure.name.root,
                    "Stored Procedure Filtered Out",
                )
            else:
                filtered_procedures.append(procedure)

        # Should include only "sp_get_users" and "usp_update_orders"
        self.assertEqual(len(filtered_procedures), 2)
        filtered_names = [p.name.root for p in filtered_procedures]
        self.assertIn("sp_get_users", filtered_names)
        self.assertIn("usp_update_orders", filtered_names)

        # Check that the excluded procedures were filtered out
        self.assertEqual(len(self.status.filtered), 3)
        filtered_names = [list(f.keys())[0] for f in self.status.filtered]
        self.assertIn("sp_procedure_temp", filtered_names)
        self.assertIn("get_inventory", filtered_names)
        self.assertIn("usp_data_test", filtered_names)

    # ==========================================
    # EDGE CASE AND INTEGRATION TESTS
    # ==========================================

    def test_case_sensitivity_filtering(self):
        """Test case insensitive filtering patterns (default behavior)"""
        # Reset status for new test
        self.status = Status()

        # Case insensitive patterns (default behavior)
        self.source_config.tableFilterPattern = FilterPattern(includes=["^PUBLIC_.*"])
        self.source_config.storedProcedureFilterPattern = FilterPattern(
            includes=["^SP_.*"]
        )

        # Create test data
        views = [
            TableView(
                table_name="PUBLIC_VIEW1",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT 1",
            ),
            TableView(
                table_name="public_view2",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT 1",
            ),
        ]

        procedures = [
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("SP_GET_USERS"),
                fullyQualifiedName="test.SP_GET_USERS",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT * FROM users"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("sp_update_orders"),
                fullyQualifiedName="test.sp_update_orders",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="UPDATE orders SET status = 'completed'"
                ),
            ),
        ]

        # Test view filtering - both should match due to case insensitive matching
        filtered_views = [
            v
            for v in views
            if not filter_by_table(self.source_config.tableFilterPattern, v.table_name)
        ]
        self.assertEqual(len(filtered_views), 2)
        view_names = [v.table_name for v in filtered_views]
        self.assertIn("PUBLIC_VIEW1", view_names)
        self.assertIn("public_view2", view_names)

        # Test stored procedure filtering - both should match due to case insensitive matching
        filtered_procedures = [
            p
            for p in procedures
            if not filter_by_stored_procedure(
                self.source_config.storedProcedureFilterPattern, p.name.root
            )
        ]
        self.assertEqual(len(filtered_procedures), 2)
        procedure_names = [p.name.root for p in filtered_procedures]
        self.assertIn("SP_GET_USERS", procedure_names)
        self.assertIn("sp_update_orders", procedure_names)

    def test_empty_filter_patterns(self):
        """Test behavior with empty filter patterns"""
        # Reset status for new test
        self.status = Status()

        # Empty filter patterns
        self.source_config.tableFilterPattern = FilterPattern()
        self.source_config.storedProcedureFilterPattern = FilterPattern()

        # Create test data
        views = [
            TableView(
                table_name="view1",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT 1",
            ),
            TableView(
                table_name="view2",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT 1",
            ),
        ]

        procedures = [
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("procedure1"),
                fullyQualifiedName="test.procedure1",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT 1"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("procedure2"),
                fullyQualifiedName="test.procedure2",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT 2"
                ),
            ),
        ]

        # Test that nothing is filtered when patterns are empty
        filtered_views = [
            v
            for v in views
            if not filter_by_table(self.source_config.tableFilterPattern, v.table_name)
        ]
        self.assertEqual(len(filtered_views), 2)

        filtered_procedures = [
            p
            for p in procedures
            if not filter_by_stored_procedure(
                self.source_config.storedProcedureFilterPattern, p.name.root
            )
        ]
        self.assertEqual(len(filtered_procedures), 2)

    def test_special_characters_in_names(self):
        """Test filtering with special characters in names"""
        # Reset status for new test
        self.status = Status()

        # Patterns that handle special characters
        self.source_config.tableFilterPattern = FilterPattern(
            includes=[".*\\$.*"]  # Include names with $ character
        )
        self.source_config.storedProcedureFilterPattern = FilterPattern(
            excludes=[".*@.*"]  # Exclude names with @ character
        )

        # Create test data with special characters
        views = [
            TableView(
                table_name="view$special",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT 1",
            ),
            TableView(
                table_name="normal_view",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT 1",
            ),
            TableView(
                table_name="another$view",
                db_name="test_db",
                schema_name="public",
                view_definition="SELECT 1",
            ),
        ]

        procedures = [
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("sp_normal"),
                fullyQualifiedName="test.sp_normal",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT 1"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("sp@special"),
                fullyQualifiedName="test.sp@special",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT 2"
                ),
            ),
            StoredProcedure(
                id=uuid.uuid4(),
                name=EntityName("sp_another"),
                fullyQualifiedName="test.sp_another",
                storedProcedureCode=StoredProcedureCode(
                    language="SQL", code="SELECT 3"
                ),
            ),
        ]

        # Test view filtering - should include only views with $
        filtered_views = [
            v
            for v in views
            if not filter_by_table(self.source_config.tableFilterPattern, v.table_name)
        ]
        self.assertEqual(len(filtered_views), 2)
        view_names = [v.table_name for v in filtered_views]
        self.assertIn("view$special", view_names)
        self.assertIn("another$view", view_names)

        # Test stored procedure filtering - should exclude procedures with @
        filtered_procedures = [
            p
            for p in procedures
            if not filter_by_stored_procedure(
                self.source_config.storedProcedureFilterPattern, p.name.root
            )
        ]
        self.assertEqual(len(filtered_procedures), 2)
        procedure_names = [p.name.root for p in filtered_procedures]
        self.assertIn("sp_normal", procedure_names)
        self.assertIn("sp_another", procedure_names)
        self.assertNotIn("sp@special", procedure_names)
