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

import pytest

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.api.tests.createColumnTest import CreateColumnTestRequest
from metadata.generated.schema.api.tests.createTableTest import CreateTableTestRequest
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
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataServerConfig,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.column.columnValuesToBeBetween import (
    ColumnValuesToBeBetween,
)
from metadata.generated.schema.tests.columnTest import ColumnTestCase, ColumnTestType
from metadata.generated.schema.tests.table.tableRowCountToEqual import (
    TableRowCountToEqual,
)
from metadata.generated.schema.tests.tableTest import TableTestCase, TableTestType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.table_queries import TableUsageRequest
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OMetaTableTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = OpenMetadataServerConfig(hostPort="http://localhost:8585/api")
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    user = metadata.create_or_update(
        data=CreateUserRequest(name="random-user", email="random@user.com"),
    )
    owner = EntityReference(id=user.id, type="user")

    service = CreateDatabaseServiceRequest(
        name="test-service-table",
        serviceType=DatabaseServiceType.MySQL,
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

        cls.entity = Table(
            id=uuid.uuid4(),
            name="test",
            databaseSchema=cls.schema_reference,
            fullyQualifiedName="test-service-table.test-db.test-schema.test",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.create = CreateTableRequest(
            name="test",
            databaseSchema=cls.schema_reference,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqdn="test-service-table"
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
        self.assertEqual(res.databaseSchema.id, updated_entity.databaseSchema.id)
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
                        min=1,
                        max=3,
                        mean=1.5,
                        sum=2,
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

        another_table = CreateTableRequest(
            name="another-test",
            databaseSchema=self.schema_reference,
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
                            fullyQualifiedName="test-service-table.test-db.test-schema.another-test.another_id",
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

    def test_add_table_tests(self):
        """
        Add tableTests to table instance
        """

        table = self.metadata.create_or_update(data=self.create)

        table_test = CreateTableTestRequest(
            description="Testing something",
            testCase=TableTestCase(
                config=TableRowCountToEqual(value=100),
                tableTestType=TableTestType.tableRowCountToEqual,
            ),
        )

        table_with_test = self.metadata.add_table_test(
            table=table, table_test=table_test
        )

        assert len(table_with_test.tableTests) == 1
        assert table_with_test.tableTests[0].testCase == table_test.testCase

        test_case_result = TestCaseResult(
            result="some result",
            executionTime=datetime.now().timestamp(),
            testCaseStatus=TestCaseStatus.Success,
        )

        table_test_with_res = CreateTableTestRequest(
            description="Testing something",
            testCase=TableTestCase(
                config=TableRowCountToEqual(value=100),
                tableTestType=TableTestType.tableRowCountToEqual,
            ),
            result=test_case_result,
        )

        table_with_test_and_res = self.metadata.add_table_test(
            table=table, table_test=table_test_with_res
        )

        assert len(table_with_test_and_res.tableTests[0].results) == 1
        assert (
            table_with_test_and_res.tableTests[0].results[0].testCaseStatus
            == TestCaseStatus.Success
        )

    def test_add_column_tests(self):
        """
        Add columnTests to table instance
        """

        table = self.metadata.create_or_update(data=self.create)

        col_test = CreateColumnTestRequest(
            columnName="id",
            testCase=ColumnTestCase(
                config=ColumnValuesToBeBetween(minValue=1, maxValue=3),
                columnTestType=ColumnTestType.columnValuesToBeBetween,
            ),
        )

        updated_table = self.metadata.add_column_test(table=table, col_test=col_test)

        id_test = next(
            iter([col for col in updated_table.columns if col.name.__root__ == "id"]),
            None,
        )

        assert len(id_test.columnTests) == 1
        assert id_test.columnTests[0].testCase == col_test.testCase

        # Column needs to exist in the table!
        with pytest.raises(APIError):
            ko_test = CreateColumnTestRequest(
                columnName="random_column",
                testCase=ColumnTestCase(
                    config=ColumnValuesToBeBetween(minValue=1, maxValue=3),
                    columnTestType=ColumnTestType.columnValuesToBeBetween,
                ),
            )

            self.metadata.add_column_test(table=table, col_test=ko_test)

        col_test_res = TestCaseResult(
            result="some result",
            executionTime=datetime.now().timestamp(),
            testCaseStatus=TestCaseStatus.Success,
        )

        col_test_with_res = CreateColumnTestRequest(
            columnName="id",
            testCase=ColumnTestCase(
                config=ColumnValuesToBeBetween(minValue=1, maxValue=3),
                columnTestType=ColumnTestType.columnValuesToBeBetween,
            ),
            result=col_test_res,
        )

        table_with_test_and_res = self.metadata.add_column_test(
            table=table, col_test=col_test_with_res
        )

        id_test_res = next(
            iter(
                [
                    col
                    for col in table_with_test_and_res.columns
                    if col.name.__root__ == "id"
                ]
            ),
            None,
        )

        assert len(id_test_res.columnTests[0].results) == 1
        assert (
            id_test_res.columnTests[0].results[0].testCaseStatus
            == TestCaseStatus.Success
        )

    def test_update_profile_sample(self):
        """
        We can safely update the profile sample %
        """

        table = self.metadata.create_or_update(data=self.create)
        assert table.profileSample is None

        updated = self.metadata.update_profile_sample(
            fqdn=table.fullyQualifiedName.__root__, profile_sample=50.0
        )
        assert updated.profileSample == 50.0

        stored = self.metadata.get_by_name(
            entity=Table, fqdn=table.fullyQualifiedName, fields=["profileSample"]
        )
        assert stored.profileSample == 50.0
