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
OpenMetadata high-level API Custom Properties Test
"""
from typing import Dict

import pytest

from metadata.generated.schema.api.data.createCustomProperty import (
    CreateCustomPropertyRequest,
)
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.basic import EntityExtension
from metadata.generated.schema.type.customProperties.enumConfig import EnumConfig
from metadata.generated.schema.type.customProperty import (
    CustomPropertyConfig,
    EntityTypes,
    Format,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.custom_properties import (
    CustomPropertyDataTypes,
    OMetaCustomProperties,
)
from metadata.utils.constants import ENTITY_REFERENCE_TYPE_MAP

from ..conftest import _safe_delete
from ..integration_base import generate_name, get_create_service

EXPECTED_CUSTOM_PROPERTIES = [
    {
        "name": "DataEngineers",
        "description": "Data Engineers of a table",
        "propertyType": {
            "name": "entityReferenceList",
        },
        "customPropertyConfig": {"config": ["user"]},
    },
    {
        "name": "DataQuality",
        "description": "Quality Details of a Table",
        "propertyType": {
            "name": "markdown",
        },
    },
    {
        "name": "Department",
        "description": "Department of a table",
        "propertyType": {
            "type": "type",
            "name": "enum",
        },
        "customPropertyConfig": {
            "config": {"values": ["D1", "D2", "D3"], "multiSelect": True}
        },
    },
    {
        "name": "Rating",
        "description": "Rating of a table",
        "propertyType": {"name": "enum"},
        "customPropertyConfig": {
            "config": {"values": ["Average", "Bad", "Good"], "multiSelect": False},
        },
    },
    {
        "name": "TableSize",
        "description": "Size of the Table",
        "propertyType": {"name": "string"},
    },
]


def _create_custom_properties(metadata):
    """Create all standard custom properties on the Table and DatabaseSchema types."""
    metadata.create_or_update_custom_property(
        ometa_custom_property=OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="TableSize",
                description="Size of the Table",
                propertyType=metadata.get_property_type_ref(
                    CustomPropertyDataTypes.STRING
                ),
            ),
        )
    )

    metadata.create_or_update_custom_property(
        ometa_custom_property=OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="DataQuality",
                description="Quality Details of a Table",
                propertyType=metadata.get_property_type_ref(
                    CustomPropertyDataTypes.MARKDOWN
                ),
            ),
        )
    )

    metadata.create_or_update_custom_property(
        ometa_custom_property=OMetaCustomProperties(
            entity_type=DatabaseSchema,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="SchemaAge",
                description="Age in years of a Schema",
                propertyType=metadata.get_property_type_ref(
                    CustomPropertyDataTypes.INTEGER
                ),
            ),
        )
    )

    metadata.create_or_update_custom_property(
        ometa_custom_property=OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="Rating",
                description="Rating of a table",
                propertyType=metadata.get_property_type_ref(
                    CustomPropertyDataTypes.ENUM
                ),
                customPropertyConfig=CustomPropertyConfig(
                    config=EnumConfig(
                        multiSelect=False, values=["Good", "Average", "Bad"]
                    )
                ),
            ),
        )
    )

    metadata.create_or_update_custom_property(
        ometa_custom_property=OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="Department",
                description="Department of a table",
                propertyType=metadata.get_property_type_ref(
                    CustomPropertyDataTypes.ENUM
                ),
                customPropertyConfig=CustomPropertyConfig(
                    config=EnumConfig(multiSelect=True, values=["D1", "D2", "D3"])
                ),
            ),
        )
    )

    metadata.create_or_update_custom_property(
        ometa_custom_property=OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="DataEngineers",
                description="Data Engineers of a table",
                propertyType=metadata.get_property_type_ref(
                    CustomPropertyDataTypes.ENTITY_REFERENCE_LIST
                ),
                customPropertyConfig=CustomPropertyConfig(
                    config=EntityTypes(root=[ENTITY_REFERENCE_TYPE_MAP[User.__name__]])
                ),
            ),
        )
    )


def _create_date_time_custom_properties(metadata):
    """Create date/time custom properties on the Table type."""
    metadata.create_or_update_custom_property(
        ometa_custom_property=OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="CreationDate",
                description="Date when the table was created",
                propertyType=metadata.get_property_type_ref(
                    CustomPropertyDataTypes.DATE
                ),
                customPropertyConfig=CustomPropertyConfig(config=Format("yyyy-MM-dd")),
            ),
        )
    )

    metadata.create_or_update_custom_property(
        ometa_custom_property=OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="LastModifiedDateTime",
                description="Date and time when the table was last modified",
                propertyType=metadata.get_property_type_ref(
                    CustomPropertyDataTypes.DATETIME
                ),
                customPropertyConfig=CustomPropertyConfig(
                    config=Format("yyyy-MM-dd'T'HH:mm:ss'Z'")
                ),
            ),
        )
    )

    metadata.create_or_update_custom_property(
        ometa_custom_property=OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="DailyBackupTime",
                description="Time when daily backup occurs",
                propertyType=metadata.get_property_type_ref(
                    CustomPropertyDataTypes.TIME
                ),
                customPropertyConfig=CustomPropertyConfig(config=Format("HH:mm:ss")),
            ),
        )
    )


def _create_table(metadata, schema_fqn, name: str, extensions: Dict) -> Table:
    """Helper to create a table with custom property extensions."""
    create = CreateTableRequest(
        name=name,
        databaseSchema=schema_fqn,
        columns=[Column(name="id", dataType=DataType.BIGINT)],
        extension=EntityExtension(root=extensions),
    )
    return metadata.create_or_update(create)


@pytest.fixture(scope="module")
def cp_service(metadata):
    """Module-scoped database service for custom properties tests."""
    service_name = generate_name()
    create_service = get_create_service(entity=DatabaseService, name=service_name)
    service_entity = metadata.create_or_update(data=create_service)

    yield service_entity

    _safe_delete(
        metadata,
        entity=DatabaseService,
        entity_id=service_entity.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def cp_database(metadata, cp_service):
    """Module-scoped database for custom properties tests."""
    db_name = generate_name()
    create_db = CreateDatabaseRequest(
        name=db_name,
        service=cp_service.fullyQualifiedName,
    )
    return metadata.create_or_update(data=create_db)


@pytest.fixture(scope="module")
def cp_schema(metadata, cp_database):
    """Module-scoped schema for custom properties tests."""
    schema_name = generate_name()
    create_schema = CreateDatabaseSchemaRequest(
        name=schema_name,
        database=cp_database.fullyQualifiedName,
    )
    return metadata.create_or_update(data=create_schema)


@pytest.fixture(scope="module")
def cp_user_one_ref(metadata):
    """First user entity reference for custom property tests."""
    user_name = generate_name()
    user = metadata.create_or_update(
        data=CreateUserRequest(name=user_name, email=f"{user_name.root}@user.com"),
    )
    yield EntityReference(
        id=user.id,
        name=user.name.root,
        type="user",
        fullyQualifiedName=user.fullyQualifiedName.root,
    )
    metadata.delete(entity=User, entity_id=user.id, hard_delete=True)


@pytest.fixture(scope="module")
def cp_user_two_ref(metadata):
    """Second user entity reference for custom property tests."""
    user_name = generate_name()
    user = metadata.create_or_update(
        data=CreateUserRequest(name=user_name, email=f"{user_name.root}@user.com"),
    )
    yield EntityReference(
        id=user.id,
        name=user.name.root,
        type="user",
        fullyQualifiedName=user.fullyQualifiedName.root,
    )
    metadata.delete(entity=User, entity_id=user.id, hard_delete=True)


class TestOMetaCustomPropertiesAPI:
    """
    Custom Properties API integration tests.
    Tests creation and assignment of custom properties to entity types.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    def test_add_custom_property_schema(self, metadata, cp_schema, cp_database):
        """
        Test to add the extension/custom property to the schema
        """
        _create_custom_properties(metadata)

        extensions = {"SchemaAge": 3}

        schema_name = generate_name()
        create_schema = CreateDatabaseSchemaRequest(
            name=schema_name,
            database=cp_database.fullyQualifiedName,
            extension=EntityExtension(root=extensions),
        )
        schema_entity = metadata.create_or_update(data=create_schema)

        res = metadata.get_by_name(
            entity=DatabaseSchema,
            fqn=schema_entity.fullyQualifiedName.root,
            fields=["*"],
        )
        assert res.extension.root["SchemaAge"] == extensions["SchemaAge"]

    def test_add_custom_property_table(
        self, metadata, cp_schema, cp_user_one_ref, cp_user_two_ref
    ):
        """
        Test to add the extension/custom property to the table
        """
        _create_custom_properties(metadata)

        extensions = {
            "DataQuality": '<div><p><b>Last evaluation:</b> 07/24/2023<br><b>Interval: </b>30 days <br><b>Next run:</b> 08/23/2023, 10:44:21<br><b>Measurement unit:</b> percent [%]</p><br><table><tbody><tr><th>Metric</th><th>Target</th><th>Latest result</th></tr><tr><td><p class="text-success">Completeness</p></td><td>90%</td><td><div class="bar fabric" style="width: 93%;"><strong>93%</strong></div></td></tr><tr><td><p class="text-success">Integrity</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr><tr><td><p class="text-warning">Timeliness</p></td><td>90%</td><td><div class="bar fabric" style="width: 56%;"><strong>56%</strong></div></td></tr><tr><td><p class="text-success">Uniqueness</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr><tr><td><p class="text-success">Validity</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr></tbody></table><h3>Overall score of the table is: 89%</h3><hr style="border-width: 5px;"></div>',
            "TableSize": "250 MB",
            "Rating": ["Good"],
            "Department": ["D1", "D2"],
            "DataEngineers": [cp_user_one_ref, cp_user_two_ref],
        }

        table_name = generate_name()
        table = _create_table(
            metadata,
            cp_schema.fullyQualifiedName,
            name=table_name.root,
            extensions=extensions,
        )

        res = metadata.get_by_name(
            entity=Table,
            fqn=table.fullyQualifiedName.root,
            fields=["*"],
        )
        assert res.extension.root["DataQuality"] == extensions["DataQuality"]
        assert res.extension.root["TableSize"] == extensions["TableSize"]
        assert res.extension.root["Rating"] == extensions["Rating"]
        assert res.extension.root["Department"] == extensions["Department"]
        assert res.extension.root["DataEngineers"][0]["id"] == str(
            extensions["DataEngineers"][0].id.root
        )
        assert res.extension.root["DataEngineers"][1]["id"] == str(
            extensions["DataEngineers"][1].id.root
        )

    def test_all_custom_property_data_types(self, metadata):
        """
        Test creating custom properties for all available data types
        """
        test_cases = [
            (
                CustomPropertyDataTypes.STRING,
                "TestString",
                "String test property",
                None,
            ),
            (
                CustomPropertyDataTypes.INTEGER,
                "TestInteger",
                "Integer test property",
                None,
            ),
            (
                CustomPropertyDataTypes.MARKDOWN,
                "TestMarkdown",
                "Markdown test property",
                None,
            ),
            (
                CustomPropertyDataTypes.DATE,
                "TestDate",
                "Date test property",
                "yyyy-MM-dd",
            ),
            (
                CustomPropertyDataTypes.DATETIME,
                "TestDateTime",
                "DateTime test property",
                "yyyy-MM-dd HH:mm:ss",
            ),
            (
                CustomPropertyDataTypes.TIME,
                "TestTime",
                "Time test property",
                "HH:mm:ss",
            ),
            (
                CustomPropertyDataTypes.DURATION,
                "TestDuration",
                "Duration test property",
                None,
            ),
            (CustomPropertyDataTypes.EMAIL, "TestEmail", "Email test property", None),
            (
                CustomPropertyDataTypes.NUMBER,
                "TestNumber",
                "Number test property",
                None,
            ),
            (
                CustomPropertyDataTypes.SQLQUERY,
                "TestSqlQuery",
                "SQL Query test property",
                None,
            ),
            (
                CustomPropertyDataTypes.TIMEINTERVAL,
                "TestTimeInterval",
                "Time Interval test property",
                None,
            ),
            (
                CustomPropertyDataTypes.TIMESTAMP,
                "TestTimestamp",
                "Timestamp test property",
                None,
            ),
        ]

        for data_type, name, description, custom_property_config in test_cases:
            create_custom_property_request = CreateCustomPropertyRequest(
                name=name,
                description=description,
                propertyType=metadata.get_property_type_ref(data_type),
            )
            if custom_property_config:
                create_custom_property_request.customPropertyConfig = (
                    CustomPropertyConfig(config=Format(custom_property_config))
                )
            property_request = OMetaCustomProperties(
                entity_type=Table,
                createCustomPropertyRequest=create_custom_property_request,
            )

            result = metadata.create_or_update_custom_property(
                ometa_custom_property=property_request
            )
            assert result is not None

        custom_properties = metadata.get_entity_custom_properties(entity_type=Table)
        created_properties = {cp["name"]: cp for cp in custom_properties}

        for data_type, name, description, _ in test_cases:
            assert name in created_properties
            prop = created_properties[name]
            assert prop["description"] == description
            assert prop["propertyType"]["name"] == data_type.value

    def test_custom_property_data_types_completeness(self, metadata):
        """
        Test that all CustomPropertyDataTypes enum members are properly defined
        """
        for data_type in CustomPropertyDataTypes:
            assert isinstance(data_type.value, str)
            assert len(data_type.value) > 0

        date_time_types = [
            CustomPropertyDataTypes.DATE,
            CustomPropertyDataTypes.DATETIME,
            CustomPropertyDataTypes.TIME,
        ]

        for data_type in date_time_types:
            assert data_type.value.endswith("-cp")

        non_cp_types = [
            CustomPropertyDataTypes.STRING,
            CustomPropertyDataTypes.INTEGER,
            CustomPropertyDataTypes.MARKDOWN,
            CustomPropertyDataTypes.DURATION,
            CustomPropertyDataTypes.EMAIL,
            CustomPropertyDataTypes.NUMBER,
            CustomPropertyDataTypes.SQLQUERY,
            CustomPropertyDataTypes.TIMEINTERVAL,
            CustomPropertyDataTypes.TIMESTAMP,
            CustomPropertyDataTypes.ENUM,
            CustomPropertyDataTypes.ENTITY_REFERENCE,
            CustomPropertyDataTypes.ENTITY_REFERENCE_LIST,
        ]

        for data_type in non_cp_types:
            assert not data_type.value.endswith("-cp")

    def test_custom_property_data_types_enum_values(self, metadata):
        """
        Test that CustomPropertyDataTypes enum has correct values, especially for date/time types
        """
        assert CustomPropertyDataTypes.STRING.value == "string"
        assert CustomPropertyDataTypes.INTEGER.value == "integer"
        assert CustomPropertyDataTypes.MARKDOWN.value == "markdown"
        assert CustomPropertyDataTypes.DATE.value == "date-cp"
        assert CustomPropertyDataTypes.DATETIME.value == "dateTime-cp"
        assert CustomPropertyDataTypes.TIME.value == "time-cp"
        assert CustomPropertyDataTypes.DURATION.value == "duration"
        assert CustomPropertyDataTypes.EMAIL.value == "email"
        assert CustomPropertyDataTypes.NUMBER.value == "number"
        assert CustomPropertyDataTypes.SQLQUERY.value == "sqlQuery"
        assert CustomPropertyDataTypes.TIMEINTERVAL.value == "timeInterval"
        assert CustomPropertyDataTypes.TIMESTAMP.value == "timestamp"
        assert CustomPropertyDataTypes.ENUM.value == "enum"
        assert CustomPropertyDataTypes.ENTITY_REFERENCE.value == "entityReference"
        assert (
            CustomPropertyDataTypes.ENTITY_REFERENCE_LIST.value == "entityReferenceList"
        )

    def test_custom_property_enum_backwards_compatibility(self, metadata):
        """
        Test that the enum values work correctly with property type references
        """
        date_type_ref = metadata.get_property_type_ref(CustomPropertyDataTypes.DATE)
        datetime_type_ref = metadata.get_property_type_ref(
            CustomPropertyDataTypes.DATETIME
        )
        time_type_ref = metadata.get_property_type_ref(CustomPropertyDataTypes.TIME)

        assert date_type_ref is not None
        assert datetime_type_ref is not None
        assert time_type_ref is not None

        assert date_type_ref.root.id is not None
        assert date_type_ref.root.type == "type"
        assert datetime_type_ref.root.id is not None
        assert datetime_type_ref.root.type == "type"
        assert time_type_ref.root.id is not None
        assert time_type_ref.root.type == "type"

    def test_custom_property_mixed_data_types(self, metadata, cp_schema):
        """
        Test creating a table with mixed custom property data types
        """
        properties_to_create = [
            (CustomPropertyDataTypes.STRING, "Description", "Table description"),
            (CustomPropertyDataTypes.INTEGER, "RowCount", "Number of rows"),
            (CustomPropertyDataTypes.DATE, "CreatedDate", "Creation date"),
            (CustomPropertyDataTypes.DATETIME, "LastUpdated", "Last update timestamp"),
            (CustomPropertyDataTypes.TIME, "BackupTime", "Backup time"),
            (CustomPropertyDataTypes.EMAIL, "Owner", "Owner email"),
            (CustomPropertyDataTypes.NUMBER, "SizeGB", "Size in GB"),
        ]

        for data_type, name, description in properties_to_create:
            create_request = CreateCustomPropertyRequest(
                name=name,
                description=description,
                propertyType=metadata.get_property_type_ref(data_type),
            )

            if data_type in [
                CustomPropertyDataTypes.DATE,
                CustomPropertyDataTypes.DATETIME,
                CustomPropertyDataTypes.TIME,
            ]:
                if data_type == CustomPropertyDataTypes.DATE:
                    create_request.customPropertyConfig = CustomPropertyConfig(
                        config=Format("yyyy-MM-dd")
                    )
                elif data_type == CustomPropertyDataTypes.DATETIME:
                    create_request.customPropertyConfig = CustomPropertyConfig(
                        config=Format("yyyy-MM-dd'T'HH:mm:ss'Z'")
                    )
                elif data_type == CustomPropertyDataTypes.TIME:
                    create_request.customPropertyConfig = CustomPropertyConfig(
                        config=Format("HH:mm:ss")
                    )

            property_request = OMetaCustomProperties(
                entity_type=Table,
                createCustomPropertyRequest=create_request,
            )

            metadata.create_or_update_custom_property(
                ometa_custom_property=property_request
            )

        extensions = {
            "Description": "This is a test table",
            "RowCount": 1000,
            "CreatedDate": "2023-01-01",
            "LastUpdated": "2023-12-01T15:30:00Z",
            "BackupTime": "03:00:00",
            "Owner": "test@example.com",
            "SizeGB": 2.5,
        }

        table_name = generate_name()
        table = _create_table(
            metadata,
            cp_schema.fullyQualifiedName,
            name=table_name.root,
            extensions=extensions,
        )

        res = metadata.get_by_name(
            entity=Table,
            fqn=table.fullyQualifiedName.root,
            fields=["*"],
        )

        for key, expected_value in extensions.items():
            assert res.extension.root[key] == expected_value

    def test_custom_property_type_ref_error_handling(self, metadata):
        """
        Test error handling when using invalid custom property types
        """
        for data_type in CustomPropertyDataTypes:
            type_ref = metadata.get_property_type_ref(data_type)
            assert type_ref is not None
            assert type_ref.root.id is not None
            assert type_ref.root.type == "type"

    def test_custom_property_with_date_time_values(self, metadata, cp_schema):
        """
        Test adding actual date/time values to custom properties
        """
        _create_date_time_custom_properties(metadata)

        extensions = {
            "CreationDate": "2023-12-01",
            "LastModifiedDateTime": "2023-12-01T10:30:00Z",
            "DailyBackupTime": "02:00:00",
        }

        table_name = generate_name()
        table = _create_table(
            metadata,
            cp_schema.fullyQualifiedName,
            name=table_name.root,
            extensions=extensions,
        )

        res = metadata.get_by_name(
            entity=Table,
            fqn=table.fullyQualifiedName.root,
            fields=["*"],
        )

        assert res.extension.root["CreationDate"] == extensions["CreationDate"]
        assert (
            res.extension.root["LastModifiedDateTime"]
            == extensions["LastModifiedDateTime"]
        )
        assert res.extension.root["DailyBackupTime"] == extensions["DailyBackupTime"]

    def test_date_time_custom_properties(self, metadata):
        """
        Test creating custom properties with date/time types using the updated enum values
        """
        _create_date_time_custom_properties(metadata)

        custom_properties = metadata.get_entity_custom_properties(entity_type=Table)

        date_prop = next(
            (cp for cp in custom_properties if cp["name"] == "CreationDate"), None
        )
        datetime_prop = next(
            (cp for cp in custom_properties if cp["name"] == "LastModifiedDateTime"),
            None,
        )
        time_prop = next(
            (cp for cp in custom_properties if cp["name"] == "DailyBackupTime"), None
        )

        assert date_prop is not None
        assert datetime_prop is not None
        assert time_prop is not None

        assert date_prop["propertyType"]["name"] == "date-cp"
        assert datetime_prop["propertyType"]["name"] == "dateTime-cp"
        assert time_prop["propertyType"]["name"] == "time-cp"

    def test_get_custom_property(self, metadata):
        """
        Test getting the custom properties for an entity
        """
        _create_custom_properties(metadata)

        custom_properties = metadata.get_entity_custom_properties(entity_type=Table)

        actual_custom_properties = []
        for expected_custom_property in EXPECTED_CUSTOM_PROPERTIES:
            for custom_property in custom_properties:
                if expected_custom_property["name"] == custom_property["name"]:
                    actual_custom_properties.append(custom_property)
                    assert custom_property["name"] == expected_custom_property["name"]
                    assert (
                        custom_property["description"]
                        == expected_custom_property["description"]
                    )
                    assert custom_property.get(
                        "customPropertyConfig"
                    ) == expected_custom_property.get("customPropertyConfig")
                    assert (
                        custom_property["propertyType"]["name"]
                        == expected_custom_property["propertyType"]["name"]
                    )
        assert len(actual_custom_properties) == len(EXPECTED_CUSTOM_PROPERTIES)
