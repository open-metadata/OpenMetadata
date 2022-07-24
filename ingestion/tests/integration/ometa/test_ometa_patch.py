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
OpenMetadata high-level API Table test
"""
from unittest import TestCase

from ingestion.src.metadata.utils.helpers import find_column_in_table
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


class OMetaTableTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None
    entity_id = None

    server_config = OpenMetadataConnection(hostPort="http://localhost:8585/api")
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    service = CreateDatabaseServiceRequest(
        name="test-service-table-patch",
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

        cls.create = CreateTableRequest(
            name="test",
            databaseSchema=cls.schema_reference,
            columns=[
                Column(name="id", dataType=DataType.BIGINT),
                Column(name="another", dataType=DataType.BIGINT),
            ],
        )

        res: Table = cls.metadata.create_or_update(data=cls.create)
        cls.entity_id = res.id

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn="test-service-table-patch"
            ).id.__root__
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_patch_description(self):
        """
        Update description and force
        """
        updated: Table = self.metadata.patch_description(
            entity=Table, entity_id=self.entity_id, description="New description"
        )

        assert updated.description.__root__ == "New description"

        not_updated = self.metadata.patch_description(
            entity=Table, entity_id=self.entity_id, description="Not passing force"
        )

        assert not not_updated

        force_updated: Table = self.metadata.patch_description(
            entity=Table,
            entity_id=self.entity_id,
            description="Forced new",
            force=True,
        )

        assert force_updated.description.__root__ == "Forced new"

    def test_patch_column_description(self):
        """
        Update column description and force
        """

        updated: Table = self.metadata.patch_column_description(
            entity_id=self.entity_id,
            description="New column description",
            column_name="another",
        )

        updated_col = find_column_in_table(column_name="another", table=updated)
        assert updated_col.description.__root__ == "New column description"

        not_updated = self.metadata.patch_column_description(
            entity_id=self.entity_id,
            description="Not passing force",
            column_name="another",
        )

        assert not not_updated

        force_updated: Table = self.metadata.patch_column_description(
            entity_id=self.entity_id,
            description="Forced new",
            column_name="another",
            force=True,
        )

        updated_col = find_column_in_table(column_name="another", table=force_updated)
        assert updated_col.description.__root__ == "Forced new"
