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
from unittest import TestCase

from metadata.generated.schema.api.data.createCustomProperty import (
    CreateCustomPropertyRequest,
)
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.basic import EntityExtension
from metadata.generated.schema.type.customProperties.enumConfig import EnumConfig
from metadata.generated.schema.type.customProperty import (
    CustomPropertyConfig,
    EntityTypes,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.custom_properties import (
    CustomPropertyDataTypes,
    OMetaCustomProperties,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import ENTITY_REFERENCE_TYPE_MAP

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


class OMetaCustomAttributeTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    service = CreateDatabaseServiceRequest(
        name="test-service-custom-properties",
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="username",
                authType=BasicAuth(
                    password="password",
                ),
                hostPort="http://localhost:1234",
            )
        ),
    )
    service_type = "databaseService"

    def create_table(self, name: str, extensions: Dict) -> Table:
        create = CreateTableRequest(
            name=name,
            databaseSchema=self.create_schema_entity.fullyQualifiedName,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
            extension=EntityExtension(root=extensions),
        )
        return self.metadata.create_or_update(create)

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """

        cls.service_entity = cls.metadata.create_or_update(data=cls.service)

        create_db = CreateDatabaseRequest(
            name="test-db",
            service=cls.service_entity.fullyQualifiedName,
        )

        cls.create_db_entity = cls.metadata.create_or_update(data=create_db)

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema",
            database=cls.create_db_entity.fullyQualifiedName,
        )

        cls.create_schema_entity = cls.metadata.create_or_update(data=create_schema)

        user_one: User = cls.metadata.create_or_update(
            data=CreateUserRequest(
                name="custom-prop-user-one", email="custom-prop-user-one@user.com"
            ),
        )
        user_two: User = cls.metadata.create_or_update(
            data=CreateUserRequest(
                name="custom-prop-user-two", email="custom-prop-user-two@user.com"
            ),
        )

        cls.user_one_ref = EntityReference(
            id=user_one.id,
            name="custom-prop-user-one",
            type="user",
            fullyQualifiedName=user_one.fullyQualifiedName.root,
        )
        cls.user_two = EntityReference(
            id=user_two.id,
            name="custom-prop-user-two",
            type="user",
            fullyQualifiedName=user_two.fullyQualifiedName.root,
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """
        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn="test-service-custom-properties"
            ).id.root
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def create_custom_property(self):
        """
        Test to create the custom property
        """

        # Create the table size property
        ometa_custom_property_request = OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="TableSize",
                description="Size of the Table",
                propertyType=self.metadata.get_property_type_ref(
                    CustomPropertyDataTypes.STRING
                ),
            ),
        )
        self.metadata.create_or_update_custom_property(
            ometa_custom_property=ometa_custom_property_request
        )

        # Create the DataQuality property for a table
        ometa_custom_property_request = OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="DataQuality",
                description="Quality Details of a Table",
                propertyType=self.metadata.get_property_type_ref(
                    CustomPropertyDataTypes.MARKDOWN
                ),
            ),
        )
        self.metadata.create_or_update_custom_property(
            ometa_custom_property=ometa_custom_property_request
        )

        # Create the SchemaCost property for database schema
        ometa_custom_property_request = OMetaCustomProperties(
            entity_type=DatabaseSchema,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="SchemaAge",
                description="Age in years of a Schema",
                propertyType=self.metadata.get_property_type_ref(
                    CustomPropertyDataTypes.INTEGER
                ),
            ),
        )
        self.metadata.create_or_update_custom_property(
            ometa_custom_property=ometa_custom_property_request
        )

        # Create single select enum custom property for a table
        ometa_custom_property_request = OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="Rating",
                description="Rating of a table",
                propertyType=self.metadata.get_property_type_ref(
                    CustomPropertyDataTypes.ENUM
                ),
                customPropertyConfig=CustomPropertyConfig(
                    config=EnumConfig(
                        multiSelect=False, values=["Good", "Average", "Bad"]
                    )
                ),
            ),
        )
        self.metadata.create_or_update_custom_property(
            ometa_custom_property=ometa_custom_property_request
        )

        # Create multi select enum custom property for a table
        ometa_custom_property_request = OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="Department",
                description="Department of a table",
                propertyType=self.metadata.get_property_type_ref(
                    CustomPropertyDataTypes.ENUM
                ),
                customPropertyConfig=CustomPropertyConfig(
                    config=EnumConfig(multiSelect=True, values=["D1", "D2", "D3"])
                ),
            ),
        )
        self.metadata.create_or_update_custom_property(
            ometa_custom_property=ometa_custom_property_request
        )

        # Create entity reference list custom property for a table
        ometa_custom_property_request = OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="DataEngineers",
                description="Data Engineers of a table",
                propertyType=self.metadata.get_property_type_ref(
                    CustomPropertyDataTypes.ENTITY_REFERENCE_LIST
                ),
                customPropertyConfig=CustomPropertyConfig(
                    config=EntityTypes(root=[ENTITY_REFERENCE_TYPE_MAP[User.__name__]])
                ),
            ),
        )
        self.metadata.create_or_update_custom_property(
            ometa_custom_property=ometa_custom_property_request
        )

    def test_get_custom_property(self):
        """
        Test getting the custom properties for an entity
        """
        # create the custom properties
        self.create_custom_property()

        custom_properties = self.metadata.get_entity_custom_properties(
            entity_type=Table
        )

        actual_custom_properties = []
        for expected_custom_property in EXPECTED_CUSTOM_PROPERTIES:
            for custom_property in custom_properties:
                if expected_custom_property["name"] == custom_property["name"]:
                    actual_custom_properties.append(custom_property)
                    self.assertEqual(
                        custom_property["name"], expected_custom_property["name"]
                    )
                    self.assertEqual(
                        custom_property["description"],
                        expected_custom_property["description"],
                    )
                    self.assertEqual(
                        custom_property.get("customPropertyConfig"),
                        expected_custom_property.get("customPropertyConfig"),
                    )
                    self.assertEqual(
                        custom_property["propertyType"]["name"],
                        expected_custom_property["propertyType"]["name"],
                    )
        self.assertEqual(len(actual_custom_properties), len(EXPECTED_CUSTOM_PROPERTIES))

    def test_add_custom_property_table(self):
        """
        Test to add the extension/custom property to the table
        """

        # create the custom properties
        self.create_custom_property()

        extensions = {
            "DataQuality": '<div><p><b>Last evaluation:</b> 07/24/2023<br><b>Interval: </b>30 days <br><b>Next run:</b> 08/23/2023, 10:44:21<br><b>Measurement unit:</b> percent [%]</p><br><table><tbody><tr><th>Metric</th><th>Target</th><th>Latest result</th></tr><tr><td><p class="text-success">Completeness</p></td><td>90%</td><td><div class="bar fabric" style="width: 93%;"><strong>93%</strong></div></td></tr><tr><td><p class="text-success">Integrity</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr><tr><td><p class="text-warning">Timeliness</p></td><td>90%</td><td><div class="bar fabric" style="width: 56%;"><strong>56%</strong></div></td></tr><tr><td><p class="text-success">Uniqueness</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr><tr><td><p class="text-success">Validity</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr></tbody></table><h3>Overall score of the table is: 89%</h3><hr style="border-width: 5px;"></div>',
            "TableSize": "250 MB",
            "Rating": ["Good"],
            "Department": ["D1", "D2"],
            "DataEngineers": [self.user_one_ref, self.user_two],
        }

        self.create_table(name="test_custom_properties", extensions=extensions)

        res = self.metadata.get_by_name(
            entity=Table,
            fqn="test-service-custom-properties.test-db.test-schema.test_custom_properties",
            fields=["*"],
        )
        self.assertEqual(res.extension.root["DataQuality"], extensions["DataQuality"])
        self.assertEqual(res.extension.root["TableSize"], extensions["TableSize"])
        self.assertEqual(res.extension.root["Rating"], extensions["Rating"])
        self.assertEqual(res.extension.root["Department"], extensions["Department"])
        self.assertEqual(
            res.extension.root["DataEngineers"][0]["id"],
            str(extensions["DataEngineers"][0].id.root),
        )
        self.assertEqual(
            res.extension.root["DataEngineers"][1]["id"],
            str(extensions["DataEngineers"][1].id.root),
        )

    def test_add_custom_property_schema(self):
        """
        Test to add the extension/custom property to the schema
        """

        # create the custom properties
        self.create_custom_property()

        extensions = {"SchemaAge": 3}

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema-custom-property",
            database=self.create_db_entity.fullyQualifiedName,
            extension=EntityExtension(root=extensions),
        )
        self.metadata.create_or_update(data=create_schema)

        res = self.metadata.get_by_name(
            entity=DatabaseSchema,
            fqn="test-service-custom-properties.test-db.test-schema-custom-property",
            fields=["*"],
        )
        self.assertEqual(res.extension.root["SchemaAge"], extensions["SchemaAge"])

    def test_custom_property_data_types_enum_values(self):
        """
        Test that CustomPropertyDataTypes enum has correct values, especially for date/time types
        """
        # Test that the enum values are correct
        self.assertEqual(CustomPropertyDataTypes.STRING.value, "string")
        self.assertEqual(CustomPropertyDataTypes.INTEGER.value, "integer")
        self.assertEqual(CustomPropertyDataTypes.MARKDOWN.value, "markdown")
        self.assertEqual(CustomPropertyDataTypes.DATE.value, "date-cp")
        self.assertEqual(CustomPropertyDataTypes.DATETIME.value, "dateTime-cp")
        self.assertEqual(CustomPropertyDataTypes.TIME.value, "time-cp")
        self.assertEqual(CustomPropertyDataTypes.DURATION.value, "duration")
        self.assertEqual(CustomPropertyDataTypes.EMAIL.value, "email")
        self.assertEqual(CustomPropertyDataTypes.NUMBER.value, "number")
        self.assertEqual(CustomPropertyDataTypes.SQLQUERY.value, "sqlQuery")
        self.assertEqual(CustomPropertyDataTypes.TIMEINTERVAL.value, "timeInterval")
        self.assertEqual(CustomPropertyDataTypes.TIMESTAMP.value, "timestamp")
        self.assertEqual(CustomPropertyDataTypes.ENUM.value, "enum")
        self.assertEqual(CustomPropertyDataTypes.ENTITY_REFERENCE.value, "entityReference")
        self.assertEqual(CustomPropertyDataTypes.ENTITY_REFERENCE_LIST.value, "entityReferenceList")

    def test_date_time_custom_properties(self):
        """
        Test creating custom properties with date/time types using the updated enum values
        """
        # Test DATE custom property
        date_property = OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="CreationDate",
                description="Date when the table was created",
                propertyType=self.metadata.get_property_type_ref(
                    CustomPropertyDataTypes.DATE
                ),
            ),
        )
        self.metadata.create_or_update_custom_property(
            ometa_custom_property=date_property
        )

        # Test DATETIME custom property
        datetime_property = OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="LastModifiedDateTime",
                description="Date and time when the table was last modified",
                propertyType=self.metadata.get_property_type_ref(
                    CustomPropertyDataTypes.DATETIME
                ),
            ),
        )
        self.metadata.create_or_update_custom_property(
            ometa_custom_property=datetime_property
        )

        # Test TIME custom property
        time_property = OMetaCustomProperties(
            entity_type=Table,
            createCustomPropertyRequest=CreateCustomPropertyRequest(
                name="DailyBackupTime",
                description="Time when daily backup occurs",
                propertyType=self.metadata.get_property_type_ref(
                    CustomPropertyDataTypes.TIME
                ),
            ),
        )
        self.metadata.create_or_update_custom_property(
            ometa_custom_property=time_property
        )

        # Verify the properties were created
        custom_properties = self.metadata.get_entity_custom_properties(
            entity_type=Table
        )
        
        date_prop = next((cp for cp in custom_properties if cp["name"] == "CreationDate"), None)
        datetime_prop = next((cp for cp in custom_properties if cp["name"] == "LastModifiedDateTime"), None)
        time_prop = next((cp for cp in custom_properties if cp["name"] == "DailyBackupTime"), None)

        self.assertIsNotNone(date_prop)
        self.assertIsNotNone(datetime_prop)
        self.assertIsNotNone(time_prop)

        # Verify the property types are correct
        self.assertEqual(date_prop["propertyType"]["name"], "date-cp")
        self.assertEqual(datetime_prop["propertyType"]["name"], "dateTime-cp")
        self.assertEqual(time_prop["propertyType"]["name"], "time-cp")

    def test_all_custom_property_data_types(self):
        """
        Test creating custom properties for all available data types
        """
        test_cases = [
            (CustomPropertyDataTypes.STRING, "TestString", "String test property"),
            (CustomPropertyDataTypes.INTEGER, "TestInteger", "Integer test property"),
            (CustomPropertyDataTypes.MARKDOWN, "TestMarkdown", "Markdown test property"),
            (CustomPropertyDataTypes.DATE, "TestDate", "Date test property"),
            (CustomPropertyDataTypes.DATETIME, "TestDateTime", "DateTime test property"),
            (CustomPropertyDataTypes.TIME, "TestTime", "Time test property"),
            (CustomPropertyDataTypes.DURATION, "TestDuration", "Duration test property"),
            (CustomPropertyDataTypes.EMAIL, "TestEmail", "Email test property"),
            (CustomPropertyDataTypes.NUMBER, "TestNumber", "Number test property"),
            (CustomPropertyDataTypes.SQLQUERY, "TestSqlQuery", "SQL Query test property"),
            (CustomPropertyDataTypes.TIMEINTERVAL, "TestTimeInterval", "Time Interval test property"),
            (CustomPropertyDataTypes.TIMESTAMP, "TestTimestamp", "Timestamp test property"),
        ]

        for data_type, name, description in test_cases:
            with self.subTest(data_type=data_type):
                property_request = OMetaCustomProperties(
                    entity_type=Table,
                    createCustomPropertyRequest=CreateCustomPropertyRequest(
                        name=name,
                        description=description,
                        propertyType=self.metadata.get_property_type_ref(data_type),
                    ),
                )
                
                # This should not raise an exception
                result = self.metadata.create_or_update_custom_property(
                    ometa_custom_property=property_request
                )
                self.assertIsNotNone(result)

        # Verify all properties were created
        custom_properties = self.metadata.get_entity_custom_properties(
            entity_type=Table
        )
        
        created_properties = {cp["name"]: cp for cp in custom_properties}
        
        for data_type, name, description in test_cases:
            with self.subTest(data_type=data_type, name=name):
                self.assertIn(name, created_properties)
                prop = created_properties[name]
                self.assertEqual(prop["description"], description)
                self.assertEqual(prop["propertyType"]["name"], data_type.value)

    def test_custom_property_with_date_time_values(self):
        """
        Test adding actual date/time values to custom properties
        """
        # Create date/time custom properties
        self.test_date_time_custom_properties()
        
        # Test data for date/time properties
        extensions = {
            "CreationDate": "2023-12-01",
            "LastModifiedDateTime": "2023-12-01T10:30:00Z",
            "DailyBackupTime": "02:00:00",
        }

        table = self.create_table(name="test_datetime_properties", extensions=extensions)
        
        # Verify the table was created with the date/time extensions
        res = self.metadata.get_by_name(
            entity=Table,
            fqn="test-service-custom-properties.test-db.test-schema.test_datetime_properties",
            fields=["*"],
        )
        
        self.assertEqual(res.extension.root["CreationDate"], extensions["CreationDate"])
        self.assertEqual(res.extension.root["LastModifiedDateTime"], extensions["LastModifiedDateTime"])
        self.assertEqual(res.extension.root["DailyBackupTime"], extensions["DailyBackupTime"])

    def test_custom_property_enum_backwards_compatibility(self):
        """
        Test that the enum values work correctly with property type references
        """
        # Test that get_property_type_ref works with the new enum values
        date_type_ref = self.metadata.get_property_type_ref(CustomPropertyDataTypes.DATE)
        datetime_type_ref = self.metadata.get_property_type_ref(CustomPropertyDataTypes.DATETIME)
        time_type_ref = self.metadata.get_property_type_ref(CustomPropertyDataTypes.TIME)
        
        # These should not be None and should have the correct names
        self.assertIsNotNone(date_type_ref)
        self.assertIsNotNone(datetime_type_ref)
        self.assertIsNotNone(time_type_ref)
        
        # Verify the type names match the enum values
        self.assertEqual(date_type_ref.name, "date-cp")
        self.assertEqual(datetime_type_ref.name, "dateTime-cp")
        self.assertEqual(time_type_ref.name, "time-cp")

    def test_custom_property_data_types_completeness(self):
        """
        Test that all CustomPropertyDataTypes enum members are properly defined
        """
        # Test that all enum members have string values
        for data_type in CustomPropertyDataTypes:
            self.assertIsInstance(data_type.value, str)
            self.assertGreater(len(data_type.value), 0)
            
        # Test specific enum members that were changed
        date_time_types = [
            CustomPropertyDataTypes.DATE,
            CustomPropertyDataTypes.DATETIME,
            CustomPropertyDataTypes.TIME
        ]
        
        for data_type in date_time_types:
            # These should all have the -cp suffix
            self.assertTrue(data_type.value.endswith("-cp"))
            
        # Test that other types don't have the -cp suffix
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
            self.assertFalse(data_type.value.endswith("-cp"))

    def test_custom_property_mixed_data_types(self):
        """
        Test creating a table with mixed custom property data types
        """
        # Create various custom properties
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
            property_request = OMetaCustomProperties(
                entity_type=Table,
                createCustomPropertyRequest=CreateCustomPropertyRequest(
                    name=name,
                    description=description,
                    propertyType=self.metadata.get_property_type_ref(data_type),
                ),
            )
            
            self.metadata.create_or_update_custom_property(
                ometa_custom_property=property_request
            )
        
        # Create a table with all these properties
        extensions = {
            "Description": "This is a test table",
            "RowCount": 1000,
            "CreatedDate": "2023-01-01",
            "LastUpdated": "2023-12-01T15:30:00Z",
            "BackupTime": "03:00:00",
            "Owner": "test@example.com",
            "SizeGB": 2.5,
        }
        
        table = self.create_table(name="test_mixed_types", extensions=extensions)
        
        # Verify the table was created with all extensions
        res = self.metadata.get_by_name(
            entity=Table,
            fqn="test-service-custom-properties.test-db.test-schema.test_mixed_types",
            fields=["*"],
        )
        
        for key, expected_value in extensions.items():
            self.assertEqual(res.extension.root[key], expected_value)

    def test_custom_property_type_ref_error_handling(self):
        """
        Test error handling when using invalid custom property types
        """
        # Test that valid enum values work
        for data_type in CustomPropertyDataTypes:
            type_ref = self.metadata.get_property_type_ref(data_type)
            self.assertIsNotNone(type_ref)
            self.assertEqual(type_ref.name, data_type.value)
