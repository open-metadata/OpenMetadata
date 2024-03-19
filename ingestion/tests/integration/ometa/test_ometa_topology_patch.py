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
Topology Patch Integration Test
"""
from unittest import TestCase

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
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
from metadata.ingestion.models.patch_request import (
    ALLOWED_COMMON_PATCH_FIELDS,
    ARRAY_ENTITY_FIELDS,
    RESTRICT_UPDATE_LIST,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class TopologyPatchTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

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
        name="test-service-topology-patch",
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

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """

        cls.service_entity = cls.metadata.create_or_update(data=cls.service)

        create_db = CreateDatabaseRequest(
            name="test-db-topology-patch",
            service=cls.service_entity.fullyQualifiedName,
        )

        cls.create_db_entity = cls.metadata.create_or_update(data=create_db)

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema-topology-patch",
            database=cls.create_db_entity.fullyQualifiedName,
        )

        cls.create_schema_entity = cls.metadata.create_or_update(data=create_schema)

        create = CreateTableRequest(
            name="test-topology-patch-table-one",
            databaseSchema=cls.create_schema_entity.fullyQualifiedName,
            columns=[
                Column(
                    name="column1", dataType=DataType.BIGINT, description="test column1"
                ),
                Column(
                    name="column2", dataType=DataType.BIGINT, description="test column2"
                ),
                Column(
                    name="column3", dataType=DataType.BIGINT, description="test column3"
                ),
                Column(
                    name="column4", dataType=DataType.BIGINT, description="test column4"
                ),
                Column(
                    name="column5", dataType=DataType.BIGINT, description="test column5"
                ),
            ],
        )
        cls.table_entity_one = cls.metadata.create_or_update(create)

        create = CreateTableRequest(
            name="test-topology-patch-table-two",
            databaseSchema=cls.create_schema_entity.fullyQualifiedName,
            columns=[
                Column(
                    name="column1", dataType=DataType.BIGINT, description="test column1"
                ),
                Column(
                    name="column2", dataType=DataType.BIGINT, description="test column2"
                ),
                Column(
                    name="column3", dataType=DataType.BIGINT, description="test column3"
                ),
                Column(
                    name="column4", dataType=DataType.BIGINT, description="test column4"
                ),
                Column(
                    name="column5", dataType=DataType.BIGINT, description="test column5"
                ),
            ],
        )
        cls.table_entity_two = cls.metadata.create_or_update(create)

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn=cls.service.name.__root__
            ).id.__root__
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_topology_patch_table_columns_with_random_order(self):
        """Check if the table columns are patched"""
        new_columns_list = [
            Column(name="column3", dataType=DataType.BIGINT),
            Column(name="column4", dataType=DataType.BIGINT),
            Column(name="column5", dataType=DataType.BIGINT),
            Column(name="column1", dataType=DataType.BIGINT),
            Column(name="column2", dataType=DataType.BIGINT),
        ]
        updated_table = self.table_entity_one.copy(deep=True)
        updated_table.columns = new_columns_list
        self.metadata.patch(
            entity=type(self.table_entity_one),
            source=self.table_entity_one,
            destination=updated_table,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
        )
        table_entity = self.metadata.get_by_id(
            entity=Table, entity_id=self.table_entity_one.id.__root__
        )
        self.assertEqual(table_entity.columns[0].description.__root__, "test column1")
        self.assertEqual(table_entity.columns[1].description.__root__, "test column2")
        self.assertEqual(table_entity.columns[2].description.__root__, "test column3")
        self.assertEqual(table_entity.columns[3].description.__root__, "test column4")
        self.assertEqual(table_entity.columns[4].description.__root__, "test column5")

    def test_topology_patch_table_columns_with_add_del(self):
        """Check if the table columns are patched"""
        new_columns_list = [
            Column(
                name="column7", dataType=DataType.BIGINT, description="test column7"
            ),
            Column(name="column3", dataType=DataType.BIGINT),
            Column(name="column5", dataType=DataType.BIGINT),
            Column(name="column1", dataType=DataType.BIGINT),
            Column(
                name="column6", dataType=DataType.BIGINT, description="test column6"
            ),
        ]
        updated_table = self.table_entity_two.copy(deep=True)
        updated_table.columns = new_columns_list
        self.metadata.patch(
            entity=type(self.table_entity_two),
            source=self.table_entity_two,
            destination=updated_table,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
        )
        table_entity = self.metadata.get_by_id(
            entity=Table, entity_id=self.table_entity_two.id.__root__
        )
        self.assertEqual(table_entity.columns[0].description.__root__, "test column1")
        self.assertEqual(table_entity.columns[1].description.__root__, "test column3")
        self.assertEqual(table_entity.columns[2].description.__root__, "test column5")
        self.assertEqual(table_entity.columns[3].description.__root__, "test column7")
        self.assertEqual(table_entity.columns[4].description.__root__, "test column6")
