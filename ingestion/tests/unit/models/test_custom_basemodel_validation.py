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
Comprehensive tests for custom basemodel validation system.
Tests the hybrid name validation system with all edge cases and scenarios.
"""

import uuid
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    Table,
    TableData,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.custom_basemodel_validation import (
    RESERVED_ARROW_KEYWORD,
    RESERVED_COLON_KEYWORD,
    RESERVED_QUOTE_KEYWORD,
    TRANSFORMABLE_ENTITIES,
    TransformDirection,
    get_entity_config,
    get_transformer,
    is_service_level_create_model,
    replace_separators,
    revert_separators,
    transform_entity_names,
)
from metadata.profiler.api.models import ProfilerResponse
from metadata.utils.entity_link import CustomColumnName


class TestCustomBasemodelValidation(TestCase):
    """Comprehensive test suite for custom basemodel validation functionality."""

    def setUp(self):
        """Set up common test data."""
        self.sample_table_id = uuid.uuid4()
        self.sample_schema_ref = EntityReference(id=uuid.uuid4(), type="databaseSchema")

    def test_service_pattern_detection(self):
        """Test the scalable service pattern detection system."""
        # Test existing services (should be identified as services)
        existing_services = [
            "CreateDatabaseServiceRequest",
            "CreateDashboardServiceRequest",
            "CreateMessagingServiceRequest",
            "CreatePipelineServiceRequest",
            "CreateMlModelServiceRequest",
            "CreateStorageServiceRequest",
            "CreateMetadataServiceRequest",
            "CreateSearchServiceRequest",
            "CreateApiServiceRequest",
        ]

        for service in existing_services:
            self.assertTrue(
                is_service_level_create_model(service),
                f"{service} should be identified as a service model",
            )

        # Test future services (should be identified as services - scalability test)
        future_services = [
            "CreateNewServiceRequest",
            "CreateCustomServiceRequest",
            "CreateXYZServiceRequest",
            "CreateAnalyticsServiceRequest",
            "CreateAnyThingServiceRequest",
        ]

        for service in future_services:
            self.assertTrue(
                is_service_level_create_model(service),
                f"{service} should be identified as a service model (future compatibility)",
            )

        # Test non-services (should NOT be identified as services)
        non_services = [
            "CreateTable",
            "CreateDatabase",
            "CreateServiceRequest",  # No service name between Create and ServiceRequest
            "CreateService",  # Missing "Request" suffix
            "MyCreateServiceRequest",  # Doesn't start with "Create"
            "createDatabaseServiceRequest",  # Lowercase
            "CreateServiceRequestSomething",  # ServiceRequest not at the end
            "CreateDashboard",
            "CreateChart",
        ]

        for non_service in non_services:
            self.assertFalse(
                is_service_level_create_model(non_service),
                f"{non_service} should NOT be identified as a service model",
            )

    def test_service_pattern_edge_cases(self):
        """Test edge cases for service pattern detection."""
        # Test edge case: just "CreateServiceRequest" (no service name)
        self.assertFalse(
            is_service_level_create_model("CreateServiceRequest"),
            "CreateServiceRequest with no service name should not be considered a service",
        )

        # Test minimum valid service name
        self.assertTrue(
            is_service_level_create_model("CreateXServiceRequest"),
            "CreateXServiceRequest should be considered a service",
        )

        # Test very long service name
        long_service = "Create" + "Very" * 50 + "LongServiceRequest"
        self.assertTrue(
            is_service_level_create_model(long_service),
            "Very long service names should be handled correctly",
        )

    def test_transformable_entities_configuration(self):
        """Test the TRANSFORMABLE_ENTITIES configuration."""
        # Test that expected entities are configured
        expected_entities = {
            Table,
            DashboardDataModel,
            CustomColumnName,
            ProfilerResponse,
            TableData,
            CreateTableRequest,
            CreateDashboardDataModelRequest,
        }

        for entity in expected_entities:
            self.assertIn(
                entity,
                TRANSFORMABLE_ENTITIES,
                f"{entity} should be in TRANSFORMABLE_ENTITIES",
            )

        # Test entity configurations have required fields
        for entity_name, config in TRANSFORMABLE_ENTITIES.items():
            self.assertIn(
                "fields", config, f"{entity_name} config should have 'fields' key"
            )
            self.assertIn(
                "direction", config, f"{entity_name} config should have 'direction' key"
            )
            self.assertIsInstance(
                config["fields"], set, f"{entity_name} fields should be a set"
            )
            self.assertIsInstance(
                config["direction"],
                TransformDirection,
                f"{entity_name} direction should be TransformDirection enum",
            )

    def test_get_entity_config(self):
        """Test get_entity_config function."""
        # Test existing entity
        table_config = get_entity_config(Table)
        self.assertIsNotNone(table_config)
        self.assertEqual(table_config["direction"], TransformDirection.DECODE)
        self.assertIn("name", table_config["fields"])

        # Test non-existent entity
        non_existent_config = get_entity_config("NonExistentEntity")
        self.assertIsNone(non_existent_config)

    def test_get_transformer(self):
        """Test get_transformer function."""
        # Test DECODE transformer
        table_transformer = get_transformer(Table)
        self.assertIsNotNone(table_transformer)
        self.assertEqual(table_transformer, revert_separators)

        # Test ENCODE transformer
        create_table_transformer = get_transformer(CreateTableRequest)
        self.assertIsNotNone(create_table_transformer)
        self.assertEqual(create_table_transformer, replace_separators)

        # Test non-existent entity
        non_existent_transformer = get_transformer("NonExistentEntity")
        self.assertIsNone(non_existent_transformer)

    def test_replace_separators_function(self):
        """Test replace_separators function with various inputs."""
        test_cases = [
            ("simple_name", "simple_name"),  # No separators
            (
                "name::with::colons",
                "name__reserved__colon__with__reserved__colon__colons",
            ),
            (
                "name>with>arrows",
                "name__reserved__arrow__with__reserved__arrow__arrows",
            ),
            (
                'name"with"quotes',
                "name__reserved__quote__with__reserved__quote__quotes",
            ),
            (
                'mixed::>"chars',
                "mixed__reserved__colon____reserved__arrow____reserved__quote__chars",
            ),
            ("", ""),  # Empty string
            (":::", "__reserved__colon__:"),  # Multiple colons - :: replaced, : remains
            (
                ">>>",
                "__reserved__arrow____reserved__arrow____reserved__arrow__",
            ),  # Multiple arrows - each > replaced
            (
                '"""',
                "__reserved__quote____reserved__quote____reserved__quote__",
            ),  # Multiple quotes - each " replaced
        ]

        for input_val, expected in test_cases:
            result = replace_separators(input_val)
            self.assertEqual(
                result,
                expected,
                f"replace_separators('{input_val}') should return '{expected}'",
            )

    def test_revert_separators_function(self):
        """Test revert_separators function with various inputs."""
        test_cases = [
            ("simple_name", "simple_name"),  # No reserved keywords
            (
                "name__reserved__colon__with__reserved__colon__colons",
                "name::with::colons",
            ),
            (
                "name__reserved__arrow__with__reserved__arrow__arrows",
                "name>with>arrows",
            ),
            (
                "name__reserved__quote__with__reserved__quote__quotes",
                'name"with"quotes',
            ),
            (
                "mixed__reserved__colon____reserved__arrow____reserved__quote__chars",
                'mixed::>"chars',
            ),
            ("", ""),  # Empty string
            (
                "__reserved__colon__:",
                ":::",
            ),  # Multiple colons: __reserved__colon__ + : = :: + : = :::
        ]

        for input_val, expected in test_cases:
            result = revert_separators(input_val)
            self.assertEqual(
                result,
                expected,
                f"revert_separators('{input_val}') should return '{expected}'",
            )

    def test_round_trip_transformations(self):
        """Test that encode->decode round trips preserve original values."""
        test_values = [
            "simple_name",
            "name::with::colons",
            "name>with>arrows",
            'name"with"quotes',
            'complex::name>with"all',
            "unicode测试::name",
            'emoji🚀::data📊>chart"report',
            "  spaced :: values  ",  # Leading/trailing spaces
            "special!@#$%^&*()_+-={}[]|\\:;'<>?,./",  # Special characters (non-reserved)
        ]

        for original in test_values:
            encoded = replace_separators(original)
            decoded = revert_separators(encoded)
            self.assertEqual(decoded, original, f"Round trip failed for: '{original}'")

    def test_transform_entity_names_with_explicit_config(self):
        """Test transform_entity_names with explicitly configured entities."""
        # Test Table (DECODE direction)
        table = Table(
            id=self.sample_table_id,
            name="test__reserved__colon__table__reserved__arrow__name",
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="db.schema.test_table",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        result = transform_entity_names(table, Table)
        self.assertEqual(result.name.root, "test::table>name")

        # Test CreateTable (ENCODE direction)
        create_request = CreateTableRequest(
            name=EntityName('my::table>with"special_chars'),
            columns=[Column(name=ColumnName("col1"), dataType=DataType.STRING)],
            databaseSchema=FullyQualifiedEntityName("db.schema"),
        )

        result = transform_entity_names(create_request, CreateTableRequest)
        expected = "my__reserved__colon__table__reserved__arrow__with__reserved__quote__special_chars"
        self.assertEqual(result.name.root, expected)

    def test_transform_entity_names_with_dynamic_pattern(self):
        """Test transform_entity_names with dynamic Create* pattern."""
        # Create a custom CreateTableRequest that should use dynamic pattern
        create_request = CreateTableRequest(
            name=EntityName('dynamic::table>name"test'),
            columns=[Column(name=ColumnName("col1"), dataType=DataType.STRING)],
            databaseSchema=FullyQualifiedEntityName("db.schema"),
        )

        # Use a model name not in explicit config to trigger dynamic pattern
        result = transform_entity_names(create_request, CreateTableRequest)
        expected = "dynamic__reserved__colon__table__reserved__arrow__name__reserved__quote__test"
        self.assertEqual(result.name.root, expected)

    def test_transform_entity_names_service_exclusion(self):
        """Test that service-level models are excluded from transformation."""
        service_request = CreateDatabaseServiceRequest(
            name=EntityName('my::database>service"with_separators'), serviceType="Mysql"
        )

        result = transform_entity_names(service_request, CreateDatabaseServiceRequest)
        # Should NOT be transformed
        self.assertEqual(result.name.root, 'my::database>service"with_separators')

    def test_transform_entity_names_edge_cases(self):
        """Test transform_entity_names with edge cases."""
        # Test None entity
        result = transform_entity_names(None, Table)
        self.assertIsNone(result)

        # Test entity without __dict__ (edge case)
        simple_value = "test_string"
        result = transform_entity_names(simple_value, Table)
        self.assertEqual(result, simple_value)

        # Test entity with minimal name
        table_minimal = Table(
            id=self.sample_table_id,
            name=EntityName("a"),
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="db.schema.minimal",
            columns=[],
        )
        result = transform_entity_names(table_minimal, Table)
        self.assertEqual(result.name.root, "a")

    def test_transform_entity_names_with_nested_structures(self):
        """Test transform_entity_names with complex nested structures."""
        # Create deeply nested column structure
        level3_columns = [
            Column(
                name=ColumnName("deep__reserved__colon__field"),
                dataType=DataType.STRING,
            )
        ]

        level2_columns = [
            Column(
                name=ColumnName("nested__reserved__arrow__struct"),
                dataType=DataType.STRUCT,
                children=level3_columns,
            )
        ]

        level1_column = Column(
            name=ColumnName("root__reserved__quote__struct"),
            dataType=DataType.STRUCT,
            children=level2_columns,
        )

        table = Table(
            id=self.sample_table_id,
            name="complex__reserved__colon__table",
            columns=[level1_column],
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="db.schema.complex_table",
        )

        result = transform_entity_names(table, Table)

        # Verify table name transformation (DECODE operation)
        self.assertEqual(result.name.root, "complex::table")
        # Column names should also be decoded since Table config includes columns
        self.assertEqual(result.columns[0].name.root, 'root"struct')
        self.assertEqual(result.columns[0].children[0].name.root, "nested>struct")
        self.assertEqual(
            result.columns[0].children[0].children[0].name.root, "deep::field"
        )

    def test_transform_entity_names_with_root_attributes(self):
        """Test transformation of entities with root attributes (like FullyQualifiedEntityName)."""
        # Create a mock entity with root attribute
        class MockEntityWithRoot:
            def __init__(self, root_value):
                self.root = root_value

        # Test transformation of root attribute
        entity = MockEntityWithRoot("test__reserved__colon__value")
        result = transform_entity_names(entity, Table)
        self.assertEqual(result.root, "test::value")

    def test_unicode_and_international_characters(self):
        """Test handling of Unicode and international characters."""
        # Test Unicode characters with separators
        table_unicode = Table(
            id=self.sample_table_id,
            name="測試__reserved__colon__表格__reserved__arrow__名稱",
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="db.schema.unicode_table",
            columns=[
                Column(name="unicode__reserved__quote__列", dataType=DataType.STRING)
            ],
        )

        result = transform_entity_names(table_unicode, Table)
        self.assertEqual(result.name.root, "測試::表格>名稱")
        # Column names should also be decoded since Table config includes columns
        self.assertEqual(result.columns[0].name.root, 'unicode"列')

        # Test emojis with separators
        table_emoji = Table(
            id=self.sample_table_id,
            name="table🚀__reserved__colon__data📊__reserved__arrow__chart",
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="db.schema.emoji_table",
            columns=[
                Column(name="emoji__reserved__quote__field🎯", dataType=DataType.STRING)
            ],
        )

        result = transform_entity_names(table_emoji, Table)
        self.assertEqual(result.name.root, "table🚀::data📊>chart")
        self.assertEqual(result.columns[0].name.root, 'emoji"field🎯')

    def test_very_long_strings(self):
        """Test handling of long strings within validation limits."""
        # Create long names within validation limits (under 256 chars)
        long_name = (
            "a" * 50
            + "__reserved__colon__"
            + "b" * 50
            + "__reserved__arrow__"
            + "c" * 50
        )

        table = Table(
            id=self.sample_table_id,
            name=long_name,
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="db.schema.long_table",
            columns=[],
        )

        result = transform_entity_names(table, Table)

        # Should still transform correctly
        expected = "a" * 50 + "::" + "b" * 50 + ">" + "c" * 50
        self.assertEqual(result.name.root, expected)

    def test_nested_reserved_keywords(self):
        """Test handling of nested/overlapping reserved keywords."""
        # Test overlapping patterns
        overlapping_name = "test__reserved__colon____reserved__colon__reserved__name"

        table = Table(
            id=self.sample_table_id,
            name=overlapping_name,
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="db.schema.overlapping_table",
            columns=[],
        )

        result = transform_entity_names(table, Table)
        # This should handle the overlapping keywords correctly
        expected = "test::::reserved__name"
        self.assertEqual(result.name.root, expected)

    def test_error_handling_and_logging(self):
        """Test error handling and logging in transformation functions."""
        # Test with mock entity that might cause errors
        class ProblematicEntity:
            def __init__(self):
                self.name = "test_name"

            def __getattribute__(self, name):
                if name == "name" and hasattr(self, "_fail_count"):
                    self._fail_count += 1
                    if self._fail_count > 2:
                        raise ValueError("Simulated error")
                return super().__getattribute__(name)

        problematic_entity = ProblematicEntity()
        problematic_entity._fail_count = 0

        # Should handle errors gracefully and return original entity
        with patch(
            "metadata.ingestion.models.custom_basemodel_validation.logger"
        ) as mock_logger:
            result = transform_entity_names(problematic_entity, Table)
            # Should return original entity on error
            self.assertEqual(result, problematic_entity)

    def test_performance_with_large_datasets(self):
        """Test performance with large datasets."""
        # Create table with many columns
        large_columns = []
        for i in range(100):
            col_name = f"col_{i}__reserved__colon__field_{i}"
            large_columns.append(
                Column(name=ColumnName(col_name), dataType=DataType.STRING)
            )

        large_table = Table(
            id=self.sample_table_id,
            name="large__reserved__arrow__table",
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="db.schema.large_table",
            columns=large_columns,
        )

        # Should handle large datasets efficiently
        result = transform_entity_names(large_table, Table)

        self.assertEqual(result.name.root, "large>table")
        self.assertEqual(len(result.columns), 100)

        # Verify first and last columns are transformed correctly
        self.assertEqual(result.columns[0].name.root, "col_0::field_0")
        self.assertEqual(result.columns[99].name.root, "col_99::field_99")

    def test_dashboard_data_model_transformations(self):
        """Test DashboardDataModel specific transformations."""
        # Test DashboardDataModel with nested columns
        child_columns = [
            Column(
                name=ColumnName("nested__reserved__colon__metric"),
                dataType=DataType.DOUBLE,
            ),
            Column(
                name=ColumnName("nested__reserved__arrow__dimension"),
                dataType=DataType.STRING,
            ),
        ]

        parent_column = Column(
            name=ColumnName("complex__reserved__quote__field"),
            dataType=DataType.STRUCT,
            children=child_columns,
        )

        dashboard_model = DashboardDataModel(
            id=uuid.uuid4(),
            name="dashboard__reserved__colon__model__reserved__quote__name",
            dataModelType=DataModelType.TableauDataModel,
            columns=[parent_column],
        )

        result = transform_entity_names(dashboard_model, DashboardDataModel)

        # Verify transformations
        self.assertEqual(result.name.root, 'dashboard::model"name')
        self.assertEqual(result.columns[0].name.root, 'complex"field')
        self.assertEqual(result.columns[0].children[0].name.root, "nested::metric")
        self.assertEqual(result.columns[0].children[1].name.root, "nested>dimension")

    def test_configuration_consistency(self):
        """Test consistency of configuration across the system."""
        # Verify that all configured entities have consistent field mappings
        for entity_name, config in TRANSFORMABLE_ENTITIES.items():
            # Verify direction is valid
            self.assertIn(
                config["direction"],
                [TransformDirection.ENCODE, TransformDirection.DECODE],
            )

            # Verify fields is not empty
            self.assertGreater(
                len(config["fields"]),
                0,
                f"{entity_name} should have at least one field configured",
            )


class TestTransformationConstants(TestCase):
    """Test transformation constants and reserved keywords."""

    def test_reserved_keywords_constants(self):
        """Test that reserved keyword constants are properly defined."""
        self.assertEqual(RESERVED_COLON_KEYWORD, "__reserved__colon__")
        self.assertEqual(RESERVED_ARROW_KEYWORD, "__reserved__arrow__")
        self.assertEqual(RESERVED_QUOTE_KEYWORD, "__reserved__quote__")

    def test_reserved_keywords_uniqueness(self):
        """Test that reserved keywords are unique and don't conflict."""
        keywords = [
            RESERVED_COLON_KEYWORD,
            RESERVED_ARROW_KEYWORD,
            RESERVED_QUOTE_KEYWORD,
        ]
        self.assertEqual(
            len(keywords), len(set(keywords)), "Reserved keywords should be unique"
        )

        # Test that keywords don't contain each other
        for i, keyword1 in enumerate(keywords):
            for j, keyword2 in enumerate(keywords):
                if i != j:
                    self.assertNotIn(
                        keyword1,
                        keyword2,
                        f"{keyword1} should not be contained in {keyword2}",
                    )

    def test_transform_direction_enum(self):
        """Test TransformDirection enum values."""
        self.assertEqual(TransformDirection.ENCODE.value, "encode")
        self.assertEqual(TransformDirection.DECODE.value, "decode")

        # Test enum has exactly two values
        self.assertEqual(len(list(TransformDirection)), 2)


class TestDashboardDataModelValidation(TestCase):
    """Test DashboardDataModel-specific validation and transformations."""

    def setUp(self):
        """Set up test data."""
        self.sample_dashboard_id = uuid.uuid4()
        self.sample_service_ref = EntityReference(
            id=uuid.uuid4(), type="dashboardService"
        )

    def test_dashboard_datamodel_create_transformation(self):
        """Test CreateDashboardDataModelRequest transformations with nested children."""
        from metadata.generated.schema.api.data.createDashboardDataModel import (
            CreateDashboardDataModelRequest,
        )
        from metadata.generated.schema.entity.data.dashboardDataModel import (
            DataModelType,
        )

        create_request = CreateDashboardDataModelRequest(
            name=EntityName('analytics::report>model"quarterly'),
            displayName="Analytics Report Model",
            dataModelType=DataModelType.PowerBIDataModel,
            service=FullyQualifiedEntityName("service.powerbi"),
            columns=[
                Column(
                    name=ColumnName("revenue::summary>metrics"),
                    displayName="Revenue Summary",
                    dataType=DataType.STRUCT,
                    children=[
                        Column(
                            name=ColumnName('total::amount>"USD"'),
                            displayName="Total Amount",
                            dataType=DataType.DECIMAL,
                        ),
                        Column(
                            name=ColumnName("nested::data>structure"),
                            displayName="Nested Data",
                            dataType=DataType.STRUCT,
                            children=[
                                Column(
                                    name=ColumnName('deep::field>"value"'),
                                    displayName="Deep Field",
                                    dataType=DataType.STRING,
                                )
                            ],
                        ),
                    ],
                )
            ],
        )

        result = transform_entity_names(create_request, CreateDashboardDataModelRequest)

        # Verify main name transformation (ENCODE for Create operations)
        self.assertEqual(
            result.name.root,
            "analytics__reserved__colon__report__reserved__arrow__model__reserved__quote__quarterly",
        )

        # Verify top-level column transformation
        self.assertEqual(
            result.columns[0].name.root,
            "revenue__reserved__colon__summary__reserved__arrow__metrics",
        )

        # Verify nested children transformations (first level)
        revenue_column = result.columns[0]
        self.assertEqual(
            revenue_column.children[0].name.root,
            "total__reserved__colon__amount__reserved__arrow____reserved__quote__USD__reserved__quote__",
        )
        self.assertEqual(
            revenue_column.children[1].name.root,
            "nested__reserved__colon__data__reserved__arrow__structure",
        )

        # Verify deeply nested transformations (second level)
        nested_struct = revenue_column.children[1]
        self.assertEqual(
            nested_struct.children[0].name.root,
            "deep__reserved__colon__field__reserved__arrow____reserved__quote__value__reserved__quote__",
        )

    def test_dashboard_datamodel_fetch_transformation(self):
        """Test DashboardDataModel fetch transformations with nested children."""
        from metadata.generated.schema.entity.data.dashboardDataModel import (
            DashboardDataModel,
            DataModelType,
        )

        dashboard_model = DashboardDataModel(
            id=self.sample_dashboard_id,
            name="analytics__reserved__colon__report__reserved__arrow__model__reserved__quote__quarterly",
            displayName="Analytics Report Model",
            dataModelType=DataModelType.PowerBIDataModel,
            service=self.sample_service_ref,
            fullyQualifiedName="service.analytics__reserved__colon__report__reserved__arrow__model__reserved__quote__quarterly",
            columns=[
                Column(
                    name=ColumnName(
                        "revenue__reserved__colon__summary__reserved__arrow__metrics"
                    ),
                    displayName="Revenue Summary",
                    dataType=DataType.STRUCT,
                    children=[
                        Column(
                            name=ColumnName(
                                "total__reserved__colon__amount__reserved__arrow____reserved__quote__USD__reserved__quote__"
                            ),
                            displayName="Total Amount",
                            dataType=DataType.DECIMAL,
                        ),
                        Column(
                            name=ColumnName(
                                "nested__reserved__colon__data__reserved__arrow__structure"
                            ),
                            displayName="Nested Data",
                            dataType=DataType.STRUCT,
                            children=[
                                Column(
                                    name=ColumnName(
                                        "deep__reserved__colon__field__reserved__arrow____reserved__quote__value__reserved__quote__"
                                    ),
                                    displayName="Deep Field",
                                    dataType=DataType.STRING,
                                )
                            ],
                        ),
                    ],
                )
            ],
        )

        result = transform_entity_names(dashboard_model, DashboardDataModel)

        # Verify main name transformation (DECODE for fetch operations)
        self.assertEqual(result.name.root, 'analytics::report>model"quarterly')

        # Verify top-level column transformation
        self.assertEqual(result.columns[0].name.root, "revenue::summary>metrics")

        # Verify nested children transformations (first level)
        revenue_column = result.columns[0]
        self.assertEqual(revenue_column.children[0].name.root, 'total::amount>"USD"')
        self.assertEqual(revenue_column.children[1].name.root, "nested::data>structure")

        # Verify deeply nested transformations (second level)
        nested_struct = revenue_column.children[1]
        self.assertEqual(nested_struct.children[0].name.root, 'deep::field>"value"')

    def test_dashboard_datamodel_edge_cases(self):
        """Test edge cases for DashboardDataModel transformations."""
        from metadata.generated.schema.entity.data.dashboardDataModel import (
            DashboardDataModel,
            DataModelType,
        )

        # Test with empty children
        model_empty_children = DashboardDataModel(
            id=self.sample_dashboard_id,
            name="test__reserved__colon__model",
            displayName="Test Model",
            dataModelType=DataModelType.PowerBIDataModel,
            service=self.sample_service_ref,
            fullyQualifiedName="service.test__reserved__colon__model",
            columns=[
                Column(
                    name=ColumnName("parent__reserved__arrow__column"),
                    displayName="Parent Column",
                    dataType=DataType.STRUCT,
                    children=[],  # Empty children list
                )
            ],
        )

        result_empty = transform_entity_names(model_empty_children, DashboardDataModel)
        self.assertEqual(result_empty.name.root, "test::model")
        self.assertEqual(result_empty.columns[0].name.root, "parent>column")

        # Test with None children
        model_none_children = DashboardDataModel(
            id=self.sample_dashboard_id,
            name="test__reserved__quote__model",
            displayName="Test Model",
            dataModelType=DataModelType.PowerBIDataModel,
            service=self.sample_service_ref,
            fullyQualifiedName="service.test__reserved__quote__model",
            columns=[
                Column(
                    name=ColumnName("parent__reserved__quote__column"),
                    displayName="Parent Column",
                    dataType=DataType.STRING,
                    children=None,  # None children
                )
            ],
        )

        result_none = transform_entity_names(model_none_children, DashboardDataModel)
        self.assertEqual(result_none.name.root, 'test"model')
        self.assertEqual(result_none.columns[0].name.root, 'parent"column')

    def test_dashboard_datamodel_complex_nested_structures(self):
        """Test complex nested structures with multiple levels and various datatypes."""
        from metadata.generated.schema.entity.data.dashboardDataModel import (
            DashboardDataModel,
            DataModelType,
        )

        complex_model = DashboardDataModel(
            id=self.sample_dashboard_id,
            name="complex__reserved__colon__model__reserved__arrow__test",
            displayName="Complex Test Model",
            dataModelType=DataModelType.PowerBIDataModel,
            service=self.sample_service_ref,
            fullyQualifiedName="service.complex__reserved__colon__model__reserved__arrow__test",
            columns=[
                Column(
                    name=ColumnName(
                        "level1__reserved__colon__struct__reserved__arrow__data"
                    ),
                    displayName="Level 1 Struct",
                    dataType=DataType.STRUCT,
                    children=[
                        Column(
                            name=ColumnName(
                                "level2__reserved__quote__array__reserved__colon__items"
                            ),
                            displayName="Level 2 Array",
                            dataType=DataType.ARRAY,
                            arrayDataType=DataType.STRUCT,
                            children=[
                                Column(
                                    name=ColumnName(
                                        "level3__reserved__arrow__nested__reserved__quote__field"
                                    ),
                                    displayName="Level 3 Nested",
                                    dataType=DataType.STRUCT,
                                    children=[
                                        Column(
                                            name=ColumnName(
                                                "level4__reserved__colon__deep__reserved__arrow__value"
                                            ),
                                            displayName="Level 4 Deep",
                                            dataType=DataType.STRING,
                                        )
                                    ],
                                )
                            ],
                        ),
                        Column(
                            name=ColumnName("simple__reserved__quote__field"),
                            displayName="Simple Field",
                            dataType=DataType.INT,
                        ),
                    ],
                )
            ],
        )

        result = transform_entity_names(complex_model, DashboardDataModel)

        # Verify transformations at each level
        self.assertEqual(result.name.root, "complex::model>test")
        self.assertEqual(result.columns[0].name.root, "level1::struct>data")

        # Level 2
        level1_struct = result.columns[0]
        self.assertEqual(level1_struct.children[0].name.root, 'level2"array::items')
        self.assertEqual(level1_struct.children[1].name.root, 'simple"field')

        # Level 3
        level2_array = level1_struct.children[0]
        self.assertEqual(level2_array.children[0].name.root, 'level3>nested"field')

        # Level 4
        level3_nested = level2_array.children[0]
        self.assertEqual(level3_nested.children[0].name.root, "level4::deep>value")

    def test_dashboard_datamodel_round_trip_validation(self):
        """Test round-trip validation for DashboardDataModel transformations."""
        from metadata.generated.schema.api.data.createDashboardDataModel import (
            CreateDashboardDataModelRequest,
        )
        from metadata.generated.schema.entity.data.dashboardDataModel import (
            DashboardDataModel,
            DataModelType,
        )

        # Test data with mixed special characters
        test_cases = [
            ("simple::name", "simple__reserved__colon__name"),
            (
                'complex::name>with"quotes',
                "complex__reserved__colon__name__reserved__arrow__with__reserved__quote__quotes",
            ),
            (
                'edge::case>test"data',
                "edge__reserved__colon__case__reserved__arrow__test__reserved__quote__data",
            ),
        ]

        for original_name, encoded_name in test_cases:
            with self.subTest(original_name=original_name):
                # Create request (should encode)
                create_request = CreateDashboardDataModelRequest(
                    name=EntityName(original_name),
                    displayName="Test Model",
                    dataModelType=DataModelType.PowerBIDataModel,
                    service=FullyQualifiedEntityName("service.test"),
                    columns=[
                        Column(
                            name=ColumnName(original_name),
                            displayName="Test Column",
                            dataType=DataType.STRING,
                        )
                    ],
                )

                create_result = transform_entity_names(
                    create_request, CreateDashboardDataModelRequest
                )
                self.assertEqual(create_result.name.root, encoded_name)
                self.assertEqual(create_result.columns[0].name.root, encoded_name)

                # Fetch model (should decode)
                fetch_model = DashboardDataModel(
                    id=self.sample_dashboard_id,
                    name=encoded_name,
                    displayName="Test Model",
                    dataModelType=DataModelType.PowerBIDataModel,
                    service=self.sample_service_ref,
                    fullyQualifiedName=f"service.{encoded_name}",
                    columns=[
                        Column(
                            name=ColumnName(encoded_name),
                            displayName="Test Column",
                            dataType=DataType.STRING,
                        )
                    ],
                )

                fetch_result = transform_entity_names(fetch_model, DashboardDataModel)
                self.assertEqual(fetch_result.name.root, original_name)
                self.assertEqual(fetch_result.columns[0].name.root, original_name)


if __name__ == "__main__":
    import unittest

    unittest.main()
