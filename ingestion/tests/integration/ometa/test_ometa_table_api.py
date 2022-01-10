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
import uuid
from datetime import datetime
from unittest import TestCase

from metadata.generated.schema.api.data.createDatabase import (
    CreateDatabaseEntityRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableEntityRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceEntityRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserEntityRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnJoins,
    ColumnProfile,
    DataType,
    JoinedWithItem,
    Table,
    TableData,
    TableJoins,
    TableProfile,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.jdbcConnection import JdbcInfo
from metadata.ingestion.models.table_queries import TableUsageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig


class OMetaTableTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = MetadataServerConfig(api_endpoint="http://localhost:8585/api")
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    user = metadata.create_or_update(
        data=CreateUserEntityRequest(name="random-user", email="random@user.com"),
    )
    owner = EntityReference(id=user.id, type="user")

    service = CreateDatabaseServiceEntityRequest(
        name="test-service-table",
        serviceType=DatabaseServiceType.MySQL,
        jdbc=JdbcInfo(driverClass="jdbc", connectionUrl="jdbc://localhost"),
    )
    service_type = "databaseService"

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """

        cls.service_entity = cls.metadata.create_or_update(data=cls.service)

        cls.create_db = CreateDatabaseEntityRequest(
            name="test-db",
            service=EntityReference(id=cls.service_entity.id, type="databaseService"),
        )

        cls.create_db_entity = cls.metadata.create_or_update(data=cls.create_db)

        cls.entity = Table(
            id=uuid.uuid4(),
            name="test",
            database=EntityReference(id=cls.create_db_entity.id, type="database"),
            fullyQualifiedName="test-service-table.test-db.test",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.create = CreateTableEntityRequest(
            name="test",
            database=cls.create_db_entity.id,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """
        _id = str(
            cls.metadata.get_by_name(
                entity=Table, fqdn="test-service-table.test-db.test"
            ).id.__root__
        )

        database_id = str(
            cls.metadata.get_by_name(
                entity=Database, fqdn="test-service-table.test-db"
            ).id.__root__
        )

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqdn="test-service-table"
            ).id.__root__
        )

        cls.metadata.delete(entity=Table, entity_id=_id)
        cls.metadata.delete(entity=Database, entity_id=database_id)
        cls.metadata.delete(entity=DatabaseService, entity_id=service_id)

    def test_create(self):
        """
        We can create a Table and we receive it back as Entity
        """

        res = self.metadata.create_or_update(data=self.create)

        self.assertEqual(res.name, self.entity.name)
        self.assertEqual(res.database.id, self.entity.database.id)
        self.assertEqual(res.owner, None)

    def test_update(self):
        """
        Updating it properly changes its properties
        """

        res_create = self.metadata.create_or_update(data=self.create)

        updated = self.create.dict(exclude_unset=True)
        updated["owner"] = self.owner
        updated_entity = CreateTableEntityRequest(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated algorithm
        self.assertEqual(res.database.id, updated_entity.database)
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owner.id, self.user.id)

    def test_get_name(self):
        """
        We can fetch a Table by name and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.get_by_name(
            entity=Table, fqdn=self.entity.fullyQualifiedName
        )
        self.assertEqual(res.name, self.entity.name)

    def test_get_id(self):
        """
        We can fetch a Table by ID and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res_name = self.metadata.get_by_name(
            entity=Table, fqdn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(entity=Table, entity_id=str(res_name.id.__root__))

        self.assertEqual(res_name.id, res.id)

    def test_list(self):
        """
        We can list all our Tables
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.list_entities(entity=Table, limit=100)

        # Fetch our test Database. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.entity.name), None
        )
        assert data

    def test_delete(self):
        """
        We can delete a Table by ID
        """

        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Table, fqdn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(entity=Table, entity_id=res_name.id)

        # Delete
        self.metadata.delete(entity=Table, entity_id=str(res_id.id.__root__))

        # Then we should not find it
        res = self.metadata.list_entities(entity=Table)
        assert not next(
            iter(
                ent
                for ent in res.entities
                if ent.fullyQualifiedName == self.entity.fullyQualifiedName
            ),
            None,
        )

    def test_ingest_sample_data(self):
        """
        We can ingest sample TableData
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res = self.metadata.get_by_name(
            entity=Table, fqdn=self.entity.fullyQualifiedName
        )

        sample_data = TableData(columns=["id"], rows=[[1], [2], [3]])

        res_sample = self.metadata.ingest_table_sample_data(res, sample_data)
        assert res_sample == sample_data

    def test_ingest_table_profile_data(self):
        """
        We can ingest profile data TableProfile
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res = self.metadata.get_by_name(
            entity=Table, fqdn=self.entity.fullyQualifiedName
        )

        profile = [
            TableProfile(
                profileDate=datetime(2021, 10, 12),
                columnCount=1.0,
                rowCount=3.0,
                columnProfile=[
                    ColumnProfile(
                        name="id",
                        uniqueCount=3.0,
                        uniqueProportion=1.0,
                        nullCount=0.0,
                        nullProportion=0.0,
                        min="1",
                        max="3",
                        mean="1.5",
                        median="2",
                        stddev=None,
                    )
                ],
            )
        ]

        res_profile = self.metadata.ingest_table_profile_data(res, profile)
        assert profile == res_profile

    def test_publish_table_usage(self):
        """
        We can POST usage data for a Table
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res = self.metadata.get_by_name(
            entity=Table, fqdn=self.entity.fullyQualifiedName
        )

        usage = TableUsageRequest(date="2021-10-20", count=10)

        self.metadata.publish_table_usage(res, usage)

    def test_publish_frequently_joined_with(self):
        """
        We can PUT freq Table JOINs
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res = self.metadata.get_by_name(
            entity=Table, fqdn=self.entity.fullyQualifiedName
        )

        another_table = CreateTableEntityRequest(
            name="another-test",
            database=self.create_db_entity.id,
            columns=[Column(name="another_id", dataType=DataType.BIGINT)],
        )
        another_res = self.metadata.create_or_update(another_table)

        joins = TableJoins(
            startDate=datetime.now(),
            dayCount=1,
            columnJoins=[
                ColumnJoins(
                    columnName="id",
                    joinedWith=[
                        JoinedWithItem(
                            fullyQualifiedName="test-service-table.test-db.another-test.another_id",
                            joinCount=2,
                        )
                    ],
                )
            ],
        )

        self.metadata.publish_frequently_joined_with(res, joins)
        self.metadata.delete(entity=Table, entity_id=str(another_res.id.__root__))

    def test_list_versions(self):
        """
        test list table entity versions
        """
        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Table, fqdn=self.entity.fullyQualifiedName
        )

        res = self.metadata.get_list_entity_versions(
            entity=Table, entity_id=res_name.id.__root__
        )
        assert res

    def test_get_entity_version(self):
        """
        test get table entity version
        """
        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Table, fqdn=self.entity.fullyQualifiedName
        )
        res = self.metadata.get_entity_version(
            entity=Table, entity_id=res_name.id.__root__, version=0.1
        )

        # check we get the correct version requested and the correct entity ID
        assert res.version.__root__ == 0.1
        assert res.id == res_name.id

    def test_get_entity_ref(self):
        """
        test get EntityReference
        """
        res = self.metadata.create_or_update(data=self.create)
        entity_ref = self.metadata.get_entity_reference(
            entity=Table, fqdn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id
