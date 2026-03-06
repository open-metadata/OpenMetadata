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
OpenMetadata high-level API Table test
"""
from copy import deepcopy
from datetime import datetime, timezone
from typing import List
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.entity.data.query import Query
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnJoins,
    ColumnName,
    ColumnProfile,
    DataType,
    DmlOperationType,
    JoinedWith,
    SystemProfile,
    Table,
    TableData,
    TableJoins,
    TableProfile,
    TableProfilerConfig,
)
from metadata.generated.schema.type.basic import (
    Date,
    EntityName,
    FullyQualifiedEntityName,
    SqlQuery,
    Timestamp,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.ometa.client import REST

from ..integration_base import get_create_entity

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
                    "tagFQN": 123,
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


@pytest.fixture(scope="module")
def test_database(metadata, database_service):
    """Module-scoped database for table tests."""
    from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
    from metadata.generated.schema.entity.data.database import Database

    database_request = CreateDatabaseRequest(
        name="test-db",
        service=database_service.fullyQualifiedName,
    )
    database = metadata.create_or_update(data=database_request)

    yield database

    # Cleanup
    metadata.delete(entity=Database, entity_id=database.id, hard_delete=True)


@pytest.fixture(scope="module")
def test_schema(metadata, test_database):
    """Module-scoped database schema for table tests."""
    from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema

    schema_request = CreateDatabaseSchemaRequest(
        name="test-schema",
        database=test_database.fullyQualifiedName,
    )
    schema = metadata.create_or_update(data=schema_request)

    yield schema

    # Cleanup - recursive to delete any child tables
    metadata.delete(
        entity=DatabaseSchema, entity_id=schema.id, recursive=True, hard_delete=True
    )


@pytest.fixture
def table_request(test_schema):
    """Create table request using the test schema."""
    return CreateTableRequest(
        name="test",
        databaseSchema=test_schema.fullyQualifiedName,
        columns=[Column(name="id", dataType=DataType.BIGINT)],
    )


@pytest.fixture
def expected_fqn(database_service, test_database, test_schema):
    """Expected fully qualified name for test table."""
    return f"{database_service.name.root}.{test_database.name.root}.{test_schema.name.root}.test"


class TestOMetaTableAPI:
    """
    Table API integration tests.
    Tests CRUD operations, versioning, profiling, usage, and joins.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    - database_service: DatabaseService (module scope)
    - create_database: Database factory (function scope)
    - create_database_schema: DatabaseSchema factory (function scope)
    - create_table: Table factory (function scope)
    - create_user: User factory (function scope)
    """

    def test_create(
        self, metadata, test_schema, table_request, expected_fqn, create_table
    ):
        """
        We can create a Table and we receive it back as Entity
        """
        res = create_table(table_request)

        assert res.name.root == "test"
        assert res.databaseSchema.id == test_schema.id
        assert res.owners == EntityReferenceList(root=[])

        # Verify persistence by fetching from backend
        fetched = metadata.get_by_name(entity=Table, fqn=expected_fqn)
        assert fetched is not None
        assert fetched.id == res.id

    def test_update(
        self,
        metadata,
        test_schema,
        table_request,
        create_user,
        create_table,
    ):
        """
        Updating it properly changes its properties
        """
        user = create_user()
        owners = EntityReferenceList(
            root=[
                EntityReference(
                    id=user.id,
                    type="user",
                    fullyQualifiedName=user.fullyQualifiedName.root,
                )
            ]
        )

        # Create table
        res_create = create_table(table_request)

        # Update with owners
        updated = table_request.model_dump(exclude_unset=True)
        updated["owners"] = owners
        updated_entity = CreateTableRequest(**updated)

        res = metadata.create_or_update(data=updated_entity)

        # Verify update
        assert (
            res.databaseSchema.fullyQualifiedName == test_schema.fullyQualifiedName.root
        )
        assert res_create.id == res.id
        assert res.owners.root[0].id == user.id

    def test_get_name(self, metadata, table_request, expected_fqn, create_table):
        """
        We can fetch a Table by name and get it back as Entity
        """
        create_table(table_request)

        res = metadata.get_by_name(entity=Table, fqn=expected_fqn)
        assert res.name.root == "test"

        # Check that we get a None if the table does not exist
        nullable_res = metadata.get_by_name(entity=Table, fqn="something.made.up")
        assert nullable_res is None

    def test_get_id(self, metadata, table_request, expected_fqn, create_table):
        """
        We can fetch a Table by ID and get it back as Entity
        """
        create_table(table_request)

        # First pick up by name
        res_name = metadata.get_by_name(entity=Table, fqn=expected_fqn)
        # Then fetch by ID
        res = metadata.get_by_id(entity=Table, entity_id=str(res_name.id.root))

        assert res_name.id == res.id

    def test_list(
        self, metadata, database_service, test_database, table_request, create_table
    ):
        """
        We can list all our Tables
        """
        created = create_table(table_request)

        res = metadata.list_entities(
            entity=Table,
            params={
                "database": f"{database_service.name.root}.{test_database.name.root}"
            },
        )

        # Fetch our test Table. We have already inserted it, so we should find it
        data = next(iter(ent for ent in res.entities if ent.name == created.name), None)
        assert data is not None

    def test_list_all_and_paginate(
        self, metadata, database_service, test_database, table_request, create_table
    ):
        """
        Validate generator utility to fetch all tables
        """
        fake_create = deepcopy(table_request)
        for i in range(0, 10):
            fake_create.name = EntityName(table_request.name.root + str(i))
            create_table(fake_create)

        db_fqn = f"{database_service.name.root}.{test_database.name.root}"
        db_filter = {"database": db_fqn}

        all_entities = metadata.list_all_entities(
            entity=Table, limit=2, params=db_filter
        )
        assert len(list(all_entities)) >= 10

        entity_list = metadata.list_entities(entity=Table, limit=2, params=db_filter)
        assert len(entity_list.entities) == 2
        after_entity_list = metadata.list_entities(
            entity=Table, limit=2, after=entity_list.after, params=db_filter
        )
        assert len(after_entity_list.entities) == 2
        before_entity_list = metadata.list_entities(
            entity=Table, limit=2, before=after_entity_list.before, params=db_filter
        )
        assert before_entity_list.entities == entity_list.entities

    def test_delete(self, metadata, table_request, expected_fqn, create_table):
        """
        We can delete a Table by ID
        """
        created = create_table(table_request)

        # Delete
        metadata.delete(entity=Table, entity_id=str(created.id.root))

        # Verify deletion - get_by_name should return None
        deleted = metadata.get_by_name(entity=Table, fqn=expected_fqn)
        assert deleted is None

    def test_ingest_sample_data(
        self, metadata, table_request, expected_fqn, create_table
    ):
        """
        We can ingest sample TableData
        """
        create_table(table_request)

        res = metadata.get_by_name(entity=Table, fqn=expected_fqn)

        sample_data = TableData(columns=["id"], rows=[[1], [2], [3]])

        res_sample = metadata.ingest_table_sample_data(res, sample_data)
        assert res_sample == sample_data

        # Validate that we can properly retrieve sample data back
        res_sample = metadata.get_sample_data(table=res).sampleData
        assert res_sample == sample_data

    def test_patch_table_certification(
        self, metadata, table_request, expected_fqn, create_table
    ):
        """
        We can patch a Table with certification data
        """
        from metadata.generated.schema.type.assetCertification import AssetCertification
        from metadata.generated.schema.type.tagLabel import (
            LabelType,
            State,
            TagFQN,
            TagLabel,
            TagSource,
        )

        create_table(table_request)

        res = metadata.get_by_name(entity=Table, fqn=expected_fqn)

        # Create certification
        certification = AssetCertification(
            tagLabel=TagLabel(
                tagFQN=TagFQN("Certification.Bronze"),
                name="Bronze",
                description="Bronze certification indicates the asset meets basic quality standards",
                source=TagSource.Classification,
                labelType=LabelType.Manual,
                state=State.Confirmed,
            ),
            appliedDate=1704153600000,
            expiryDate=1735689600000,
        )

        # Patch the table with certification
        destination = res.model_copy(deep=True)
        destination.certification = certification
        patched_table = metadata.patch(
            entity=Table, source=res, destination=destination
        )

        # Verify certification was applied
        assert patched_table.certification is not None
        assert (
            patched_table.certification.tagLabel.tagFQN.root == "Certification.Bronze"
        )
        assert patched_table.certification.tagLabel.name == "Bronze"
        current_time_ms = int(datetime.now().timestamp() * 1000)
        assert (
            abs(patched_table.certification.appliedDate.root - current_time_ms) < 60000
        )
        assert patched_table.certification.expiryDate is not None

        # Retrieve the table again and verify certification persists
        retrieved_table = metadata.get_by_name(
            entity=Table, fqn=expected_fqn, fields=["certification"]
        )
        assert retrieved_table.certification is not None
        assert (
            retrieved_table.certification.tagLabel.tagFQN.root == "Certification.Bronze"
        )

    def test_ingest_table_profile_data(
        self, metadata, table_request, expected_fqn, create_table
    ):
        """
        We can ingest profile data TableProfile
        """
        create_table(table_request)

        res = metadata.get_by_name(entity=Table, fqn=expected_fqn)

        table_profile = TableProfile(
            timestamp=Timestamp(int(datetime.now().timestamp() * 1000)),
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
                timestamp=Timestamp(root=int(datetime.now().timestamp() * 1000)),
            )
        ]

        system_profile = [
            SystemProfile(
                timestamp=Timestamp(root=int(datetime.now().timestamp() * 1000)),
                operation=DmlOperationType.INSERT,
                rowsAffected=11,
            ),
            SystemProfile(
                timestamp=Timestamp(root=int(datetime.now().timestamp() * 1000) + 1),
                operation=DmlOperationType.UPDATE,
                rowsAffected=110,
            ),
        ]

        profile = CreateTableProfileRequest(
            tableProfile=table_profile,
            columnProfile=column_profile,
            systemProfile=system_profile,
        )
        metadata.ingest_profile_data(res, profile)

        table = metadata.get_latest_table_profile(expected_fqn)

        assert table.profile == table_profile

        res_column_profile = next(
            (col.profile for col in table.columns if col.name.root == "id")
        )
        assert res_column_profile == column_profile[0]

    def test_publish_table_usage(
        self, metadata, table_request, expected_fqn, create_table
    ):
        """
        We can POST usage data for a Table
        """
        create_table(table_request)

        res = metadata.get_by_name(entity=Table, fqn=expected_fqn)

        usage = UsageRequest(date="2021-10-20", count=10)

        metadata.publish_table_usage(res, usage)

    def test_publish_frequently_joined_with(
        self, metadata, test_schema, table_request, expected_fqn, create_table
    ):
        """
        We can PUT freq Table JOINs
        """
        create_table(table_request)

        res = metadata.get_by_name(entity=Table, fqn=expected_fqn)

        column_join_table_req = CreateTableRequest(
            name=EntityName("another-test"),
            databaseSchema=test_schema.fullyQualifiedName,
            columns=[Column(name=ColumnName("another_id"), dataType=DataType.BIGINT)],
        )
        column_join_table_res = metadata.create_or_update(column_join_table_req)

        direct_join_table_req = CreateTableRequest(
            name=EntityName("direct-join-test"),
            databaseSchema=test_schema.fullyQualifiedName,
            columns=[],
        )
        direct_join_table_res = metadata.create_or_update(direct_join_table_req)

        joins = TableJoins(
            startDate=Date(root=datetime.now(timezone.utc).date()),
            dayCount=1,
            directTableJoins=[
                JoinedWith(
                    fullyQualifiedName=direct_join_table_res.fullyQualifiedName,
                    joinCount=2,
                )
            ],
            columnJoins=[
                ColumnJoins(
                    columnName=ColumnName("id"),
                    joinedWith=[
                        JoinedWith(
                            fullyQualifiedName=FullyQualifiedEntityName(
                                f"{column_join_table_res.fullyQualifiedName.root}.another_id"
                            ),
                            joinCount=2,
                        )
                    ],
                )
            ],
        )

        metadata.publish_frequently_joined_with(res, joins)
        metadata.delete(entity=Table, entity_id=str(column_join_table_res.id.root))
        metadata.delete(entity=Table, entity_id=str(direct_join_table_res.id.root))

    def test_table_queries(
        self,
        metadata,
        database_service,
        create_user,
        table_request,
        expected_fqn,
        create_table,
    ):
        """
        Test add and update table query data
        """
        create_table(table_request)

        res = metadata.get_by_name(entity=Table, fqn=expected_fqn)

        query_no_user = CreateQueryRequest(
            query=SqlQuery("select * from first_awesome"),
            service=FullyQualifiedEntityName(database_service.name.root),
        )

        metadata.ingest_entity_queries_data(entity=res, queries=[query_no_user])
        table_with_query: List[Query] = metadata.get_entity_queries(
            res.id, fields=["*"]
        )

        assert len(table_with_query) == 1
        assert table_with_query[0].query == query_no_user.query
        assert table_with_query[0].users == []

        # Validate that we can properly add user information
        user = create_user()
        query_with_user = CreateQueryRequest(
            query="select * from second_awesome",
            users=[user.fullyQualifiedName],
            service=FullyQualifiedEntityName(database_service.name.root),
        )

        metadata.ingest_entity_queries_data(entity=res, queries=[query_with_user])
        table_with_query: List[Query] = metadata.get_entity_queries(
            res.id, fields=["*"]
        )

        assert len(table_with_query) == 2
        query_with_owner = next(
            (
                query
                for query in table_with_query
                if query.query == query_with_user.query
            ),
            None,
        )
        assert len(query_with_owner.users) == 1
        assert query_with_owner.users[0].id == user.id

    def test_list_versions(self, metadata, table_request, create_table):
        """
        Test listing table entity versions
        """
        created = create_table(table_request)

        res = metadata.get_list_entity_versions(entity=Table, entity_id=created.id.root)
        assert res is not None
        assert len(res.versions) >= 1

    def test_get_entity_version(self, metadata, table_request, create_table):
        """
        Test retrieving a specific table entity version
        """
        created = create_table(table_request)

        res = metadata.get_entity_version(
            entity=Table, entity_id=created.id.root, version=0.1
        )

        # Check we get the correct version requested and the correct entity ID
        assert res.version.root == 0.1
        assert res.id == created.id

    def test_get_entity_ref(self, metadata, table_request, create_table):
        """
        Test retrieving EntityReference for a table
        """
        res = create_table(table_request)
        entity_ref = metadata.get_entity_reference(
            entity=Table, fqn=res.fullyQualifiedName
        )

        assert res.id == entity_ref.id

    def test_update_profile_sample(
        self, metadata, table_request, expected_fqn, create_table
    ):
        """
        We can safely update the profile sample %
        """
        table = create_table(table_request)
        assert table.tableProfilerConfig is None

        metadata._create_or_update_table_profiler_config(
            table.id, table_profiler_config=TableProfilerConfig(profileSample=50.0)
        )

        stored = metadata.get_by_name(
            entity=Table, fqn=table.fullyQualifiedName, fields=["tableProfilerConfig"]
        )
        assert stored.tableProfilerConfig.profileSample == 50.0

    def test_list_w_skip_on_failure(self, metadata):
        """
        We can list all our Tables even when some of them are broken
        """
        # First validate that exception is raised when skip_on_failure is False
        with patch.object(REST, "get", return_value=BAD_RESPONSE):
            with pytest.raises(ValidationError):
                metadata.list_entities(entity=Table)

        with patch.object(REST, "get", return_value=BAD_RESPONSE):
            res = metadata.list_entities(entity=Table, skip_on_failure=True)

        # We should have 2 tables, the 3rd one is broken and should be skipped
        assert len(res.entities) == 2

    def test_list_all_w_skip_on_failure(self, metadata):
        """
        Validate generator utility to fetch all tables even when some of them are broken
        """
        # First validate that exception is raised when skip_on_failure is False
        with patch.object(REST, "get", return_value=BAD_RESPONSE):
            with pytest.raises(ValidationError):
                res = metadata.list_all_entities(entity=Table, limit=1)
                list(res)

        with patch.object(REST, "get", return_value=BAD_RESPONSE):
            res = metadata.list_all_entities(
                entity=Table, limit=1, skip_on_failure=True
            )

            # We should have 2 tables, the 3rd one is broken and should be skipped
            assert len(list(res)) == 2

    def test_table_with_slash_in_name(self, metadata, test_schema):
        """E.g., `foo.bar/baz`"""
        name = EntityName("foo.bar/baz")
        new_table: Table = metadata.create_or_update(
            data=get_create_entity(
                entity=Table,
                name=name,
                reference=test_schema.fullyQualifiedName,
            )
        )

        res: Table = metadata.get_by_name(
            entity=Table, fqn=new_table.fullyQualifiedName
        )

        assert res.name == name

        # Cleanup
        metadata.delete(entity=Table, entity_id=str(new_table.id.root))

    def test_ingest_sample_data_with_binary_data(self, metadata, test_schema):
        """
        Test ingesting sample data with binary data
        """
        table: Table = metadata.create_or_update(
            data=get_create_entity(
                entity=Table,
                name="random",
                reference=test_schema.fullyQualifiedName,
            )
        )
        sample_data = TableData(
            columns=["id"], rows=[[b"data\x00\x01\x02\x8e\xba\xab\xf0"]]
        )
        res = metadata.ingest_table_sample_data(table, sample_data)
        assert res == sample_data

        sample_data = TableData(columns=["id"], rows=[[b"\x00\x01\x02"]])
        res = metadata.ingest_table_sample_data(table, sample_data)
        assert res == sample_data

        # Cleanup
        metadata.delete(entity=Table, entity_id=str(table.id.root))
