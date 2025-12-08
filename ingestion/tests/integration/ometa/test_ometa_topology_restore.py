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
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
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
from metadata.generated.schema.type.basic import Markdown
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class TopologyRestoreTest(TestCase):
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
        name="test-service-topology-restore",
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

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients
        """
        cls.service_entity = cls.metadata.create_or_update(data=cls.service)

        create_db = CreateDatabaseRequest(
            name="test-db-topology-restore",
            service=cls.service_entity.fullyQualifiedName,
        )

        cls.create_db_entity = cls.metadata.create_or_update(data=create_db)

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema-topology-restore",
            database=cls.create_db_entity.fullyQualifiedName,
        )

        cls.create_schema_entity = cls.metadata.create_or_update(data=create_schema)

        columns = [
            Column(
                name="id",
                dataType=DataType.BIGINT,
                description=Markdown("Primary key"),
            ),
            Column(
                name="name",
                dataType=DataType.VARCHAR,
                description=Markdown("Name field"),
            ),
        ]

        create = CreateTableRequest(
            name="test-topology-restore-table",
            databaseSchema=cls.create_schema_entity.fullyQualifiedName,
            columns=columns,
            description=Markdown("Test table for restore functionality"),
        )
        cls.table_entity = cls.metadata.create_or_update(create)

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """
        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn=cls.service.name.root
            ).id.root
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_restore_deleted_entity(self):
        """
        Test that a deleted entity can be restored using the restore API
        """
        table_id = str(self.table_entity.id.root)
        table_fqn = self.table_entity.fullyQualifiedName.root

        # Soft delete the table
        self.metadata.delete(
            entity=Table,
            entity_id=table_id,
            hard_delete=False,
        )

        # Verify the table is deleted
        deleted_table = self.metadata.get_by_name(
            entity=Table, fqn=table_fqn, fields=["*"], include="all"
        )
        self.assertIsNotNone(deleted_table)
        self.assertTrue(deleted_table.deleted)

        # Restore the table
        restored_table = self.metadata.restore(entity=Table, entity_id=table_id)

        # Verify restoration
        self.assertIsNotNone(restored_table)
        self.assertFalse(restored_table.deleted)
        self.assertEqual(restored_table.id.root, self.table_entity.id.root)
        self.assertEqual(
            restored_table.fullyQualifiedName.root,
            self.table_entity.fullyQualifiedName.root,
        )

        # Verify we can fetch it without include="all"
        active_table = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
        self.assertIsNotNone(active_table)
        self.assertFalse(active_table.deleted)

    def test_restore_deleted_entity_with_same_source_hash(self):
        """
        Test that a deleted entity with the same sourceHash gets restored
        This simulates the topology runner scenario where an entity is deleted
        but the source data hasn't changed
        """
        table_id = str(self.table_entity.id.root)
        table_fqn = self.table_entity.fullyQualifiedName.root

        # Get the original sourceHash
        original_table = self.metadata.get_by_name(
            entity=Table, fqn=table_fqn, fields=["sourceHash"]
        )
        original_source_hash = original_table.sourceHash

        # Soft delete the table
        self.metadata.delete(
            entity=Table,
            entity_id=table_id,
            hard_delete=False,
        )

        # Verify deletion
        deleted_table = self.metadata.get_by_name(
            entity=Table, fqn=table_fqn, fields=["*"], include="all"
        )
        self.assertTrue(deleted_table.deleted)

        # Restore the entity
        restored_table = self.metadata.restore(entity=Table, entity_id=table_id)

        # Verify restoration
        self.assertIsNotNone(restored_table)
        self.assertFalse(restored_table.deleted)

        # Verify sourceHash is preserved
        restored_with_hash = self.metadata.get_by_name(
            entity=Table, fqn=table_fqn, fields=["sourceHash"]
        )
        self.assertEqual(restored_with_hash.sourceHash, original_source_hash)

    def test_restore_nonexistent_entity(self):
        """
        Test that restoring a nonexistent entity returns None
        """
        fake_id = "00000000-0000-0000-0000-000000000000"
        result = self.metadata.restore(entity=Table, entity_id=fake_id)
        self.assertIsNone(result)

    def test_restore_already_active_entity(self):
        """
        Test that restoring an already active entity works without error
        """
        table_id = str(self.table_entity.id.root)

        # Ensure table is not deleted
        active_table = self.metadata.get_by_name(
            entity=Table,
            fqn=self.table_entity.fullyQualifiedName.root,
        )
        self.assertFalse(active_table.deleted)

        # Try to restore an already active entity
        restored_table = self.metadata.restore(entity=Table, entity_id=table_id)

        # Should still succeed
        self.assertIsNotNone(restored_table)
        self.assertFalse(restored_table.deleted)
