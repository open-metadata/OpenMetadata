#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
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
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.basic import EntityExtension
from metadata.ingestion.models.custom_properties import (
    CustomPropertyDataTypes,
    OMetaCustomProperties,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


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
            extension=EntityExtension(__root__=extensions),
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

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """
        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn="test-service-custom-properties"
            ).id.__root__
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

    def test_add_custom_property_table(self):
        """
        Test to add the extension/custom property to the table
        """

        # create the custom properties
        self.create_custom_property()

        extensions = {
            "DataQuality": '<div><p><b>Last evaluation:</b> 07/24/2023<br><b>Interval: </b>30 days <br><b>Next run:</b> 08/23/2023, 10:44:21<br><b>Measurement unit:</b> percent [%]</p><br><table><tbody><tr><th>Metric</th><th>Target</th><th>Latest result</th></tr><tr><td><p class="text-success">Completeness</p></td><td>90%</td><td><div class="bar fabric" style="width: 93%;"><strong>93%</strong></div></td></tr><tr><td><p class="text-success">Integrity</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr><tr><td><p class="text-warning">Timeliness</p></td><td>90%</td><td><div class="bar fabric" style="width: 56%;"><strong>56%</strong></div></td></tr><tr><td><p class="text-success">Uniqueness</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr><tr><td><p class="text-success">Validity</p></td><td>90%</td><td><div class="bar fabric" style="width: 100%;"><strong>100%</strong></div></td></tr></tbody></table><h3>Overall score of the table is: 89%</h3><hr style="border-width: 5px;"></div>',
            "TableSize": "250 MB",
        }

        self.create_table(name="test_custom_properties", extensions=extensions)

        res = self.metadata.get_by_name(
            entity=Table,
            fqn="test-service-custom-properties.test-db.test-schema.test_custom_properties",
            fields=["*"],
        )
        self.assertEqual(
            res.extension.__root__["DataQuality"], extensions["DataQuality"]
        )
        self.assertEqual(res.extension.__root__["TableSize"], extensions["TableSize"])

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
            extension=EntityExtension(__root__=extensions),
        )
        self.metadata.create_or_update(data=create_schema)

        res = self.metadata.get_by_name(
            entity=DatabaseSchema,
            fqn="test-service-custom-properties.test-db.test-schema-custom-property",
            fields=["*"],
        )
        self.assertEqual(res.extension.__root__["SchemaAge"], extensions["SchemaAge"])
