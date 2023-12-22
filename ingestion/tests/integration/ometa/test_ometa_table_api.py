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
from copy import deepcopy
from datetime import datetime, timezone
from typing import List
from unittest import TestCase
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.query import Query
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnJoins,
    ColumnProfile,
    DataType,
    JoinedWith,
    SystemProfile,
    Table,
    TableData,
    TableJoins,
    TableProfile,
    TableProfilerConfig,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, SqlQuery
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.ometa.client import REST

from ..integration_base import int_admin_ometa

BAD_RESPONSE = {
    "data": [
        {
            "id": "cb149dd4-f4c2-485e-acd3-74b7dca1015e",
            "name": "my.fake.good.tableOne",
            "columns": [
                {
                    "name": "col1",
                    "dataType": "BIGINT",
                }
            ],
        },
        {
            "id": "5d76676c-8e94-4e7e-97b8-294f4c16d0aa",
            "name": "my.fake.good.tableTwo",
            "columns": [
                {
                    "name": "col1",
                    "dataType": "BIGINT",
                }
            ],
        },
        {
            "id": "f063ff4e-99a3-4d42-8678-c484c2556e8d",
            "name": "my.fake.bad.tableOne",
            "columns": [
                {
                    "name": "col1",
                    "dataType": "BIGINT",
                }
            ],
            "tags": [
                {
                    "tagFQN": "myTaghasMoreThanOneHundredAndTwentyCharactersAndItShouldBreakPydanticModelValidation.myTaghasMoreThanOneHundredAndTwentyCharactersAndItShouldBreakPydanticModelValidation",
                    "source": "Classification",
                    "labelType": "Manual",
                    "state": "Confirmed",
                }
            ],
        },
    ],
    "paging": {
        "total": 3,
    },
}


class OMetaTableTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    metadata = int_admin_ometa()

    user: User = metadata.create_or_update(
        data=CreateUserRequest(name="random-user", email="random@user.com"),
    )
    owner = EntityReference(
        id=user.id, type="user", fullyQualifiedName=user.fullyQualifiedName.__root__
    )

    service = CreateDatabaseServiceRequest(
        name="test-service-table",
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
            name="test-db",
            service=cls.service_entity.fullyQualifiedName,
        )

        create_db_entity = cls.metadata.create_or_update(data=create_db)

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema",
            database=create_db_entity.fullyQualifiedName,
        )

        cls.create_schema_entity = cls.metadata.create_or_update(data=create_schema)

        cls.entity = Table(
            id=uuid.uuid4(),
            name="test",
            databaseSchema=EntityReference(
                id=cls.create_schema_entity.id, type="databaseSchema"
            ),
            fullyQualifiedName="test-service-table.test-db.test-schema.test",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.create = CreateTableRequest(
            name="test",
            databaseSchema=cls.create_schema_entity.fullyQualifiedName,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn="test-service-table"
            ).id.__root__
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_create(self):
        """
        We can create a Table and we receive it back as Entity
        """

        res = self.metadata.create_or_update(data=self.create)

        self.assertEqual(res.name, self.entity.name)
        self.assertEqual(res.databaseSchema.id, self.entity.databaseSchema.id)
        self.assertEqual(res.owner, None)

    def test_update(self):
        """
        Updating it properly changes its properties
        """

        res_create = self.metadata.create_or_update(data=self.create)

        updated = self.create.dict(exclude_unset=True)
        updated["owner"] = self.owner
        updated_entity = CreateTableRequest(**updated)

        res = self.metadata.create_or_update(data=updated_entity)

        # Same ID, updated owner
        self.assertEqual(
            res.databaseSchema.fullyQualifiedName,
            updated_entity.databaseSchema.__root__,
        )
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owner.id, self.user.id)

    def test_get_name(self):
        """
        We can fetch a Table by name and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.get_by_name(
            entity=Table, fqn=self.entity.fullyQualifiedName
        )
        self.assertEqual(res.name, self.entity.name)

        # Now check that we get a None if the table does not exist
        nullable_res = self.metadata.get_by_name(entity=Table, fqn="something.made.up")
        self.assertIsNone(nullable_res)

    def test_get_id(self):
        """
        We can fetch a Table by ID and get it back as Entity
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res_name = self.metadata.get_by_name(
            entity=Table, fqn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(entity=Table, entity_id=str(res_name.id.__root__))

        self.assertEqual(res_name.id, res.id)

    def test_list(self):
        """
        We can list all our Tables
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.list_entities(entity=Table)

        # Fetch our test Database. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.entity.name), None
        )
        assert data

    def test_list_all(self):
        """
        Validate generator utility to fetch all tables
        """
        fake_create = deepcopy(self.create)
        for i in range(0, 10):
            fake_create.name = self.create.name.__root__ + str(i)
            self.metadata.create_or_update(data=fake_create)

        all_entities = self.metadata.list_all_entities(
            entity=Table, limit=2  # paginate in batches of pairs
        )
        assert (
            len(list(all_entities)) >= 10
        )  # In case the default testing entity is not present

    def test_delete(self):
        """
        We can delete a Table by ID
        """

        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Table, fqn=self.entity.fullyQualifiedName
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
            entity=Table, fqn=self.entity.fullyQualifiedName
        )

        sample_data = TableData(columns=["id"], rows=[[1], [2], [3]])

        res_sample = self.metadata.ingest_table_sample_data(res, sample_data)
        assert res_sample == sample_data

        # Let's also validate that we can properly retrieve sample data back
        res_sample = self.metadata.get_sample_data(table=res).sampleData
        assert res_sample == sample_data

    def test_ingest_table_profile_data(self):
        """
        We can ingest profile data TableProfile
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res = self.metadata.get_by_name(
            entity=Table, fqn=self.entity.fullyQualifiedName
        )

        table_profile = TableProfile(
            timestamp=datetime.now().timestamp(),
            columnCount=1.0,
            rowCount=3.0,
        )
        column_profile = [
            ColumnProfile(
                name="id",
                uniqueCount=3.0,
                uniqueProportion=1.0,
                min=1,
                max=3,
                mean=1.5,
                sum=2,
                stddev=None,
                timestamp=datetime.now(tz=timezone.utc).timestamp(),
            )
        ]

        system_profile = [
            SystemProfile(
                timestamp=datetime.now(tz=timezone.utc).timestamp(),
                operation="INSERT",
                rowsAffected=11,
            ),
            SystemProfile(
                timestamp=datetime.now(tz=timezone.utc).timestamp() + 1,
                operation="UPDATE",
                rowsAffected=110,
            ),
        ]

        profile = CreateTableProfileRequest(
            tableProfile=table_profile,
            columnProfile=column_profile,
            systemProfile=system_profile,
        )
        self.metadata.ingest_profile_data(res, profile)

        table = self.metadata.get_latest_table_profile(self.entity.fullyQualifiedName)

        assert table.profile == table_profile

        res_column_profile = next(
            (col.profile for col in table.columns if col.name.__root__ == "id")
        )
        assert res_column_profile == column_profile[0]

    def test_publish_table_usage(self):
        """
        We can POST usage data for a Table
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res = self.metadata.get_by_name(
            entity=Table, fqn=self.entity.fullyQualifiedName
        )

        usage = UsageRequest(date="2021-10-20", count=10)

        self.metadata.publish_table_usage(res, usage)

    def test_publish_frequently_joined_with(self):
        """
        We can PUT freq Table JOINs
        """

        self.metadata.create_or_update(data=self.create)

        # First pick up by name
        res = self.metadata.get_by_name(
            entity=Table, fqn=self.entity.fullyQualifiedName
        )

        column_join_table_req = CreateTableRequest(
            name="another-test",
            databaseSchema=self.create_schema_entity.fullyQualifiedName,
            columns=[Column(name="another_id", dataType=DataType.BIGINT)],
        )
        column_join_table_res = self.metadata.create_or_update(column_join_table_req)

        direct_join_table_req = CreateTableRequest(
            name="direct-join-test",
            databaseSchema=self.create_schema_entity.fullyQualifiedName,
            columns=[],
        )
        direct_join_table_res = self.metadata.create_or_update(direct_join_table_req)

        joins = TableJoins(
            startDate=datetime.now(),
            dayCount=1,
            directTableJoins=[
                JoinedWith(
                    fullyQualifiedName="test-service-table.test-db.test-schema.direct-join-test",
                    joinCount=2,
                )
            ],
            columnJoins=[
                ColumnJoins(
                    columnName="id",
                    joinedWith=[
                        JoinedWith(
                            fullyQualifiedName="test-service-table.test-db.test-schema.another-test.another_id",
                            joinCount=2,
                        )
                    ],
                )
            ],
        )

        self.metadata.publish_frequently_joined_with(res, joins)
        self.metadata.delete(
            entity=Table, entity_id=str(column_join_table_res.id.__root__)
        )
        self.metadata.delete(
            entity=Table, entity_id=str(direct_join_table_res.id.__root__)
        )

    def test_table_queries(self):
        """
        Test add and update table query data
        """

        self.metadata.create_or_update(data=self.create)

        res = self.metadata.get_by_name(
            entity=Table, fqn=self.entity.fullyQualifiedName
        )

        query_no_user = CreateQueryRequest(
            query=SqlQuery(__root__="select * from awesome"),
            service=FullyQualifiedEntityName(__root__=self.service.name.__root__),
        )

        self.metadata.ingest_entity_queries_data(entity=res, queries=[query_no_user])
        table_with_query: List[Query] = self.metadata.get_entity_queries(
            res.id, fields=["*"]
        )

        assert len(table_with_query) == 1
        assert table_with_query[0].query == query_no_user.query
        assert table_with_query[0].users == []

        # Validate that we can properly add user information
        query_with_user = CreateQueryRequest(
            query="select * from awesome",
            users=[self.owner.fullyQualifiedName],
            service=FullyQualifiedEntityName(__root__=self.service.name.__root__),
        )

        self.metadata.ingest_entity_queries_data(entity=res, queries=[query_with_user])
        table_with_query: List[Query] = self.metadata.get_entity_queries(
            res.id, fields=["*"]
        )

        assert len(table_with_query) == 1
        assert table_with_query[0].query == query_with_user.query
        assert len(table_with_query[0].users) == 1
        assert table_with_query[0].users[0].id == self.owner.id

    def test_list_versions(self):
        """
        test list table entity versions
        """
        self.metadata.create_or_update(data=self.create)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Table, fqn=self.entity.fullyQualifiedName
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
            entity=Table, fqn=self.entity.fullyQualifiedName
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
            entity=Table, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id

    def test_update_profile_sample(self):
        """
        We can safely update the profile sample %
        """

        table = self.metadata.create_or_update(data=self.create)
        assert table.tableProfilerConfig is None

        self.metadata._create_or_update_table_profiler_config(
            table.id, table_profiler_config=TableProfilerConfig(profileSample=50.0)
        )

        stored = self.metadata.get_by_name(
            entity=Table, fqn=table.fullyQualifiedName, fields=["tableProfilerConfig"]
        )
        assert stored.tableProfilerConfig.profileSample == 50.0

    def test_list_w_skip_on_failure(self):
        """
        We can list all our Tables even when some of them are broken
        """

        # first validate that exception is raised when skip_on_failure is False
        with patch.object(REST, "get", return_value=BAD_RESPONSE):
            with pytest.raises(ValidationError):
                self.metadata.list_entities(entity=Table)

        with patch.object(REST, "get", return_value=BAD_RESPONSE):
            res = self.metadata.list_entities(entity=Table, skip_on_failure=True)

        # We should have 2 tables, the 3rd one is broken and should be skipped
        assert len(res.entities) == 2

    def test_list_all_w_skip_on_failure(self):
        """
        Validate generator utility to fetch all tables even when some of them are broken
        """
        # first validate that exception is raised when skip_on_failure is False
        with patch.object(REST, "get", return_value=BAD_RESPONSE):
            with pytest.raises(ValidationError):
                res = self.metadata.list_all_entities(
                    entity=Table,
                    limit=1,  # paginate in batches of pairs
                )
                list(res)

        with patch.object(REST, "get", return_value=BAD_RESPONSE):
            res = self.metadata.list_all_entities(
                entity=Table,
                limit=1,
                skip_on_failure=True,  # paginate in batches of pairs
            )

            # We should have 2 tables, the 3rd one is broken and should be skipped
            assert len(list(res)) == 2
