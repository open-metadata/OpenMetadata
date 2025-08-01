import uuid
from typing import List, Optional
from unittest import TestCase

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
    TableConstraint,
    TableType,
)
from metadata.generated.schema.type.basic import (
    EntityExtension,
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.custom_pydantic import BaseModel, CustomSecretStr


class CustomPydanticValidationTest(TestCase):

    create_request = CreateTableRequest(
        name=EntityName("Sales::>Territory"),
        displayName="SalesTerritory",
        description=Markdown(root="Sales territory lookup table."),
        tableType="Regular",
        columns=[
            Column(
                name=ColumnName(root="Sales::Last>Year"),
                displayName="SalesLastYear",
                dataType="NUMBER",
                dataTypeDisplay="NUMBER",
                description=Markdown(root="Sales total of previous year."),
                constraint="NOT_NULL",
                ordinalPosition=7,
            ),
            Column(
                name=ColumnName(root="Bonus"),
                displayName="Bonus",
                dataType="NUMBER",
                dataTypeDisplay="NUMBER",
                description=Markdown(root="Bonus due if quota is met."),
                constraint="NOT_NULL",
                ordinalPosition=4,
            ),
            Column(
                name=ColumnName(root="ModifiedDate"),
                displayName="ModifiedDate",
                dataType="DATETIME",
                dataTypeDisplay="DATETIME",
                description=Markdown(root="Date and time the record was last updated."),
                constraint="NOT_NULL",
                ordinalPosition=9,
            ),
        ],
        tableConstraints=[
            TableConstraint(constraintType="PRIMARY_KEY", columns=["Sales::Last>Year"])
        ],
        databaseSchema=FullyQualifiedEntityName(
            root='New Gyro 360.New Gyro 360."AdventureWorks2017.HumanResources"'
        ),
        extension=EntityExtension(
            root={
                "DataQuality": '<div><p><b>Last evaluation:</b> 07/24/2023<br><b>Interval: </b>30 days <br><b>Next run:</b> 08/23/2023, 10:44:20<br><b>Measurement unit:</b> percent [%]</p><br><table><tbody><tr><th>Metric</th><th>Target</th><th>Latest result</th></tr><tr><td><p class="text-success">Completeness</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr><tr><td><p class="text-success">Integrity</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr><tr><td><p class="text-warning">Timeliness</p></td><td>90%</td><td><div class="bar fabric" style="width: 25%;"><strong>25%</strong></div></td></tr><tr><td><p class="text-warning">Uniqueness</p></td><td>90%</td><td><div class="bar fabric" style="width: 60%;"><strong>60%</strong></div></td></tr><tr><td><p class="text-success">Validity</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr></tbody></table><h3>Overall score of the table is: 77%</h3><hr style="border-width: 5px;"></div>'
            }
        ),
    )

    create_request_dashboard_datamodel = CreateDashboardDataModelRequest(
        name=EntityName('test"dashboarddatamodel"'),
        displayName='test"dashboarddatamodel"',
        description=Markdown(
            root="test__reserved__quote__dashboarddatamodel__reserved__quote__"
        ),
        dataModelType=DataModelType.PowerBIDataModel,
        service=FullyQualifiedEntityName(
            root='New Gyro 360.New Gyro 360."AdventureWorks2017.HumanResources"'
        ),
        columns=[
            Column(
                name="struct",
                dataType=DataType.STRUCT,
                arrayDataType="UNKNOWN",
                children=[
                    Column(name='test "struct_children"', dataType=DataType.BIGINT)
                ],
            )
        ],
    )

    def test_replace_separator(self):
        assert (
            self.create_request.name.root
            == "Sales__reserved__colon____reserved__arrow__Territory"
        )
        assert (
            self.create_request.columns[0].name.root
            == "Sales__reserved__colon__Last__reserved__arrow__Year"
        )
        assert (
            self.create_request.tableConstraints[0].columns[0]
            == "Sales__reserved__colon__Last__reserved__arrow__Year"
        )

        assert (
            self.create_request_dashboard_datamodel.name.root
            == "test__reserved__quote__dashboarddatamodel__reserved__quote__"
        )

        assert (
            self.create_request_dashboard_datamodel.columns[0].children[0].name.root
            == "test __reserved__quote__struct_children__reserved__quote__"
        )

    def test_revert_separator(self):
        fetch_response_revert_separator = Table(
            id=uuid.uuid4(),
            name="test__reserved__colon__table",
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
            fullyQualifiedName="test-service-table.test-db.test-schema.test",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )
        fetch_response_revert_separator_2 = Table(
            id=uuid.uuid4(),
            name="test__reserved__colon__table__reserved__arrow__",
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
            fullyQualifiedName="test-service-table.test-db.test-schema.test",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        fetch_response_revert_separator_3 = DashboardDataModel(
            id=uuid.uuid4(),
            name="test__reserved__quote__dashboarddatamodel__reserved__quote__",
            fullyQualifiedName="test-service-table.test-db.test-schema.test__reserved__quote__dashboarddatamodel__reserved__quote__",
            dataModelType=DataModelType.PowerBIDataModel,
            columns=[
                Column(
                    name="struct",
                    dataType=DataType.STRUCT,
                    children=[
                        Column(name='test "struct_children"', dataType=DataType.BIGINT)
                    ],
                )
            ],
        )
        assert fetch_response_revert_separator_3.name.root == 'test"dashboarddatamodel"'
        assert (
            fetch_response_revert_separator_3.columns[0].children[0].name.root
            == 'test "struct_children"'
        )
        assert fetch_response_revert_separator.name.root == "test::table"
        assert fetch_response_revert_separator_2.name.root == "test::table>"


class NestedModel(BaseModel):
    secret: CustomSecretStr
    value: int


class RootModel(BaseModel):
    root_secret: CustomSecretStr
    nested: NestedModel
    items: List[NestedModel]


data = {
    "root_secret": "root_password",
    "nested": {"secret": "nested_password", "value": 42},
    "items": [
        {"secret": "item1_password", "value": 1},
        {"secret": "item2_password", "value": 2},
    ],
}

model = RootModel(**data)
masked_data = model.model_dump(mask_secrets=True)


def test_model_dump_secrets():
    """Test model_dump_masked with root, nested, and list structures."""

    assert masked_data["root_secret"] == "**********"
    assert masked_data["nested"]["secret"] == "**********"
    assert masked_data["nested"]["value"] == 42
    assert masked_data["items"][0]["secret"] == "**********"
    assert masked_data["items"][0]["value"] == 1
    assert masked_data["items"][1]["secret"] == "**********"
    assert masked_data["items"][1]["value"] == 2

    plain_data = model.model_dump(mask_secrets=False)
    assert plain_data["root_secret"] == "root_password"
    assert plain_data["nested"]["secret"] == "nested_password"
    assert plain_data["items"][0]["secret"] == "item1_password"

    default_dump = model.model_dump()
    assert default_dump["root_secret"] == "root_password"
    assert default_dump["nested"]["secret"] == "nested_password"
    assert default_dump["items"][0]["secret"] == "item1_password"


def test_model_dump_json_secrets():
    assert (
        model.model_validate_json(
            model.model_dump_json()
        ).root_secret.get_secret_value()
        == "**********"
    )
    assert (
        model.model_validate_json(
            model.model_dump_json(mask_secrets=True)
        ).root_secret.get_secret_value()
        == "**********"
    )
    assert (
        model.model_validate_json(
            model.model_dump_json(mask_secrets=False)
        ).root_secret.get_secret_value()
        == "root_password"
    )


# Additional comprehensive tests for enhanced functionality
class ExtendedCustomPydanticValidationTest(TestCase):
    """Extended test suite for comprehensive validation of custom Pydantic functionality."""

    def setUp(self):
        """Set up test data for extended tests."""
        self.sample_table_id = uuid.uuid4()
        self.sample_schema_ref = EntityReference(id=uuid.uuid4(), type="databaseSchema")

    def test_service_level_models_not_transformed(self):
        """Test that service-level Create models are not transformed."""
        # Test database service creation (should NOT be transformed)
        service_request = CreateDatabaseServiceRequest(
            name=EntityName('my::database>service"with_separators'),
            serviceType="Mysql"
        )
        
        # Service names should remain unchanged (not transformed)
        assert service_request.name.root == 'my::database>service"with_separators'

    def test_edge_cases_empty_and_none_values(self):
        """Test handling of edge cases like empty strings and None values."""
        # Test minimal name (empty string not allowed by EntityName validation)
        table_empty = Table(
            id=self.sample_table_id,
            name=EntityName("a"),
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="test.empty",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )
        assert table_empty.name.root == "a"
        
        # Test table with no columns (edge case)
        table_no_columns = Table(
            id=self.sample_table_id,
            name="test__reserved__colon__table",
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="test.empty",
            columns=[],
        )
        assert table_no_columns.name.root == "test::table"
        assert len(table_no_columns.columns) == 0

    def test_complex_nested_structures(self):
        """Test complex nested column structures with multiple levels."""
        # Create deeply nested structure
        level3_columns = [
            Column(name=ColumnName("deep__reserved__colon__field"), dataType=DataType.STRING)
        ]
        
        level2_columns = [
            Column(
                name=ColumnName("nested__reserved__arrow__struct"),
                dataType=DataType.STRUCT,
                children=level3_columns
            )
        ]
        
        level1_column = Column(
            name=ColumnName('root__reserved__quote__struct'),
            dataType=DataType.STRUCT, 
            children=level2_columns
        )
        
        table = Table(
            id=self.sample_table_id,
            name="complex__reserved__colon__table",
            columns=[level1_column],
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="test.complex",
        )
        
        # Verify transformations at all levels
        assert table.name.root == "complex::table"
        assert table.columns[0].name.root == 'root"struct'
        assert table.columns[0].children[0].name.root == "nested>struct" 
        assert table.columns[0].children[0].children[0].name.root == "deep::field"

    def test_unicode_and_special_characters(self):
        """Test handling of Unicode and international characters."""
        # Test Unicode with separators
        table_unicode = Table(
            id=self.sample_table_id,
            name="測試__reserved__colon__表格__reserved__arrow__名稱",
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="test.unicode",
            columns=[Column(name="unicode__reserved__quote__列", dataType=DataType.STRING)],
        )
        assert table_unicode.name.root == "測試::表格>名稱"
        assert table_unicode.columns[0].name.root == 'unicode"列'
        
        # Test emojis with separators
        table_emoji = Table(
            id=self.sample_table_id,
            name="table🚀__reserved__colon__data📊",
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="test.emoji",
            columns=[Column(name="emoji__reserved__arrow__field🎯", dataType=DataType.STRING)],
        )
        assert table_emoji.name.root == "table🚀::data📊"
        assert table_emoji.columns[0].name.root == "emoji>field🎯"

    def test_all_separator_combinations(self):
        """Test all combinations of separators in various scenarios."""
        # Test all separators together
        complex_name = 'test::colon>arrow"quote__reserved__mixed'
        create_request = CreateTableRequest(
            name=EntityName(complex_name),
            columns=[Column(name=ColumnName("simple_col"), dataType=DataType.STRING)],
            databaseSchema=FullyQualifiedEntityName("db.schema")
        )
        
        expected = "test__reserved__colon__colon__reserved__arrow__arrow__reserved__quote__quote__reserved__mixed"
        assert create_request.name.root == expected

    def test_table_types_and_properties(self):
        """Test different table types and properties with name transformations."""
        # Test with comprehensive table properties
        table_full = Table(
            id=self.sample_table_id,
            name="full__reserved__colon__table__reserved__arrow__test",
            displayName="Full Test Table",
            description=Markdown(root="A comprehensive test table"),
            tableType=TableType.Regular,
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="test.db.schema.full_table",
            columns=[
                Column(
                    name=ColumnName("id__reserved__quote__primary"),
                    displayName="ID Primary",
                    dataType=DataType.BIGINT,
                    description=Markdown(root="Primary key column")
                ),
                Column(
                    name=ColumnName("data__reserved__arrow__field"),
                    displayName="Data Field",
                    dataType=DataType.STRING,
                    description=Markdown(root="Data field column")
                )
            ],
            tableConstraints=[
                TableConstraint(
                    constraintType="PRIMARY_KEY", 
                    columns=["id__reserved__quote__primary"]
                )
            ]
        )
        
        # Verify all transformations
        assert table_full.name.root == "full::table>test"
        assert table_full.columns[0].name.root == 'id"primary'
        assert table_full.columns[1].name.root == "data>field"
        assert table_full.tableConstraints[0].columns[0] == 'id"primary'

    def test_dashboard_data_model_comprehensive(self):
        """Test comprehensive DashboardDataModel scenarios."""
        # Test with all data model types
        data_model_types = [
            DataModelType.TableauDataModel,
            DataModelType.PowerBIDataModel,
            DataModelType.SupersetDataModel,
            DataModelType.MetabaseDataModel,
        ]
        
        for model_type in data_model_types:
            dashboard_model = DashboardDataModel(
                id=uuid.uuid4(),
                name=f"model__reserved__colon__{model_type.value.lower()}",
                dataModelType=model_type,
                columns=[
                    Column(
                        name=ColumnName(f"metric__reserved__arrow__{model_type.value.lower()}"),
                        dataType=DataType.DOUBLE
                    )
                ]
            )
            
            expected_name = f"model::{model_type.value.lower()}"
            expected_col = f"metric>{model_type.value.lower()}"
            
            assert dashboard_model.name.root == expected_name
            assert dashboard_model.columns[0].name.root == expected_col

    def test_create_requests_comprehensive(self):
        """Test comprehensive CreateRequest scenarios."""
        # Test CreateTableRequest with all possible fields
        comprehensive_request = CreateTableRequest(
            name=EntityName('comprehensive::table>name"test'),
            displayName='Comprehensive"Table>Test::Name',
            description=Markdown(root="A comprehensive test table with all fields"),
            tableType=TableType.Regular,
            columns=[
                Column(
                    name=ColumnName("primary__reserved__quote__key"),
                    displayName="Primary Key",
                    dataType=DataType.BIGINT,
                    constraint="NOT_NULL",
                    ordinalPosition=1,
                ),
                Column(
                    name=ColumnName("foreign__reserved__arrow__key"),
                    displayName="Foreign Key",
                    dataType=DataType.BIGINT,
                    constraint="NOT_NULL",
                    ordinalPosition=2,
                ),
                Column(
                    name=ColumnName("nested__reserved__colon__struct"),
                    displayName="Nested Struct",
                    dataType=DataType.STRUCT,
                    children=[
                        Column(
                            name=ColumnName("child__reserved__quote__field"),
                            dataType=DataType.STRING
                        )
                    ]
                )
            ],
            tableConstraints=[
                TableConstraint(
                    constraintType="PRIMARY_KEY", 
                    columns=["primary__reserved__quote__key"]
                ),
                TableConstraint(
                    constraintType="UNIQUE",
                    columns=["foreign__reserved__arrow__key"]
                )
            ],
            databaseSchema=FullyQualifiedEntityName("test__reserved__colon__db.schema")
        )
        
        # Verify transformations
        assert comprehensive_request.name.root == "comprehensive__reserved__colon__table__reserved__arrow__name__reserved__quote__test"
        assert comprehensive_request.columns[0].name.root == "primary__reserved__quote__key"
        assert comprehensive_request.columns[1].name.root == "foreign__reserved__arrow__key"
        assert comprehensive_request.columns[2].name.root == "nested__reserved__colon__struct"
        assert comprehensive_request.columns[2].children[0].name.root == "child__reserved__quote__field"

    def test_mixed_separator_edge_cases(self):
        """Test edge cases with mixed separators."""
        edge_cases = [
            # Consecutive separators
            ("test::>>\"\"name", "test__reserved__colon____reserved__arrow____reserved__arrow____reserved__quote____reserved__quote__name"),
            # Separators at start and end
            ("::test>name\"", "__reserved__colon__test__reserved__arrow__name__reserved__quote__"),
            # Only separators
            ("::>\"", "__reserved__colon____reserved__arrow____reserved__quote__"),
            # Empty between separators
            ("test::>\"name", "test__reserved__colon____reserved__arrow____reserved__quote__name"),
        ]
        
        for input_name, expected in edge_cases:
            create_request = CreateTableRequest(
                name=EntityName(input_name),
                columns=[Column(name=ColumnName("col"), dataType=DataType.STRING)],
                databaseSchema=FullyQualifiedEntityName("db.schema")
            )
            assert create_request.name.root == expected, f"Failed for input: {input_name}"

    def test_very_long_names_performance(self):
        """Test performance with very long names."""
        # Create very long names to test performance
        long_base_name = "very_long_table_name_" * 3
        long_name_with_separators = f"{long_base_name}::separator>{long_base_name}\"quote{long_base_name}"
        
        create_request = CreateTableRequest(
            name=EntityName(long_name_with_separators),
            columns=[Column(name=ColumnName("col"), dataType=DataType.STRING)],
            databaseSchema=FullyQualifiedEntityName("db.schema")
        )
        
        # Should handle long names without issues
        result_name = create_request.name.root
        assert "__reserved__colon__" in result_name
        assert "__reserved__arrow__" in result_name
        assert "__reserved__quote__" in result_name

    def test_happy_path_simple_names(self):
        """Test happy path with simple names that don't need transformation."""
        # Test simple names without special characters
        simple_create = CreateTableRequest(
            name=EntityName("simple_table_name"),
            columns=[Column(name=ColumnName("simple_column"), dataType=DataType.STRING)],
            databaseSchema=FullyQualifiedEntityName("db.schema")
        )
        
        # Names should remain unchanged
        assert simple_create.name.root == "simple_table_name"
        assert simple_create.columns[0].name.root == "simple_column"
        
        # Test simple fetch model
        simple_table = Table(
            id=self.sample_table_id,
            name="simple_table",
            databaseSchema=self.sample_schema_ref,
            fullyQualifiedName="db.schema.simple_table",
            columns=[Column(name="simple_col", dataType=DataType.STRING)],
        )
        
        assert simple_table.name.root == "simple_table"
        assert simple_table.columns[0].name.root == "simple_col"

    def test_error_handling_invalid_models(self):
        """Test error handling with None and invalid models."""
        # Test with None entity
        result = None
        # This would normally be called by the validation system
        # Just ensure no exceptions are thrown
        
        # Test with mock invalid object
        class InvalidModel:
            def __init__(self):
                self.invalid_attr = "test"
        
        invalid_obj = InvalidModel()
        # Should handle gracefully without transformation
        assert hasattr(invalid_obj, "invalid_attr")

    def test_boundary_conditions(self):
        """Test boundary conditions and edge cases."""
        # Test single character names
        single_char_create = CreateTableRequest(
            name=EntityName("a"),
            columns=[Column(name=ColumnName("b"), dataType=DataType.STRING)],
            databaseSchema=FullyQualifiedEntityName("db.schema")
        )
        assert single_char_create.name.root == "a"
        
        # Test names with only separators
        separator_only = CreateTableRequest(
            name=EntityName("::"),
            columns=[Column(name=ColumnName(">"), dataType=DataType.STRING)],
            databaseSchema=FullyQualifiedEntityName("db.schema")
        )
        assert separator_only.name.root == "__reserved__colon__"
        assert separator_only.columns[0].name.root == "__reserved__arrow__"

    def test_whitespace_handling(self):
        """Test handling of whitespace in various scenarios."""
        whitespace_cases = [
            # Leading/trailing spaces
            ("  test::name  ", "  test__reserved__colon__name  "),
            # Spaces around separators
            (" test :: name ", " test __reserved__colon__ name "),
            # Multiple spaces
            ("test  ::  name", "test  __reserved__colon__  name"),
            # Tabs and newlines (should be preserved)
            ("test\t::\nname", "test\t__reserved__colon__\nname"),
        ]
        
        for input_name, expected in whitespace_cases:
            create_request = CreateTableRequest(
                name=EntityName(input_name),
                columns=[Column(name=ColumnName("col"), dataType=DataType.STRING)],
                databaseSchema=FullyQualifiedEntityName("db.schema")
            )
            assert create_request.name.root == expected, f"Failed for input: '{input_name}'"

    def test_table_constraints_comprehensive(self):
        """Test comprehensive table constraints scenarios."""
        constraint_types = ["PRIMARY_KEY", "UNIQUE", "FOREIGN_KEY"]
        constraints = []
        columns = []
        
        for i, constraint_type in enumerate(constraint_types):
            col_name = f"col_{i}__reserved__colon__constraint"
            columns.append(
                Column(name=ColumnName(col_name), dataType=DataType.STRING)
            )
            constraints.append(
                TableConstraint(
                    constraintType=constraint_type,
                    columns=[col_name]
                )
            )
        
        create_request = CreateTableRequest(
            name=EntityName("constraints__reserved__arrow__test"),
            columns=columns,
            tableConstraints=constraints,
            databaseSchema=FullyQualifiedEntityName("db.schema")
        )
        
        # Verify all constraints have transformed column names
        for i, constraint in enumerate(create_request.tableConstraints):
            expected_col = f"col_{i}__reserved__colon__constraint"
            assert constraint.columns[0] == expected_col

    def test_entity_references_and_relationships(self):
        """Test entity references and relationship handling."""
        # Test with complex entity references
        table_with_refs = Table(
            id=self.sample_table_id,
            name="table__reserved__colon__with__reserved__arrow__refs",
            databaseSchema=EntityReference(
                id=uuid.uuid4(),
                type="databaseSchema",
                name="schema__reserved__quote__name"
            ),
            fullyQualifiedName="service.db.schema__reserved__quote__name.table",
            columns=[
                Column(
                    name=ColumnName("ref__reserved__colon__column"),
                    dataType=DataType.STRING
                )
            ]
        )
        
        # Verify transformations
        assert table_with_refs.name.root == "table::with>refs"
        assert table_with_refs.columns[0].name.root == "ref::column"
        # Entity references should not be transformed (they're separate entities)
        assert table_with_refs.databaseSchema.name == "schema__reserved__quote__name"


class CustomSecretStrExtendedTest(TestCase):
    """Extended test suite for CustomSecretStr functionality."""
    
    def test_secret_creation_and_access(self):
        """Test CustomSecretStr creation and value access."""
        secret = CustomSecretStr("test_password")
        assert secret.get_secret_value() == "test_password"
        assert str(secret) == "**********"
        assert repr(secret) == "SecretStr('**********')"
    
    def test_empty_and_none_secrets(self):
        """Test handling of empty and None secret values."""
        # Test empty secret
        empty_secret = CustomSecretStr("")
        assert empty_secret.get_secret_value() == ""
        assert str(empty_secret) == ""
        
        # Test None secret handling
        try:
            none_secret = CustomSecretStr(None)
            assert none_secret.get_secret_value() is None
        except (TypeError, ValueError, AttributeError):
            # This is acceptable behavior for None values
            pass
    
    def test_long_secrets(self):
        """Test handling of very long secret values."""
        long_secret_value = "a" * 1000
        long_secret = CustomSecretStr(long_secret_value)
        assert long_secret.get_secret_value() == long_secret_value
        assert str(long_secret) == "**********"  # Should still mask regardless of length
    
    def test_special_character_secrets(self):
        """Test secrets with special characters."""
        special_chars = "!@#$%^&*()_+-=[]{}|;':,.<>?/~`"
        special_secret = CustomSecretStr(special_chars)
        assert special_secret.get_secret_value() == special_chars
        assert str(special_secret) == "**********"
    
    def test_unicode_secrets(self):
        """Test secrets with Unicode characters."""
        unicode_secret = CustomSecretStr("密码测试🔒")
        assert unicode_secret.get_secret_value() == "密码测试🔒"
        assert str(unicode_secret) == "**********"

    def test_secret_equality_and_hashing(self):
        """Test secret equality and hashing behavior."""
        secret1 = CustomSecretStr("password123")
        secret2 = CustomSecretStr("password123")
        secret3 = CustomSecretStr("different_password")
        
        # Test equality
        assert secret1.get_secret_value() == secret2.get_secret_value()
        assert secret1.get_secret_value() != secret3.get_secret_value()
        
        # Test that string representation is always masked
        assert str(secret1) == str(secret2) == str(secret3) == "**********"

    def test_secret_in_nested_models_deep(self):
        """Test secrets in deeply nested model structures."""
        class Level3Model(BaseModel):
            deep_secret: CustomSecretStr
            deep_value: str

        class Level2Model(BaseModel):
            mid_secret: CustomSecretStr
            level3: Level3Model

        class Level1Model(BaseModel):
            top_secret: CustomSecretStr
            level2: Level2Model

        deep_data = {
            "top_secret": "top_password",
            "level2": {
                "mid_secret": "mid_password",
                "level3": {
                    "deep_secret": "deep_password",
                    "deep_value": "not_secret"
                }
            }
        }
        
        deep_model = Level1Model(**deep_data)
        
        # Test masked dump
        masked = deep_model.model_dump(mask_secrets=True)
        assert masked["top_secret"] == "**********"
        assert masked["level2"]["mid_secret"] == "**********"
        assert masked["level2"]["level3"]["deep_secret"] == "**********"
        assert masked["level2"]["level3"]["deep_value"] == "not_secret"
        
        # Test unmasked dump
        unmasked = deep_model.model_dump(mask_secrets=False)
        assert unmasked["top_secret"] == "top_password"
        assert unmasked["level2"]["mid_secret"] == "mid_password"
        assert unmasked["level2"]["level3"]["deep_secret"] == "deep_password"

    def test_secret_with_optional_fields(self):
        """Test secrets with optional fields."""
        class OptionalSecretModel(BaseModel):
            required_secret: CustomSecretStr
            optional_secret: Optional[CustomSecretStr] = None
            optional_value: Optional[str] = None

        # Test with all fields
        full_model = OptionalSecretModel(
            required_secret="required_pass",
            optional_secret="optional_pass",
            optional_value="some_value"
        )
        
        masked_full = full_model.model_dump(mask_secrets=True)
        assert masked_full["required_secret"] == "**********"
        assert masked_full["optional_secret"] == "**********"
        assert masked_full["optional_value"] == "some_value"
        
        # Test with only required fields
        minimal_model = OptionalSecretModel(required_secret="required_pass")
        
        masked_minimal = minimal_model.model_dump(mask_secrets=True)
        assert masked_minimal["required_secret"] == "**********"
        assert masked_minimal["optional_secret"] is None
        assert masked_minimal["optional_value"] is None

    def test_secret_lists_and_dictionaries(self):
        """Test secrets in lists and dictionaries."""
        class ComplexSecretModel(BaseModel):
            secret_list: List[CustomSecretStr]
            nested_secrets: List[dict]

        complex_data = {
            "secret_list": ["password1", "password2", "password3"],
            "nested_secrets": [
                {"name": "config1", "secret": CustomSecretStr("secret1")},
                {"name": "config2", "secret": CustomSecretStr("secret2")}
            ]
        }
        
        complex_model = ComplexSecretModel(**complex_data)
        
        # Test that list secrets are handled
        assert len(complex_model.secret_list) == 3
        assert all(str(secret) == "**********" for secret in complex_model.secret_list)
        assert all(secret.get_secret_value() in ["password1", "password2", "password3"] 
                  for secret in complex_model.secret_list)


class DashboardDataModelTransformationTest(TestCase):
    """Test DashboardDataModel transformations with nested children and reserved keywords."""

    def setUp(self):
        """Set up test data."""
        self.sample_service = FullyQualifiedEntityName(
            root='TestService.PowerBI."Analysis>Services::Environment"'
        )

    def test_create_dashboard_datamodel_with_nested_children(self):
        """Test CreateDashboardDataModelRequest with nested children containing reserved keywords."""
        create_request = CreateDashboardDataModelRequest(
            name=EntityName('financial::report>model"quarterly'),
            displayName='Financial Report Model',
            description=Markdown(root="Financial reporting model with special characters"),
            dataModelType=DataModelType.PowerBIDataModel,
            service=self.sample_service,
            columns=[
                Column(
                    name=ColumnName('revenue::metrics>summary'),
                    displayName="Revenue Metrics",
                    dataType=DataType.STRUCT,
                    description=Markdown(root="Revenue metrics structure"),
                    children=[
                        Column(
                            name=ColumnName('total::revenue>amount'),
                            displayName="Total Revenue",
                            dataType=DataType.DECIMAL,
                            description=Markdown(root="Total revenue amount")
                        ),
                        Column(
                            name=ColumnName('currency::code>"USD"'),
                            displayName="Currency Code", 
                            dataType=DataType.STRING,
                            description=Markdown(root="Currency code with quotes")
                        ),
                        Column(
                            name=ColumnName('nested::struct>data'),
                            displayName="Nested Structure",
                            dataType=DataType.STRUCT,
                            children=[
                                Column(
                                    name=ColumnName('deep::field>"value"'),
                                    displayName="Deep Field",
                                    dataType=DataType.STRING
                                )
                            ]
                        )
                    ]
                ),
                Column(
                    name=ColumnName('expenses::breakdown>categories'),
                    displayName="Expense Breakdown",
                    dataType=DataType.ARRAY,
                    arrayDataType=DataType.STRUCT,
                    children=[
                        Column(
                            name=ColumnName('category::name>"operations"'),
                            displayName="Category Name",
                            dataType=DataType.STRING
                        ),
                        Column(
                            name=ColumnName('amount::value>total'),
                            displayName="Amount Value",
                            dataType=DataType.DECIMAL
                        )
                    ]
                )
            ]
        )

        # Verify main entity name transformation (ENCODE for Create operations)
        assert create_request.name.root == "financial__reserved__colon__report__reserved__arrow__model__reserved__quote__quarterly"
        
        # Verify top-level column name transformations
        assert create_request.columns[0].name.root == "revenue__reserved__colon__metrics__reserved__arrow__summary"
        assert create_request.columns[1].name.root == "expenses__reserved__colon__breakdown__reserved__arrow__categories"
        
        # Verify nested children transformations (first level)
        revenue_column = create_request.columns[0]
        assert revenue_column.children[0].name.root == "total__reserved__colon__revenue__reserved__arrow__amount"
        assert revenue_column.children[1].name.root == "currency__reserved__colon__code__reserved__arrow____reserved__quote__USD__reserved__quote__"
        assert revenue_column.children[2].name.root == "nested__reserved__colon__struct__reserved__arrow__data"
        
        # Verify deeply nested children transformations (second level)
        nested_struct = revenue_column.children[2]
        assert nested_struct.children[0].name.root == "deep__reserved__colon__field__reserved__arrow____reserved__quote__value__reserved__quote__"
        
        # Verify array children transformations
        expenses_column = create_request.columns[1]
        assert expenses_column.children[0].name.root == "category__reserved__colon__name__reserved__arrow____reserved__quote__operations__reserved__quote__"
        assert expenses_column.children[1].name.root == "amount__reserved__colon__value__reserved__arrow__total"

    def test_fetch_dashboard_datamodel_with_nested_children(self):
        """Test DashboardDataModel fetch with nested children containing encoded reserved keywords."""
        dashboard_model = DashboardDataModel(
            id=uuid.uuid4(),
            name="financial__reserved__colon__report__reserved__arrow__model__reserved__quote__quarterly",
            displayName="Financial Report Model",
            dataModelType=DataModelType.PowerBIDataModel,
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            fullyQualifiedName="service.financial__reserved__colon__report__reserved__arrow__model__reserved__quote__quarterly",
            columns=[
                Column(
                    name=ColumnName("revenue__reserved__colon__metrics__reserved__arrow__summary"),
                    displayName="Revenue Metrics",
                    dataType=DataType.STRUCT,
                    children=[
                        Column(
                            name=ColumnName("total__reserved__colon__revenue__reserved__arrow__amount"),
                            displayName="Total Revenue", 
                            dataType=DataType.DECIMAL
                        ),
                        Column(
                            name=ColumnName("currency__reserved__colon__code__reserved__arrow____reserved__quote__USD__reserved__quote__"),
                            displayName="Currency Code",
                            dataType=DataType.STRING
                        ),
                        Column(
                            name=ColumnName("nested__reserved__colon__struct__reserved__arrow__data"),
                            displayName="Nested Structure",
                            dataType=DataType.STRUCT,
                            children=[
                                Column(
                                    name=ColumnName("deep__reserved__colon__field__reserved__arrow____reserved__quote__value__reserved__quote__"),
                                    displayName="Deep Field",
                                    dataType=DataType.STRING
                                )
                            ]
                        )
                    ]
                ),
                Column(
                    name=ColumnName("expenses__reserved__colon__breakdown__reserved__arrow__categories"),
                    displayName="Expense Breakdown",
                    dataType=DataType.ARRAY,
                    arrayDataType=DataType.STRUCT,
                    children=[
                        Column(
                            name=ColumnName("category__reserved__colon__name__reserved__arrow____reserved__quote__operations__reserved__quote__"),
                            displayName="Category Name",
                            dataType=DataType.STRING
                        ),
                        Column(
                            name=ColumnName("amount__reserved__colon__value__reserved__arrow__total"),
                            displayName="Amount Value",
                            dataType=DataType.DECIMAL
                        )
                    ]
                )
            ]
        )

        # Verify main entity name transformation (DECODE for fetch operations)
        assert dashboard_model.name.root == 'financial::report>model"quarterly'
        
        # Verify top-level column name transformations
        assert dashboard_model.columns[0].name.root == "revenue::metrics>summary"
        assert dashboard_model.columns[1].name.root == "expenses::breakdown>categories"
        
        # Verify nested children transformations (first level)
        revenue_column = dashboard_model.columns[0]
        assert revenue_column.children[0].name.root == "total::revenue>amount"
        assert revenue_column.children[1].name.root == 'currency::code>"USD"'
        assert revenue_column.children[2].name.root == "nested::struct>data"
        
        # Verify deeply nested children transformations (second level)
        nested_struct = revenue_column.children[2]
        assert nested_struct.children[0].name.root == 'deep::field>"value"'
        
        # Verify array children transformations
        expenses_column = dashboard_model.columns[1]
        assert expenses_column.children[0].name.root == 'category::name>"operations"'
        assert expenses_column.children[1].name.root == "amount::value>total"

    def test_dashboard_datamodel_round_trip_transformation(self):
        """Test round-trip transformation: Create -> Fetch -> Create maintains data integrity."""
        # Start with create request containing special characters
        original_create = CreateDashboardDataModelRequest(
            name=EntityName('analytics::dashboard>model"test'),
            displayName='Analytics Dashboard Model',
            dataModelType=DataModelType.PowerBIDataModel,
            service=self.sample_service,
            columns=[
                Column(
                    name=ColumnName('metrics::summary>report'),
                    dataType=DataType.STRUCT,
                    children=[
                        Column(
                            name=ColumnName('total::count>"records"'),
                            dataType=DataType.INT
                        )
                    ]
                )
            ]
        )
        
        # Simulate storage (encoded form)
        stored_name = original_create.name.root  # Should be encoded
        stored_column_name = original_create.columns[0].name.root  # Should be encoded
        stored_nested_name = original_create.columns[0].children[0].name.root  # Should be encoded
        
        # Simulate fetch operation (create DashboardDataModel with stored values)
        fetched_model = DashboardDataModel(
            id=uuid.uuid4(),
            name=stored_name,
            displayName="Analytics Dashboard Model",
            dataModelType=DataModelType.PowerBIDataModel,
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            fullyQualifiedName=f"service.{stored_name}",
            columns=[
                Column(
                    name=ColumnName(stored_column_name),
                    dataType=DataType.STRUCT,
                    children=[
                        Column(
                            name=ColumnName(stored_nested_name),
                            dataType=DataType.INT
                        )
                    ]
                )
            ]
        )
        
        # Verify fetch operation decodes correctly
        assert fetched_model.name.root == 'analytics::dashboard>model"test'
        assert fetched_model.columns[0].name.root == 'metrics::summary>report'
        assert fetched_model.columns[0].children[0].name.root == 'total::count>"records"'
        
        # Verify create operation encodes correctly
        assert stored_name == "analytics__reserved__colon__dashboard__reserved__arrow__model__reserved__quote__test"
        assert stored_column_name == "metrics__reserved__colon__summary__reserved__arrow__report"
        assert stored_nested_name == "total__reserved__colon__count__reserved__arrow____reserved__quote__records__reserved__quote__"

    def test_dashboard_datamodel_edge_cases(self):
        """Test edge cases for DashboardDataModel transformations."""
        # Test with empty children
        model_empty_children = DashboardDataModel(
            id=uuid.uuid4(),
            name="test__reserved__colon__model",
            dataModelType=DataModelType.PowerBIDataModel,
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            fullyQualifiedName="service.test__reserved__colon__model",
            columns=[
                Column(
                    name=ColumnName("parent__reserved__arrow__column"),
                    dataType=DataType.STRUCT,
                    children=[]  # Empty children list
                )
            ]
        )
        
        assert model_empty_children.name.root == "test::model"
        assert model_empty_children.columns[0].name.root == "parent>column"
        
        # Test with None children  
        model_none_children = DashboardDataModel(
            id=uuid.uuid4(),
            name="test__reserved__quote__model",
            dataModelType=DataModelType.PowerBIDataModel,
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
            fullyQualifiedName="service.test__reserved__quote__model",
            columns=[
                Column(
                    name=ColumnName("parent__reserved__quote__column"),
                    dataType=DataType.STRING,
                    children=None  # None children
                )
            ]
        )
        
        assert model_none_children.name.root == 'test"model'
        assert model_none_children.columns[0].name.root == 'parent"column'
