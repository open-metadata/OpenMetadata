"""
OpenMetadata high-level API Database test
"""
import uuid
from unittest import TestCase

from metadata.generated.schema.api.data.createDatabase import (
    CreateDatabaseEntityRequest,
)
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceEntityRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserEntityRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.jdbcConnection import JdbcInfo
from metadata.ingestion.ometa.ometa_api import OMeta
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig


class OMetaDatabaseTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = MetadataServerConfig(api_endpoint="http://localhost:8585/api")
    metadata = OMeta(server_config)

    user = metadata.create_or_update(
        entity=CreateUserEntityRequest,
        data=CreateUserEntityRequest(name="random-user", email="random@user.com"),
    )
    owner = EntityReference(id=user.id, type="user")

    service = CreateDatabaseServiceEntityRequest(
        name="test-service",
        serviceType=DatabaseServiceType.MySQL,
        jdbc=JdbcInfo(driverClass="jdbc", connectionUrl="jdbc://localhost"),
    )

    def setUp(self) -> None:
        """
        Prepare ingredients
        """
        self.service_entity = self.metadata.create_or_update(
            entity=CreateDatabaseServiceEntityRequest, data=self.service
        )

        self.entity = Database(
            id=uuid.uuid4(),
            name="test-db",
            service=EntityReference(id=self.service_entity.id, type="databaseService"),
            fullyQualifiedName="test-service.test-db",
        )
        self.create = CreateDatabaseEntityRequest(
            name="test-db",
            service=EntityReference(id=self.service_entity.id, type="databaseService"),
        )

        self.service_entity_id = str(self.service_entity.id.__root__)

    def tearDown(self) -> None:
        """
        Clean up
        """
        self.metadata.delete(entity=DatabaseService, entity_id=self.service_entity_id)

    def test_create(self):
        """
        We can create a Database and we receive it back as Entity
        """

        res = self.metadata.create_or_update(
            entity=CreateDatabaseEntityRequest, data=self.create
        )

        self.assertEqual(res.name, self.create.name)
        self.assertEqual(res.service.id, self.create.service.id)
        self.assertEqual(res.owner, None)

    def test_update(self):
        """
        Updating it properly changes its properties
        """

        res_create = self.metadata.create_or_update(
            entity=CreateDatabaseEntityRequest, data=self.create
        )

        updated = self.entity.dict(exclude_unset=True)
        updated["owner"] = self.owner
        updated_entity = Database(**updated)

        res = self.metadata.create_or_update(entity=Database, data=updated_entity)

        # Same ID, updated algorithm
        self.assertEqual(res.service.id, updated_entity.service.id)
        self.assertEqual(res_create.id, res.id)
        self.assertEqual(res.owner.id, self.user.id)

    def test_get_name(self):
        """
        We can fetch a Database by name and get it back as Entity
        """

        self.metadata.create_or_update(entity=Database, data=self.entity)

        res = self.metadata.get_by_name(
            entity=Database, fqdn=self.entity.fullyQualifiedName
        )
        self.assertEqual(res.name, self.entity.name)

    def test_get_id(self):
        """
        We can fetch a Database by ID and get it back as Entity
        """

        self.metadata.create_or_update(entity=Database, data=self.entity)

        # First pick up by name
        res_name = self.metadata.get_by_name(
            entity=Database, fqdn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res = self.metadata.get_by_id(
            entity=Database, entity_id=str(res_name.id.__root__)
        )

        self.assertEqual(res_name.id, res.id)

    def test_list(self):
        """
        We can list all our Database
        """

        self.metadata.create_or_update(entity=Database, data=self.entity)

        res = self.metadata.list_entities(entity=Database)

        # Fetch our test Database. We have already inserted it, so we should find it
        data = next(
            iter(ent for ent in res.entities if ent.name == self.entity.name), None
        )
        assert data

    def test_delete(self):
        """
        We can delete a Database by ID
        """

        self.metadata.create_or_update(entity=Database, data=self.entity)

        # Find by name
        res_name = self.metadata.get_by_name(
            entity=Database, fqdn=self.entity.fullyQualifiedName
        )
        # Then fetch by ID
        res_id = self.metadata.get_by_id(
            entity=Database, entity_id=str(res_name.id.__root__)
        )

        # Delete
        self.metadata.delete(entity=Database, entity_id=str(res_id.id.__root__))

        # Then we should not find it
        res = self.metadata.list_entities(entity=Database)
        print(res)
        assert not next(
            iter(ent for ent in res.entities if ent.name == self.entity.name), None
        )
