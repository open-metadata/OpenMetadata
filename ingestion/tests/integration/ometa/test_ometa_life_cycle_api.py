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
OpenMetadata high-level API Table Life Cycle test
"""
import uuid
from unittest import TestCase

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
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
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.lifeCycle import AccessDetails, LifeCycle
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OMetaLifeCycleTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    created_user: User = metadata.create_or_update(
        data=CreateUserRequest(name="created-user", email="created@user.com"),
    )
    updated_user: User = metadata.create_or_update(
        data=CreateUserRequest(name="updated-user", email="updated@user.com"),
    )

    created_user_ref = EntityReference(
        id=created_user.id,
        type="user",
        fullyQualifiedName=created_user.fullyQualifiedName.__root__,
    )
    updated_user_ref = EntityReference(
        id=updated_user.id,
        type="user",
        fullyQualifiedName=updated_user.fullyQualifiedName.__root__,
    )

    service = CreateDatabaseServiceRequest(
        name="test-service-lifecycle",
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
            fullyQualifiedName="test-service-lifecycle.test-db.test-schema.test",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.create = CreateTableRequest(
            name="test",
            databaseSchema=cls.create_schema_entity.fullyQualifiedName,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.life_cycle = LifeCycle(
            created=AccessDetails(
                timestamp=1693569600000, accessedBy=cls.created_user_ref
            ),
            updated=AccessDetails(
                timestamp=1693665000000,
                accessedBy=cls.updated_user_ref,
            ),
            accessed=AccessDetails(
                timestamp=1693755900000, accessedByAProcess="OpenMetadata"
            ),
        )

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn="test-service-lifecycle"
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

    def test_ingest_life_cycle(self):
        """
        Test the life cycle API
        """

        table_entity = self.metadata.get_by_name(
            entity=Table, fqn=self.entity.fullyQualifiedName
        )

        self.metadata.patch_life_cycle(entity=table_entity, life_cycle=self.life_cycle)

    def test_life_cycle_get_methods(self):
        """
        We can fetch a Table by name/id and pass the field for lifeCycle
        """

        # test the get_by_name api
        res = self.metadata.get_by_name(
            entity=Table, fqn=self.entity.fullyQualifiedName, fields=["lifeCycle"]
        )
        self.assertEqual(res.lifeCycle, self.life_cycle)

        # test the get_by_iod api
        res_id = self.metadata.get_by_id(
            entity=Table, entity_id=str(res.id.__root__), fields=["lifeCycle"]
        )
        self.assertEqual(res_id.lifeCycle, self.life_cycle)

    def test_update_life_cycle(self):
        """
        Test the update of life cycle fields for a entity
        Only the latest information should get updated for the life cycle fields.
        """

        table_entity = self.metadata.get_by_name(
            entity=Table, fqn=self.entity.fullyQualifiedName
        )
        new_accessed = AccessDetails(
            timestamp=1694015100000,
            accessedBy=self.updated_user_ref,
        )

        new_updated = AccessDetails(
            timestamp=1693578600000,
            accessedBy=self.updated_user_ref,
        )

        self.metadata.patch_life_cycle(
            entity=table_entity,
            life_cycle=LifeCycle(accessed=new_accessed, updated=new_updated),
        )

        res = self.metadata.get_by_name(
            entity=Table, fqn=self.entity.fullyQualifiedName, fields=["lifeCycle"]
        )
        self.assertEqual(self.life_cycle.created, res.lifeCycle.created)
        self.assertEqual(new_accessed, res.lifeCycle.accessed)
        self.assertNotEqual(new_updated, res.lifeCycle.updated)
