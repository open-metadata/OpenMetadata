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
OMeta ES Mixin integration tests. The API needs to be up
"""
import logging
import time
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


class OMetaESTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    server_config = OpenMetadataConnection(hostPort="http://localhost:8585/api")
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    service = CreateDatabaseServiceRequest(
        name="test-service-es",
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
    def check_es_index(cls) -> None:
        """
        Wait until the index has been updated with the test table.
        """
        logging.info("Checking ES index status...")

        res = None
        while not res:
            res = cls.metadata.es_search_from_fqn(
                entity_type=Table,
                fqn_search_string="test-service-es.test-db-es.test-schema-es.test-es"
            )
            if not res:
                time.sleep(1)

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """

        cls.service_entity = cls.metadata.create_or_update(data=cls.service)

        create_db = CreateDatabaseRequest(
            name="test-db-es",
            service=EntityReference(id=cls.service_entity.id, type="databaseService"),
        )

        create_db_entity = cls.metadata.create_or_update(data=create_db)

        cls.db_reference = EntityReference(
            id=create_db_entity.id, name="test-db-es", type="database"
        )

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema-es", database=cls.db_reference
        )

        create_schema_entity = cls.metadata.create_or_update(data=create_schema)

        cls.schema_reference = EntityReference(
            id=create_schema_entity.id, name="test-schema-es", type="databaseSchema"
        )

        create = CreateTableRequest(
            name="test-es",
            databaseSchema=cls.schema_reference,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.entity = cls.metadata.create_or_update(create)

        # Leave some time for indexes to get updated, otherwise this happens to fast
        cls.check_es_index()

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

    def test_es_search_from_service_table(self):
        """
        We can fetch tables from a service
        """

        fqn_search_string = fqn._build(
            self.service.name.__root__, "*", "*", self.entity.name.__root__
        )

        res = self.metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
            size=100,
        )

        # We get the created table back
        self.assertIsNotNone(res)
        self.assertIn(self.entity, res)

        fqn_search_string = fqn._build(
            self.service.name.__root__,
            self.db_reference.name,
            "*",
            self.entity.name.__root__,
        )

        res = self.metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
            size=100,
        )

        self.assertIsNotNone(res)
        self.assertIn(self.entity, res)

        fqn_search_string = fqn._build(
            self.service.name.__root__,
            self.db_reference.name,
            self.schema_reference.name,
            self.entity.name.__root__,
        )

        res = self.metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
            size=100,
        )

        self.assertIsNotNone(res)
        self.assertIn(self.entity, res)

    def test_es_search_from_service_table_empty(self):
        """
        Wrong filters return none
        """
        res = self.metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string="random",
        )

        self.assertIsNone(res)
