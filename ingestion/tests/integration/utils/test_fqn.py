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
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.fqn import FQNBuildingException


class FQNBuildTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    server_config = OpenMetadataConnection(hostPort="http://localhost:8585/api")
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
            service=EntityReference(id=cls.service_entity.id, type="databaseService"),
        )

        create_db_entity = cls.metadata.create_or_update(data=create_db)

        cls.db_reference = EntityReference(
            id=create_db_entity.id, name="test-db", type="database"
        )

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema", database=cls.db_reference
        )

        create_schema_entity = cls.metadata.create_or_update(data=create_schema)

        cls.schema_reference = EntityReference(
            id=create_schema_entity.id, name="test-schema", type="databaseSchema"
        )

        create = CreateTableRequest(
            name="test",
            databaseSchema=cls.schema_reference,
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
                entity=DatabaseService, fqdn="test-service-table-fqn"
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
