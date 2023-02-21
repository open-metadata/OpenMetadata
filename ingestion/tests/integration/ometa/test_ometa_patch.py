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
import time
import logging
from typing import Union

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
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.helpers import find_column_in_table
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.type import basic


class OMetaTableTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None
    entity_id = None
    db_entity_id: Union[str, basic.Uuid] = None
    db_schema_entity_id: Union[str, basic.Uuid] = None
    user_1: User = None
    user_2: User = None
    team_1: Team = None
    team_2: Team = None

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
    def check_es_index(cls) -> None:
        """
        Wait until the index has been updated with the test user.
        """
        logging.info("Checking ES index status...")
        tries = 0

        res = None
        while not res and tries <= 5:  # Kill in 5 seconds

            res = cls.metadata.es_search_from_fqn(
                entity_type=User,
                fqn_search_string="Levy",
            )
            if not res:
                tries += 1
                time.sleep(1)

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
        cls.db_entity_id = create_db_entity.id

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema",
            database=create_db_entity.fullyQualifiedName,
        )

        create_schema_entity = cls.metadata.create_or_update(data=create_schema)
        cls.db_schema_entity_id = create_schema_entity.id

        cls.create = CreateTableRequest(
            name="test",
            databaseSchema=create_schema_entity.fullyQualifiedName,
            columns=[
                Column(name="id", dataType=DataType.BIGINT),
                Column(name="another", dataType=DataType.BIGINT),
            ],
        )

        res: Table = cls.metadata.create_or_update(data=cls.create)
        cls.entity_id = res.id

        cls.user_1 = cls.metadata.create_or_update(
            data=CreateUserRequest(
                name="random.user", email="random.user@getcollate.io"
            ),
        )

        cls.user_2 = cls.metadata.create_or_update(
            data=CreateUserRequest(name="Levy", email="user2.1234@getcollate.io"),
        )

        cls.team_1 = cls.metadata.create_or_update(
            data=CreateTeamRequest(
                name="Team 1",
                teamType="Group",
                users=[cls.user_1.id, cls.user_2.id],
            )
        )

        cls.team_2 = cls.metadata.create_or_update(
            data=CreateTeamRequest(
                name="Team 2",
                teamType="Group",
                users=[cls.user_2.id]
            )
        )

        # Leave some time for indexes to get updated, otherwise this happens too fast
        cls.check_es_index()

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

        cls.metadata.delete(
            entity=User,
            entity_id=cls.user_1.id,
            hard_delete=True,
        )

        cls.metadata.delete(
            entity=User,
            entity_id=cls.user_2.id,
            hard_delete=True,
        )

        cls.metadata.delete(
            entity=Team,
            entity_id=cls.team_1.id,
            hard_delete=True,
        )

        cls.metadata.delete(
            entity=Team,
            entity_id=cls.team_2.id,
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

    def test_patch_tag(self):
        """
        Update table tags
        """

        updated: Table = self.metadata.patch_tag(
            entity=Table,
            entity_id=self.entity_id,
            tag_fqn="PII.Sensitive",  # Shipped by default
        )
        assert updated.tags[0].tagFQN.__root__ == "PII.Sensitive"

        updated: Table = self.metadata.patch_tag(
            entity=Table,
            entity_id=self.entity_id,
            tag_fqn="Tier.Tier2",  # Shipped by default
        )
        assert updated.tags[0].tagFQN.__root__ == "PII.Sensitive"
        assert updated.tags[1].tagFQN.__root__ == "Tier.Tier2"

    def test_patch_column_tags(self):
        """
        Update column tags
        """
        updated: Table = self.metadata.patch_column_tag(
            entity_id=self.entity_id,
            tag_fqn="PII.Sensitive",  # Shipped by default
            column_name="id",
        )
        updated_col = find_column_in_table(column_name="id", table=updated)

        assert updated_col.tags[0].tagFQN.__root__ == "PII.Sensitive"

        updated_again: Table = self.metadata.patch_column_tag(
            entity_id=self.entity_id,
            tag_fqn="Tier.Tier2",  # Shipped by default
            column_name="id",
        )
        updated_again_col = find_column_in_table(column_name="id", table=updated_again)

        assert updated_again_col.tags[0].tagFQN.__root__ == "PII.Sensitive"
        assert updated_again_col.tags[1].tagFQN.__root__ == "Tier.Tier2"

    def test_patch_owner(self):
        """
        Update owner
        """
        # Database, no existing owner, owner is a User -> Modified
        updated: Database = self.metadata.patch_owner(
            entity=Database,
            entity_id=self.db_entity_id,
            owner_entity=User,
            owner_id=self.user_1.id,
        )
        assert updated.owner.id == self.user_1.id

        # Database, existing owner, owner is a User, no force -> Unmodified
        updated: Database = self.metadata.patch_owner(
            entity=Database,
            entity_id=self.db_entity_id,
            owner_entity=User,
            owner_id=self.user_2.id,
        )
        assert updated is None

        # Database, existing owner, owner is a User, force -> Modified
        updated: Database = self.metadata.patch_owner(
            entity=Database,
            entity_id=self.db_entity_id,
            owner_entity=User,
            owner_id=self.user_2.id,
            force=True,
        )
        assert updated.owner.id == self.user_2.id

        # Database, existing owner, no owner, no force -> Unmodified
        updated: Database = self.metadata.patch_owner(
            entity=Database,
            entity_id=self.db_entity_id,
        )
        assert updated is None

        # Database, existing owner, no owner, force -> Modified
        updated: Database = self.metadata.patch_owner(
            entity=Database,
            entity_id=self.db_entity_id,
            force=True,
        )
        assert updated.owner is None

        # DatabaseSchema, no existing owner, owner is Team -> Modified
        updated: DatabaseSchema = self.metadata.patch_owner(
            entity=DatabaseSchema,
            entity_id=self.db_schema_entity_id,
            owner_entity=Team,
            owner_id=self.team_1.id,
        )
        assert updated.owner.id == self.team_1.id

        # DatabaseSchema, existing owner, owner is Team, no force -> Unmodified
        updated: DatabaseSchema = self.metadata.patch_owner(
            entity=DatabaseSchema,
            entity_id=self.db_schema_entity_id,
            owner_entity=Team,
            owner_id=self.team_2.id,
        )
        assert updated is None

        # DatabaseSchema, existing owner, owner is Team, force -> Modified
        updated: DatabaseSchema = self.metadata.patch_owner(
            entity=DatabaseSchema,
            entity_id=self.db_schema_entity_id,
            owner_entity=Team,
            owner_id=self.team_2.id,
            force=True,
        )
        assert updated.owner.id == self.team_2.id

        # DatabaseSchema, existing owner, no owner, no force -> Unmodified
        updated: DatabaseSchema = self.metadata.patch_owner(
            entity=DatabaseSchema,
            entity_id=self.db_schema_entity_id,
        )
        assert updated is None

        # DatabaseSchema, existing owner, no owner, force -> Modified
        updated: DatabaseSchema = self.metadata.patch_owner(
            entity=DatabaseSchema,
            entity_id=self.db_schema_entity_id,
            force=True,
        )
        assert updated.owner is None

        # Table, no existing owner, owner is a Team -> Modified
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            entity_id=self.entity_id,
            owner_entity=Team,
            owner_id=self.team_1.id,
        )
        assert updated.owner.id == self.team_1.id

        # Table, existing owner, owner is a Team, no force -> Unmodified
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            entity_id=self.entity_id,
            owner_entity=Team,
            owner_id=self.team_2.id,
        )
        assert updated is None

        # Table, existing owner, owner is a Team, force -> Modified
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            entity_id=self.entity_id,
            owner_entity=Team,
            owner_id=self.team_2.id,
            force=True,
        )
        assert updated.owner.id == self.team_2.id

        # Table, existing owner, no owner, no force -> Unmodified
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            entity_id=self.entity_id,
        )
        assert updated is None

        # Table, existing owner, no owner, no force -> Modified
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            entity_id=self.entity_id,
            force=True,
        )
        assert updated.owner is None

        # Table with non-existent id, existing owner, no owner, force -> Unmodified
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            entity_id='9facb7b3-1dee-4017-8fca-1254b700afef',
            force=True,
        )
        assert updated is None

        # Table, existing owner, owner entity but no owner ID, force -> Unmodified
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            entity_id=self.entity_id,
            owner_entity=Team,
            force=True,
        )
        assert updated is None

        # Table, existing owner, no owner entity but valid owner ID, force -> Unmodified
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            entity_id=self.entity_id,
            owner_id=self.user_1.id,
            force=True,
        )
        assert updated is None

        # Table, existing owner, invalid owner entity but valid owner ID, force -> Unmodified
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            entity_id=self.entity_id,
            owner_entity=Table,
            owner_id=self.entity_id,
            force=True,
        )
        assert updated is None
