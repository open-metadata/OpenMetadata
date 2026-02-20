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
OpenMetadata high-level API Table Life Cycle test
"""
import pytest

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.lifeCycle import AccessDetails, LifeCycle


@pytest.fixture(scope="module")
def test_database(metadata, database_service):
    """Module-scoped database for life cycle tests."""
    from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
    from metadata.generated.schema.entity.data.database import Database

    database_request = CreateDatabaseRequest(
        name="test-db-lifecycle",
        service=database_service.fullyQualifiedName,
    )
    database = metadata.create_or_update(data=database_request)

    yield database

    metadata.delete(entity=Database, entity_id=database.id, hard_delete=True)


@pytest.fixture(scope="module")
def test_schema(metadata, test_database):
    """Module-scoped database schema for life cycle tests."""
    from metadata.generated.schema.api.data.createDatabaseSchema import (
        CreateDatabaseSchemaRequest,
    )
    from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema

    schema_request = CreateDatabaseSchemaRequest(
        name="test-schema-lifecycle",
        database=test_database.fullyQualifiedName,
    )
    schema = metadata.create_or_update(data=schema_request)

    yield schema

    metadata.delete(
        entity=DatabaseSchema, entity_id=schema.id, recursive=True, hard_delete=True
    )


@pytest.fixture(scope="module")
def created_user(metadata):
    """User representing entity creator."""
    user = metadata.create_or_update(
        data=CreateUserRequest(name="created-user", email="created@user.com")
    )

    yield user

    metadata.delete(entity=User, entity_id=user.id, hard_delete=True)


@pytest.fixture(scope="module")
def updated_user(metadata):
    """User representing entity updater."""
    user = metadata.create_or_update(
        data=CreateUserRequest(name="updated-user", email="updated@user.com")
    )

    yield user

    metadata.delete(entity=User, entity_id=user.id, hard_delete=True)


@pytest.fixture(scope="module")
def life_cycle(created_user, updated_user):
    """Life cycle with access details."""
    created_user_ref = EntityReference(
        id=created_user.id,
        type="user",
        fullyQualifiedName=created_user.fullyQualifiedName.root,
    )
    updated_user_ref = EntityReference(
        id=updated_user.id,
        type="user",
        fullyQualifiedName=updated_user.fullyQualifiedName.root,
    )

    return LifeCycle(
        created=AccessDetails(timestamp=1693569600000, accessedBy=created_user_ref),
        updated=AccessDetails(timestamp=1693665000000, accessedBy=updated_user_ref),
        accessed=AccessDetails(
            timestamp=1693755900000, accessedByAProcess="OpenMetadata"
        ),
    )


class TestOMetaLifeCycleAPI:
    """
    Life Cycle API integration tests.
    Tests entity life cycle tracking (creation, updates, access timestamps).

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    - database_service: DatabaseService (module scope)
    - create_table: Table factory (function scope)
    """

    def create_table_entity(self, metadata, test_schema, name: str) -> Table:
        """Helper to create a table for life cycle testing."""
        create = CreateTableRequest(
            name=name,
            databaseSchema=test_schema.fullyQualifiedName,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )
        return metadata.create_or_update(create)

    def test_create(self, metadata, test_schema):
        """
        We can create a Table and we receive it back as Entity
        """
        res = self.create_table_entity(metadata, test_schema, "test_create")

        assert res.name.root == "test_create"
        assert res.databaseSchema.id == test_schema.id
        assert res.owners == EntityReferenceList(root=[])

    def test_ingest_life_cycle(self, metadata, test_schema, life_cycle):
        """
        Test the life cycle API
        """
        table_entity = self.create_table_entity(
            metadata, test_schema, "test_ingest_life_cycle"
        )

        metadata.patch_life_cycle(entity=table_entity, life_cycle=life_cycle)

    def test_life_cycle_get_methods(
        self, metadata, database_service, test_database, test_schema, life_cycle
    ):
        """
        We can fetch a Table by name/id and pass the field for lifeCycle
        """
        entity = self.create_table_entity(
            metadata, test_schema, "test_life_cycle_get_methods"
        )
        metadata.patch_life_cycle(entity=entity, life_cycle=life_cycle)

        expected_fqn = f"{database_service.name.root}.{test_database.name.root}.{test_schema.name.root}.test_life_cycle_get_methods"

        res = metadata.get_by_name(
            entity=Table,
            fqn=expected_fqn,
            fields=["lifeCycle"],
        )
        assert res.lifeCycle == life_cycle

        res_id = metadata.get_by_id(
            entity=Table, entity_id=str(res.id.root), fields=["lifeCycle"]
        )
        assert res_id.lifeCycle == life_cycle

    def test_update_life_cycle(
        self,
        metadata,
        database_service,
        test_database,
        test_schema,
        life_cycle,
        updated_user,
    ):
        """
        Test the update of life cycle fields for a entity
        Only the latest information should get updated for the life cycle fields.
        """
        entity = self.create_table_entity(
            metadata, test_schema, "test_update_life_cycle"
        )

        metadata.patch_life_cycle(entity=entity, life_cycle=life_cycle)

        updated_user_ref = EntityReference(
            id=updated_user.id,
            type="user",
            fullyQualifiedName=updated_user.fullyQualifiedName.root,
        )

        new_accessed = AccessDetails(
            timestamp=1694015100000,
            accessedBy=updated_user_ref,
        )

        new_updated = AccessDetails(
            timestamp=1693578600000,
            accessedBy=updated_user_ref,
        )

        expected_fqn = f"{database_service.name.root}.{test_database.name.root}.{test_schema.name.root}.test_update_life_cycle"

        updated_entity = metadata.get_by_name(
            entity=Table,
            fqn=expected_fqn,
            fields=["lifeCycle"],
        )
        metadata.patch_life_cycle(
            entity=updated_entity,
            life_cycle=LifeCycle(accessed=new_accessed, updated=new_updated),
        )

        res = metadata.get_by_name(
            entity=Table,
            fqn=expected_fqn,
            fields=["lifeCycle"],
        )

        assert life_cycle.created == res.lifeCycle.created
        assert new_accessed == res.lifeCycle.accessed
        assert new_updated != res.lifeCycle.updated
