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
Topology Restore Integration Test
"""
import pytest

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, DataType, Table
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
from metadata.generated.schema.type.basic import Markdown

from ..integration_base import generate_name


@pytest.fixture(scope="module")
def restore_service(metadata):
    """Module-scoped database service for topology restore tests."""
    service_name = generate_name()
    service_request = CreateDatabaseServiceRequest(
        name=service_name,
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
    service_entity = metadata.create_or_update(data=service_request)

    yield service_entity

    service_id = str(
        metadata.get_by_name(
            entity=DatabaseService, fqn=service_request.name.root
        ).id.root
    )
    metadata.delete(
        entity=DatabaseService,
        entity_id=service_id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def restore_database(metadata, restore_service):
    """Module-scoped database for topology restore tests."""
    database_name = generate_name()
    database_request = CreateDatabaseRequest(
        name=database_name,
        service=restore_service.fullyQualifiedName,
    )
    database = metadata.create_or_update(data=database_request)

    yield database

    metadata.delete(entity=Database, entity_id=database.id, hard_delete=True)


@pytest.fixture(scope="module")
def restore_schema(metadata, restore_database):
    """Module-scoped schema for topology restore tests."""
    schema_name = generate_name()
    schema_request = CreateDatabaseSchemaRequest(
        name=schema_name,
        database=restore_database.fullyQualifiedName,
    )
    schema = metadata.create_or_update(data=schema_request)

    yield schema

    metadata.delete(
        entity=DatabaseSchema, entity_id=schema.id, recursive=True, hard_delete=True
    )


@pytest.fixture(scope="module")
def restore_columns():
    """Standard columns for restore tests."""
    return [
        Column(
            name="id",
            dataType=DataType.BIGINT,
            description=Markdown("Primary key"),
        ),
        Column(
            name="name",
            dataType=DataType.VARCHAR,
            dataLength=255,
            description=Markdown("Name field"),
        ),
    ]


@pytest.fixture(scope="module")
def restore_table(metadata, restore_schema, restore_columns):
    """Module-scoped table for topology restore tests."""
    table_name = generate_name()
    table_request = CreateTableRequest(
        name=table_name,
        databaseSchema=restore_schema.fullyQualifiedName,
        columns=restore_columns,
        description=Markdown("Test table for restore functionality"),
    )
    table = metadata.create_or_update(table_request)

    yield table

    metadata.delete(entity=Table, entity_id=table.id, hard_delete=True)


class TestOMetaTopologyRestoreAPI:
    """
    Topology Restore API integration tests.
    Tests soft delete and restore operations for entities.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    def test_restore_deleted_entity(self, metadata, restore_table):
        """
        Test that a deleted entity can be restored using the restore API
        """
        table_id = str(restore_table.id.root)
        table_fqn = restore_table.fullyQualifiedName.root

        metadata.delete(
            entity=Table,
            entity_id=table_id,
            hard_delete=False,
        )

        deleted_table = metadata.get_by_name(
            entity=Table, fqn=table_fqn, fields=["*"], include="all"
        )
        assert deleted_table is not None
        assert deleted_table.deleted is True

        restored_table = metadata.restore(entity=Table, entity_id=table_id)

        assert restored_table is not None
        assert restored_table.deleted is False
        assert restored_table.id.root == restore_table.id.root
        assert (
            restored_table.fullyQualifiedName.root
            == restore_table.fullyQualifiedName.root
        )

        active_table = metadata.get_by_name(entity=Table, fqn=table_fqn)
        assert active_table is not None
        assert active_table.deleted is False

    def test_restore_deleted_entity_with_same_source_hash(
        self, metadata, restore_table
    ):
        """
        Test that a deleted entity with the same sourceHash gets restored
        This simulates the topology runner scenario where an entity is deleted
        but the source data hasn't changed
        """
        table_id = str(restore_table.id.root)
        table_fqn = restore_table.fullyQualifiedName.root

        original_table = metadata.get_by_name(
            entity=Table, fqn=table_fqn, fields=["sourceHash"]
        )
        original_source_hash = original_table.sourceHash

        metadata.delete(
            entity=Table,
            entity_id=table_id,
            hard_delete=False,
        )

        deleted_table = metadata.get_by_name(
            entity=Table, fqn=table_fqn, fields=["*"], include="all"
        )
        assert deleted_table.deleted is True

        restored_table = metadata.restore(entity=Table, entity_id=table_id)

        assert restored_table is not None
        assert restored_table.deleted is False

        restored_with_hash = metadata.get_by_name(
            entity=Table, fqn=table_fqn, fields=["sourceHash"]
        )
        assert restored_with_hash.sourceHash == original_source_hash

    def test_restore_nonexistent_entity(self, metadata):
        """
        Test that restoring a nonexistent entity returns None
        """
        fake_id = "00000000-0000-0000-0000-000000000000"
        result = metadata.restore(entity=Table, entity_id=fake_id)
        assert result is None

    def test_restore_already_active_entity(self, metadata, restore_table):
        """
        Test that restoring an already active entity returns None
        """
        table_id = str(restore_table.id.root)

        active_table = metadata.get_by_name(
            entity=Table,
            fqn=restore_table.fullyQualifiedName.root,
        )
        assert active_table.deleted is False

        restored_table = metadata.restore(entity=Table, entity_id=table_id)

        assert restored_table is None
