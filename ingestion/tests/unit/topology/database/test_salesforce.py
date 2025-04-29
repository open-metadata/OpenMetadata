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
Test Salesforce using the topology

Here we don't need to patch, as we can just create our own metastore
"""

from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    Constraint,
    DataType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.salesforce.metadata import SalesforceSource

mock_salesforce_config = {
    "source": {
        "type": "salesforce",
        "serviceName": "local_salesforce",
        "serviceConnection": {
            "config": {
                "type": "Salesforce",
                "username": "username",
                "password": "password",
                "securityToken": "securityToken",
                "sobjectName": "sobjectName",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "salesforce"},
        }
    },
}
MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="salesforce_source",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Salesforce,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="118146679784",
    fullyQualifiedName="salesforce_source.default",
    displayName="118146679784",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="2aaa012e-099a-11ed-861d-0242ac120056",
    name="default",
    fullyQualifiedName="salesforce_source.118146679784.default",
    displayName="default",
    description="",
    database=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
    service=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
)


EXPECTED_COLUMN_VALUE = [
    Column(
        name=ColumnName("Description"),
        displayName=None,
        dataType=DataType.VARCHAR,
        arrayDataType=None,
        dataLength=32000,
        precision=None,
        scale=None,
        dataTypeDisplay="textarea",
        description="Contact Description",
        fullyQualifiedName=None,
        tags=[],
        constraint=Constraint.NULL,
        ordinalPosition=1,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name=ColumnName("OwnerId"),
        displayName=None,
        dataType=DataType.VARCHAR,
        arrayDataType=None,
        dataLength=18,
        precision=None,
        scale=None,
        dataTypeDisplay="reference",
        description="Owner ID",
        fullyQualifiedName=None,
        tags=[],
        constraint=Constraint.NOT_NULL,
        ordinalPosition=2,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name=ColumnName("Phone"),
        displayName=None,
        dataType=DataType.VARCHAR,
        arrayDataType=None,
        dataLength=0,
        precision=None,
        scale=None,
        dataTypeDisplay="phone",
        description="Phone",
        fullyQualifiedName=None,
        tags=[],
        constraint=Constraint.NOT_NULL,
        ordinalPosition=3,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name=ColumnName("CreatedById"),
        displayName=None,
        dataType=DataType.UNKNOWN,
        arrayDataType=None,
        dataLength=18,
        precision=None,
        scale=None,
        dataTypeDisplay="anytype",
        description="Created By ID",
        fullyQualifiedName=None,
        tags=[],
        constraint=Constraint.NOT_NULL,
        ordinalPosition=4,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
]

from collections import OrderedDict

SALESFORCE_FIELDS = [
    OrderedDict(
        [
            ("aggregatable", False),
            ("autoNumber", False),
            ("byteLength", 96000),
            ("calculated", False),
            ("calculatedFormula", None),
            ("cascadeDelete", False),
            ("caseSensitive", False),
            ("compoundFieldName", None),
            ("controllerName", None),
            ("createable", True),
            ("custom", False),
            ("defaultValue", None),
            ("defaultValueFormula", None),
            ("defaultedOnCreate", False),
            ("dependentPicklist", False),
            ("deprecatedAndHidden", False),
            ("digits", 0),
            ("displayLocationInDecimal", False),
            ("encrypted", False),
            ("externalId", False),
            ("extraTypeInfo", "plaintextarea"),
            ("filterable", False),
            ("filteredLookupInfo", None),
            ("groupable", False),
            ("highScaleNumber", False),
            ("htmlFormatted", False),
            ("idLookup", False),
            ("inlineHelpText", None),
            ("label", "Contact Description"),
            ("length", 32000),
            ("mask", None),
            ("maskType", None),
            ("name", "Description"),
            ("nameField", False),
            ("namePointing", False),
            ("nillable", True),
            ("permissionable", True),
            ("picklistValues", []),
            ("polymorphicForeignKey", False),
            ("precision", 0),
            ("queryByDistance", False),
            ("referenceTargetField", None),
            ("referenceTo", []),
            ("relationshipName", None),
            ("relationshipOrder", None),
            ("restrictedDelete", False),
            ("restrictedPicklist", False),
            ("scale", 0),
            ("searchPrefilterable", False),
            ("soapType", "xsd:string"),
            ("sortable", False),
            ("type", "textarea"),
            ("unique", False),
            ("updateable", True),
            ("writeRequiresMasterRead", False),
        ]
    ),
    OrderedDict(
        [
            ("aggregatable", True),
            ("autoNumber", False),
            ("byteLength", 18),
            ("calculated", False),
            ("calculatedFormula", None),
            ("cascadeDelete", False),
            ("caseSensitive", False),
            ("compoundFieldName", None),
            ("controllerName", None),
            ("createable", True),
            ("custom", False),
            ("defaultValue", None),
            ("defaultValueFormula", None),
            ("defaultedOnCreate", True),
            ("dependentPicklist", False),
            ("deprecatedAndHidden", False),
            ("digits", 0),
            ("displayLocationInDecimal", False),
            ("encrypted", False),
            ("externalId", False),
            ("extraTypeInfo", None),
            ("filterable", True),
            ("filteredLookupInfo", None),
            ("groupable", True),
            ("highScaleNumber", False),
            ("htmlFormatted", False),
            ("idLookup", False),
            ("inlineHelpText", None),
            ("label", "Owner ID"),
            ("length", 18),
            ("mask", None),
            ("maskType", None),
            ("name", "OwnerId"),
            ("nameField", False),
            ("namePointing", False),
            ("nillable", False),
            ("permissionable", False),
            ("picklistValues", []),
            ("polymorphicForeignKey", False),
            ("precision", 0),
            ("queryByDistance", False),
            ("referenceTargetField", None),
            ("referenceTo", ["User"]),
            ("relationshipName", "Owner"),
            ("relationshipOrder", None),
            ("restrictedDelete", False),
            ("restrictedPicklist", False),
            ("scale", 0),
            ("searchPrefilterable", False),
            ("soapType", "tns:ID"),
            ("sortable", True),
            ("type", "reference"),
            ("unique", False),
            ("updateable", True),
            ("writeRequiresMasterRead", False),
        ]
    ),
    OrderedDict(
        [
            ("aggregatable", True),
            ("autoNumber", False),
            ("byteLength", 0),
            ("calculated", False),
            ("calculatedFormula", None),
            ("cascadeDelete", False),
            ("caseSensitive", False),
            ("compoundFieldName", None),
            ("controllerName", None),
            ("createable", False),
            ("custom", False),
            ("defaultValue", None),
            ("defaultValueFormula", None),
            ("defaultedOnCreate", True),
            ("dependentPicklist", False),
            ("deprecatedAndHidden", False),
            ("digits", 0),
            ("displayLocationInDecimal", False),
            ("encrypted", False),
            ("externalId", False),
            ("extraTypeInfo", None),
            ("filterable", True),
            ("filteredLookupInfo", None),
            ("groupable", False),
            ("highScaleNumber", False),
            ("htmlFormatted", False),
            ("idLookup", False),
            ("inlineHelpText", None),
            ("label", "Phone"),
            ("length", 0),
            ("mask", None),
            ("maskType", None),
            ("name", "Phone"),
            ("nameField", False),
            ("namePointing", False),
            ("nillable", False),
            ("permissionable", False),
            ("picklistValues", []),
            ("polymorphicForeignKey", False),
            ("precision", 0),
            ("queryByDistance", False),
            ("referenceTargetField", None),
            ("referenceTo", []),
            ("relationshipName", None),
            ("relationshipOrder", None),
            ("restrictedDelete", False),
            ("restrictedPicklist", False),
            ("scale", 0),
            ("searchPrefilterable", False),
            ("soapType", "xsd:dateTime"),
            ("sortable", True),
            ("type", "phone"),
            ("unique", False),
            ("updateable", False),
            ("writeRequiresMasterRead", False),
        ]
    ),
    OrderedDict(
        [
            ("aggregatable", True),
            ("autoNumber", False),
            ("byteLength", 18),
            ("calculated", False),
            ("calculatedFormula", None),
            ("cascadeDelete", False),
            ("caseSensitive", False),
            ("compoundFieldName", None),
            ("controllerName", None),
            ("createable", False),
            ("custom", False),
            ("defaultValue", None),
            ("defaultValueFormula", None),
            ("defaultedOnCreate", True),
            ("dependentPicklist", False),
            ("deprecatedAndHidden", False),
            ("digits", 0),
            ("displayLocationInDecimal", False),
            ("encrypted", False),
            ("externalId", False),
            ("extraTypeInfo", None),
            ("filterable", True),
            ("filteredLookupInfo", None),
            ("groupable", True),
            ("highScaleNumber", False),
            ("htmlFormatted", False),
            ("idLookup", False),
            ("inlineHelpText", None),
            ("label", "Created By ID"),
            ("length", 18),
            ("mask", None),
            ("maskType", None),
            ("name", "CreatedById"),
            ("nameField", False),
            ("namePointing", False),
            ("nillable", False),
            ("permissionable", False),
            ("picklistValues", []),
            ("polymorphicForeignKey", False),
            ("precision", 0),
            ("queryByDistance", False),
            ("referenceTargetField", None),
            ("referenceTo", ["User"]),
            ("relationshipName", "CreatedBy"),
            ("relationshipOrder", None),
            ("restrictedDelete", False),
            ("restrictedPicklist", False),
            ("scale", 0),
            ("searchPrefilterable", False),
            ("soapType", "tns:ID"),
            ("sortable", True),
            ("type", "anytype"),
            ("unique", False),
            ("updateable", False),
            ("writeRequiresMasterRead", False),
        ]
    ),
]


EXPECTED_COLUMN_TYPE = ["VARCHAR", "VARCHAR", "VARCHAR", "UNKNOWN"]


class SalesforceUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.salesforce.metadata.SalesforceSource.test_connection"
    )
    @patch("simple_salesforce.api.Salesforce")
    def __init__(self, methodName, salesforce, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_salesforce_config)
        self.salesforce_source = SalesforceSource.create(
            mock_salesforce_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

        self.salesforce_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE
        self.salesforce_source.context.get().__dict__["database"] = MOCK_DATABASE
        self.salesforce_source.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA

    @patch(
        "metadata.ingestion.source.database.salesforce.metadata.SalesforceSource.get_table_column_description"
    )
    def test_table_column(self, get_table_column_description):
        get_table_column_description.return_value = None
        result = self.salesforce_source.get_columns("TEST_TABLE", SALESFORCE_FIELDS)
        assert EXPECTED_COLUMN_VALUE == result

    def test_column_type(self):
        for i in range(len(SALESFORCE_FIELDS)):
            result = self.salesforce_source.column_type(
                SALESFORCE_FIELDS[i]["type"].upper()
            )
            assert result == EXPECTED_COLUMN_TYPE[i]

    @patch(
        "metadata.ingestion.source.database.salesforce.metadata.SalesforceSource.test_connection"
    )
    @patch("simple_salesforce.api.Salesforce")
    def test_check_ssl(self, salesforce, test_connection) -> None:
        mock_salesforce_config["source"]["serviceConnection"]["config"]["sslConfig"] = {
            "caCertificate": """
        -----BEGIN CERTIFICATE-----
        sample caCertificateData  
        -----END CERTIFICATE-----
        """
        }

        mock_salesforce_config["source"]["serviceConnection"]["config"]["sslConfig"][
            "sslKey"
        ] = """
        -----BEGIN CERTIFICATE-----
        sample caCertificateData  
        -----END CERTIFICATE-----
        """
        mock_salesforce_config["source"]["serviceConnection"]["config"]["sslConfig"][
            "sslCertificate"
        ] = """
        -----BEGIN CERTIFICATE-----
        sample sslCertificateData
        -----END CERTIFICATE-----
        """

        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_salesforce_config)
        self.salesforce_source = SalesforceSource.create(
            mock_salesforce_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.assertTrue(self.salesforce_source.ssl_manager.ca_file_path)
        self.assertTrue(self.salesforce_source.ssl_manager.cert_file_path)
        self.assertTrue(self.salesforce_source.ssl_manager.key_file_path)
