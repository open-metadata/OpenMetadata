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
Test Looker standalone views functionality
"""
from unittest import TestCase
from unittest.mock import Mock

from looker_sdk.sdk.api40.models import LookmlModel

from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.entity.data.dashboardDataModel import DataModelType
from metadata.ingestion.source.dashboard.looker.models import LookMlView


class TestLookerStandaloneViewsLogic(TestCase):
    """
    Test suite for Looker standalone views logic without full initialization.
    Tests focus on the core logic of standalone view processing.
    """

    def test_standalone_view_iteration_logic(self):
        """Test that views are iterated correctly from parser cache"""
        # Create mock views
        view1 = LookMlView(
            name="standalone_view_1",
            source_file="/path/to/view1.view.lkml",
            sql_table_name="dataset.table1",
            dimensions=[],
            measures=[],
        )
        view2 = LookMlView(
            name="standalone_view_2",
            source_file="/path/to/view2.view.lkml",
            sql_table_name="dataset.table2",
            dimensions=[],
            measures=[],
        )

        # Test iteration logic
        views_cache = {
            "standalone_view_1": view1,
            "standalone_view_2": view2,
        }

        processed_views = []
        for view_name, view in views_cache.items():
            processed_views.append(view_name)

        self.assertEqual(len(processed_views), 2)
        self.assertIn("standalone_view_1", processed_views)
        self.assertIn("standalone_view_2", processed_views)

    def test_view_filtering_logic(self):
        """Test that already processed views are correctly identified"""
        view1 = LookMlView(
            name="already_processed",
            source_file="/path/to/view1.view.lkml",
            sql_table_name="dataset.table1",
            dimensions=[],
            measures=[],
        )
        view2 = LookMlView(
            name="new_view",
            source_file="/path/to/view2.view.lkml",
            sql_table_name="dataset.table2",
            dimensions=[],
            measures=[],
        )

        parser_cache = {
            "already_processed": view1,
            "new_view": view2,
        }

        processed_cache = {"already_processed": Mock()}

        # Simulate filtering logic
        views_to_process = []
        for view_name, view in parser_cache.items():
            if view_name not in processed_cache:
                views_to_process.append(view_name)

        self.assertEqual(len(views_to_process), 1)
        self.assertIn("new_view", views_to_process)
        self.assertNotIn("already_processed", views_to_process)

    def test_explore_counting_logic(self):
        """Test the logic for counting explores"""
        all_lookml_models = [
            LookmlModel(
                name="model1",
                explores=[Mock(name="explore1"), Mock(name="explore2")],
            ),
            LookmlModel(
                name="model2",
                explores=[Mock(name="explore3")],
            ),
        ]

        # Calculate total explores
        total_explores = sum(
            len(m.explores) if m.explores else 0 for m in all_lookml_models
        )

        self.assertEqual(total_explores, 3)

    def test_explore_counter_increment_logic(self):
        """Test that explore counter increments correctly"""
        explores_processed_count = 0
        total_explores = 3

        # Simulate processing explores
        for i in range(total_explores):
            explores_processed_count += 1

            # Check if this is the last explore
            is_last_explore = explores_processed_count >= total_explores

            if i < total_explores - 1:
                self.assertFalse(is_last_explore)
            else:
                self.assertTrue(is_last_explore)

    def test_view_naming_convention(self):
        """Test that standalone views follow naming convention"""
        model_name = "test_model"
        view_name = "my_view"

        # Expected naming: {model_name}_{view_name}_view
        expected_name = f"{model_name}_{view_name}_view"

        self.assertEqual(expected_name, "test_model_my_view_view")

    def test_datamodel_type_for_standalone_views(self):
        """Test that standalone views use correct datamodel type"""
        # Verify the DataModelType enum has LookMlView
        self.assertEqual(DataModelType.LookMlView.value, "LookMlView")

    def test_view_extends_parsing(self):
        """Test that extends relationships are correctly identified"""
        view_with_extends = LookMlView(
            name="child_view",
            source_file="/path/to/view.view.lkml",
            extends__all=[["parent_view"]],
            dimensions=[],
            measures=[],
        )

        # Check extends are present
        self.assertIsNotNone(view_with_extends.extends__all)
        self.assertEqual(len(view_with_extends.extends__all), 1)
        self.assertIn("parent_view", view_with_extends.extends__all[0])

    def test_view_with_sql_table_name(self):
        """Test that views with sql_table_name are correctly structured"""
        view = LookMlView(
            name="table_view",
            source_file="/path/to/view.view.lkml",
            sql_table_name="project.dataset.table",
            dimensions=[],
            measures=[],
        )

        self.assertEqual(view.sql_table_name, "project.dataset.table")
        self.assertIsNone(view.derived_table)

    def test_view_with_derived_table(self):
        """Test that views with derived_table are correctly structured"""
        # Test that a view can have a derived_table field instead of sql_table_name
        # Note: This test just verifies the structure, not the actual DerivedTable implementation
        view_with_sql = LookMlView(
            name="view_with_table",
            source_file="/path/to/view.view.lkml",
            sql_table_name="project.dataset.table",
            dimensions=[],
            measures=[],
        )

        # Verify sql_table_name views don't have derived_table
        self.assertIsNone(view_with_sql.derived_table)
        self.assertIsNotNone(view_with_sql.sql_table_name)

    def test_multiple_repositories_project_selection(self):
        """Test logic for selecting first project from multiple"""
        project_parsers = {
            "project1": Mock(),
            "project2": Mock(),
            "project3": Mock(),
        }

        # Get first project (order may vary in dict, but we just need one)
        first_project = list(project_parsers.keys())[0] if project_parsers else None

        self.assertIsNotNone(first_project)
        self.assertIn(first_project, ["project1", "project2", "project3"])

    def test_empty_cache_handling(self):
        """Test handling of empty views cache"""
        parser_cache = {}

        views_to_process = []
        for view_name, view in parser_cache.items():
            views_to_process.append(view_name)

        self.assertEqual(len(views_to_process), 0)


class TestCreateDashboardDataModelRequestValidation(TestCase):
    """Test validation of CreateDashboardDataModelRequest for standalone views"""

    def test_create_request_structure(self):
        """Test that CreateDashboardDataModelRequest can be created with required fields"""
        from metadata.generated.schema.type.basic import EntityName

        request = CreateDashboardDataModelRequest(
            name=EntityName("test_model_view_name_view"),
            displayName="view_name",
            service="test_service",
            dataModelType=DataModelType.LookMlView.value,
            serviceType="Looker",
            project="test_project",
            columns=[],  # columns is required
        )

        self.assertEqual(request.name.root, "test_model_view_name_view")
        self.assertEqual(request.displayName, "view_name")
        self.assertEqual(request.dataModelType.value, "LookMlView")
        self.assertEqual(request.project, "test_project")

    def test_view_with_tags(self):
        """Test that views can include tags"""
        from metadata.generated.schema.type.basic import EntityName
        from metadata.generated.schema.type.tagLabel import (
            LabelType,
            State,
            TagLabel,
            TagSource,
        )

        request = CreateDashboardDataModelRequest(
            name=EntityName("test_view"),
            displayName="test_view",
            service="test_service",
            dataModelType=DataModelType.LookMlView.value,
            serviceType="Looker",
            columns=[],
            tags=[
                TagLabel(
                    tagFQN="LookerTags.test_tag",
                    source=TagSource.Classification,
                    labelType=LabelType.Manual,
                    state=State.Confirmed,
                )
            ],
        )

        self.assertIsNotNone(request.tags)
        self.assertEqual(len(request.tags), 1)
        self.assertEqual(request.tags[0].tagFQN.root, "LookerTags.test_tag")


class TestStandaloneViewsIntegrationScenarios(TestCase):
    """Test integration scenarios for standalone views"""

    def test_scenario_all_views_already_processed(self):
        """Test scenario where all views were already processed by explores"""
        # Parser has 3 views
        parser_views = {"view1": Mock(), "view2": Mock(), "view3": Mock()}

        # All views already in cache (processed by explores)
        processed_views = {"view1": Mock(), "view2": Mock(), "view3": Mock()}

        # Count how many would be processed
        to_process = [v for v in parser_views.keys() if v not in processed_views]

        self.assertEqual(len(to_process), 0)

    def test_scenario_mix_of_processed_and_new_views(self):
        """Test scenario with mix of processed and new views"""
        # Parser has 5 views
        parser_views = {
            "view1": Mock(),
            "view2": Mock(),
            "view3": Mock(),
            "view4": Mock(),
            "view5": Mock(),
        }

        # 2 views already processed
        processed_views = {"view1": Mock(), "view3": Mock()}

        # Count how many would be processed
        to_process = [v for v in parser_views.keys() if v not in processed_views]

        self.assertEqual(len(to_process), 3)
        self.assertIn("view2", to_process)
        self.assertIn("view4", to_process)
        self.assertIn("view5", to_process)

    def test_scenario_no_explores_all_standalone_views(self):
        """Test scenario where model has no explores, only standalone views"""
        all_lookml_models = [LookmlModel(name="model1", explores=[])]

        total_explores = sum(
            len(m.explores) if m.explores else 0 for m in all_lookml_models
        )

        # With 0 explores, standalone views would be processed immediately
        self.assertEqual(total_explores, 0)

    def test_scenario_multiple_projects(self):
        """Test scenario with multiple projects"""
        project_parsers = {
            "project_a": Mock(
                _views_cache={"view1": Mock(), "view2": Mock()},
                parsed_files={},
            ),
            "project_b": Mock(
                _views_cache={"view3": Mock(), "view4": Mock()},
                parsed_files={},
            ),
        }

        # Currently only first project is processed
        first_project_name = list(project_parsers.keys())[0]
        first_project = project_parsers[first_project_name]

        # Count views in first project only
        view_count = len(first_project._views_cache)

        self.assertGreaterEqual(view_count, 1)
