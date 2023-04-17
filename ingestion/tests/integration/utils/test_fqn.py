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
Test FQN utilities
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
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.fqn import FQNBuildingException


class FQNBuildTest(TestCase):
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
        name="test-service-table-fqn",
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="username",
                password="password",
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
            name="test-db",
            service=cls.service_entity.fullyQualifiedName,
        )

        create_db_entity = cls.metadata.create_or_update(data=create_db)

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema",
            database=create_db_entity.fullyQualifiedName,
        )

        create_schema_entity = cls.metadata.create_or_update(data=create_schema)

        create = CreateTableRequest(
            name="test",
            databaseSchema=create_schema_entity.fullyQualifiedName,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.entity: Table = cls.metadata.create_or_update(create)

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn="test-service-table-fqn"
            ).id.__root__
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_build_table_fqn(self):
        """
        Different flavours of Table FQN building
        """

        table_fqn = fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.service.name.__root__,
            database_name=self.db_reference.name,
            schema_name=self.schema_reference.name,
            table_name=self.entity.name.__root__,
        )

        self.assertEqual("test-service-table-fqn.test-db.test-schema.test", table_fqn)

        table_fqn = fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.service.name.__root__,
            database_name=self.db_reference.name,
            schema_name=None,
            table_name=self.entity.name.__root__,
            retries=5,
        )

        self.assertEqual("test-service-table-fqn.test-db.test-schema.test", table_fqn)

        table_fqn = fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.service.name.__root__,
            database_name=None,
            schema_name=None,
            table_name=self.entity.name.__root__,
            retries=5,
        )

        self.assertEqual("test-service-table-fqn.test-db.test-schema.test", table_fqn)

        with self.assertRaises(FQNBuildingException) as context:
            fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=None,
                database_name=None,
                schema_name=None,
                table_name=None,
            )
        self.assertEqual(
            str(context.exception),
            "Service Name and Table Name should be informed, but got service=`None`, table=`None`",
        )

    def test_split_table_name(self):
        """Different tables are properly partitioned"""

        self.assertEqual(
            {"database": "database", "database_schema": "schema", "table": "table"},
            fqn.split_table_name(table_name="database.schema.table"),
        )

        self.assertEqual(
            {"database": None, "database_schema": "schema", "table": "table"},
            fqn.split_table_name(table_name="schema.table"),
        )

        self.assertEqual(
            {"database": None, "database_schema": None, "table": "table"},
            fqn.split_table_name(table_name="table"),
        )

        # We also clean quotes
        self.assertEqual(
            {"database": "database", "database_schema": "schema", "table": "table"},
            fqn.split_table_name(table_name='database."schema".table'),
        )
