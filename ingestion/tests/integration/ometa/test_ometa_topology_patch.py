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
Topology Patch Integration Test
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
from metadata.generated.schema.type.basic import Markdown
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagFQN,
    TagLabel,
    TagSource,
)
from metadata.ingestion.models.patch_request import (
    ALLOWED_COMMON_PATCH_FIELDS,
    ARRAY_ENTITY_FIELDS,
    RESTRICT_UPDATE_LIST,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

PII_TAG_LABEL = TagLabel(
    tagFQN=TagFQN("PII.Sensitive"),
    labelType=LabelType.Automated,
    state=State.Suggested.value,
    source=TagSource.Classification,
    name="Sensitive",
)

TIER_TAG_LABEL = TagLabel(
    tagFQN=TagFQN("Tier.Tier2"),
    labelType=LabelType.Automated,
    state=State.Suggested.value,
    source=TagSource.Classification,
    name="Tier2",
)

PERSONAL_TAG_LABEL = TagLabel(
    tagFQN=TagFQN("PersonalData.Personal"),
    labelType=LabelType.Automated,
    state=State.Suggested.value,
    source=TagSource.Classification,
    name="Personal",
)


class TopologyPatchTest(TestCase):
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
        name="test-service-topology-patch",
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

        user: User = cls.metadata.create_or_update(
            data=CreateUserRequest(
                name="topology-patch-user", email="topologypatchuser@user.com"
            ),
        )
        cls.owner = EntityReferenceList(
            root=[
                EntityReference(
                    id=user.id,
                    type="user",
                    fullyQualifiedName=user.fullyQualifiedName.root,
                )
            ]
        )

        override_user: User = cls.metadata.create_or_update(
            data=CreateUserRequest(name="override-user", email="overrideuser@user.com"),
        )
        cls.override_owner = EntityReferenceList(
            root=[
                EntityReference(
                    id=override_user.id,
                    type="user",
                    fullyQualifiedName=override_user.fullyQualifiedName.root,
                )
            ]
        )

        cls.service_entity = cls.metadata.create_or_update(data=cls.service)

        create_db = CreateDatabaseRequest(
            name="test-db-topology-patch",
            service=cls.service_entity.fullyQualifiedName,
        )

        cls.create_db_entity = cls.metadata.create_or_update(data=create_db)

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema-topology-patch",
            database=cls.create_db_entity.fullyQualifiedName,
        )

        cls.create_schema_entity = cls.metadata.create_or_update(data=create_schema)

        columns = [
            Column(
                name="column1",
                dataType=DataType.BIGINT,
                description=Markdown("test column1"),
            ),
            Column(
                name="column2",
                displayName="COLUMN TWO",
                dataType=DataType.BIGINT,
                description=Markdown("test column2"),
            ),
            Column(
                name="column3",
                displayName="COLUMN THREE",
                dataType=DataType.BIGINT,
                description=Markdown("test column3"),
                tags=[PII_TAG_LABEL, TIER_TAG_LABEL],
            ),
            Column(
                name="column4",
                dataType=DataType.BIGINT,
                description=Markdown("test column4"),
            ),
            Column(
                name="column5",
                displayName="COLUMN FIVE",
                dataType=DataType.BIGINT,
                description=Markdown("test column5"),
                tags=[PERSONAL_TAG_LABEL],
            ),
        ]

        create = CreateTableRequest(
            name="test-topology-patch-table-one",
            displayName="TABLE ONE",
            databaseSchema=cls.create_schema_entity.fullyQualifiedName,
            columns=columns,
            owners=cls.owner,
            description=Markdown("TABLE ONE DESCRIPTION"),
            tags=[PERSONAL_TAG_LABEL],
        )
        cls.table_entity_one = cls.metadata.create_or_update(create)

        create = CreateTableRequest(
            name="test-topology-patch-table-two",
            databaseSchema=cls.create_schema_entity.fullyQualifiedName,
            columns=columns,
        )
        cls.table_entity_two = cls.metadata.create_or_update(create)

        create = CreateTableRequest(
            name="test-topology-patch-table-three",
            displayName="TABLE THREE",
            databaseSchema=cls.create_schema_entity.fullyQualifiedName,
            columns=columns,
            owners=cls.owner,
            description=Markdown("TABLE THREE DESCRIPTION"),
            tags=[PERSONAL_TAG_LABEL],
        )
        cls.table_entity_three = cls.metadata.create_or_update(create)

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

    def test_topology_patch_table_columns_with_random_order(self):
        """Check if the table columns are patched"""
        new_columns_list = [
            Column(
                name="column3",
                dataType=DataType.BIGINT,
                description=Markdown("test column3 overriden"),
            ),
            Column(
                name="column4",
                displayName="COLUMN FOUR",
                dataType=DataType.BIGINT,
                tags=[PII_TAG_LABEL],
            ),
            Column(name="column5", dataType=DataType.BIGINT, tags=[PII_TAG_LABEL]),
            Column(
                name="column1",
                dataType=DataType.BIGINT,
                description=Markdown("test column1 overriden"),
            ),
            Column(
                name="column2",
                displayName="COLUMN TWO OVERRIDEN",
                dataType=DataType.BIGINT,
            ),
        ]
        updated_table = self.table_entity_one.model_copy(deep=True)
        updated_table.columns = new_columns_list
        updated_table.owners = self.override_owner
        updated_table.description = Markdown("TABLE ONE DESCRIPTION OVERRIDEN")
        updated_table.displayName = "TABLE ONE OVERRIDEN"
        updated_table.tags = [PII_TAG_LABEL]
        self.metadata.patch(
            entity=type(self.table_entity_one),
            source=self.table_entity_one,
            destination=updated_table,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
        )
        table_entity = self.metadata.get_by_id(
            entity=Table, entity_id=self.table_entity_one.id.root, fields=["*"]
        )
        # table tests
        self.assertEqual(table_entity.owners.root[0].id, self.owner.root[0].id)
        self.assertEqual(table_entity.description.root, "TABLE ONE DESCRIPTION")
        self.assertEqual(table_entity.displayName, "TABLE ONE")
        self.assertEqual(table_entity.tags[0].tagFQN.root, "PersonalData.Personal")

        # column tests
        self.assertEqual(table_entity.columns[0].description.root, "test column1")
        self.assertEqual(table_entity.columns[0].name.root, "column1")
        self.assertIsNone(table_entity.columns[0].displayName)
        self.assertEqual(table_entity.columns[1].description.root, "test column2")
        self.assertEqual(table_entity.columns[1].name.root, "column2")
        self.assertEqual(table_entity.columns[1].displayName, "COLUMN TWO")
        self.assertEqual(table_entity.columns[2].description.root, "test column3")
        self.assertEqual(table_entity.columns[2].name.root, "column3")
        self.assertEqual(table_entity.columns[2].displayName, "COLUMN THREE")
        self.assertEqual(table_entity.columns[2].tags[0].tagFQN.root, "PII.Sensitive")
        self.assertEqual(table_entity.columns[2].tags[1].tagFQN.root, "Tier.Tier2")
        self.assertEqual(table_entity.columns[3].description.root, "test column4")
        self.assertEqual(table_entity.columns[3].name.root, "column4")
        self.assertEqual(table_entity.columns[3].displayName, "COLUMN FOUR")
        self.assertEqual(table_entity.columns[3].tags[0].tagFQN.root, "PII.Sensitive")
        self.assertEqual(table_entity.columns[4].description.root, "test column5")
        self.assertEqual(table_entity.columns[4].name.root, "column5")
        self.assertEqual(table_entity.columns[4].displayName, "COLUMN FIVE")
        self.assertEqual(
            table_entity.columns[4].tags[0].tagFQN.root, "PersonalData.Personal"
        )
        self.assertEqual(len(table_entity.columns[4].tags), 1)

    def test_topology_patch_table_columns_with_add_del(self):
        """Check if the table columns are patched"""
        new_columns_list = [
            Column(
                name="column7",
                dataType=DataType.BIGINT,
                description=Markdown("test column7"),
            ),
            Column(name="column3", dataType=DataType.BIGINT),
            Column(name="column5", dataType=DataType.BIGINT),
            Column(name="column1", dataType=DataType.BIGINT),
            Column(
                name="column6",
                dataType=DataType.BIGINT,
                description=Markdown("test column6"),
            ),
        ]
        updated_table = self.table_entity_two.model_copy(deep=True)
        updated_table.columns = new_columns_list
        self.metadata.patch(
            entity=type(self.table_entity_two),
            source=self.table_entity_two,
            destination=updated_table,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
        )
        table_entity = self.metadata.get_by_id(
            entity=Table, entity_id=self.table_entity_two.id.root
        )
        self.assertEqual(table_entity.columns[0].description.root, "test column1")
        self.assertEqual(table_entity.columns[0].name.root, "column1")
        self.assertEqual(table_entity.columns[1].description.root, "test column3")
        self.assertEqual(table_entity.columns[1].name.root, "column3")
        self.assertEqual(table_entity.columns[2].description.root, "test column5")
        self.assertEqual(table_entity.columns[2].name.root, "column5")
        self.assertEqual(table_entity.columns[3].description.root, "test column7")
        self.assertEqual(table_entity.columns[3].name.root, "column7")
        self.assertEqual(table_entity.columns[4].description.root, "test column6")
        self.assertEqual(table_entity.columns[4].name.root, "column6")

    def test_topology_patch_with_override_enabled(self):
        """Check if the table columns are patched"""
        new_columns_list = [
            Column(
                name="column7",
                dataType=DataType.BIGINT,
                description=Markdown("test column7"),
            ),
            Column(
                name="column3",
                displayName="COLUMN THREE OVERRIDEN",
                dataType=DataType.BIGINT,
            ),
            Column(name="column5", dataType=DataType.BIGINT, tags=[PII_TAG_LABEL]),
            Column(
                name="column1",
                displayName="COLUMN ONE OVERRIDEN",
                dataType=DataType.BIGINT,
                description=Markdown("test column1 overriden"),
            ),
            Column(
                name="column6",
                displayName="COLUMN SIX",
                dataType=DataType.BIGINT,
                description=Markdown("test column6"),
            ),
            Column(
                name="column4",
                dataType=DataType.BIGINT,
                description=Markdown("test column4 overriden"),
            ),
        ]
        updated_table = self.table_entity_three.model_copy(deep=True)
        updated_table.columns = new_columns_list
        updated_table.owners = self.override_owner
        updated_table.description = Markdown("TABLE THREE DESCRIPTION OVERRIDEN")
        updated_table.displayName = "TABLE THREE OVERRIDEN"
        updated_table.tags = [PII_TAG_LABEL]
        self.metadata.patch(
            entity=type(self.table_entity_three),
            source=self.table_entity_three,
            destination=updated_table,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
            override_metadata=True,
        )
        table_entity = self.metadata.get_by_id(
            entity=Table, entity_id=self.table_entity_three.id.root, fields=["*"]
        )
        # table tests
        self.assertEqual(table_entity.owners.root[0].id, self.override_owner.root[0].id)
        self.assertEqual(
            table_entity.description.root, "TABLE THREE DESCRIPTION OVERRIDEN"
        )
        self.assertEqual(table_entity.displayName, "TABLE THREE OVERRIDEN")
        self.assertEqual(table_entity.tags[0].tagFQN.root, "PII.Sensitive")

        self.assertEqual(
            table_entity.columns[0].description.root, "test column1 overriden"
        )
        self.assertEqual(table_entity.columns[0].name.root, "column1")
        self.assertEqual(table_entity.columns[0].displayName, "COLUMN ONE OVERRIDEN")
        self.assertEqual(table_entity.columns[1].description.root, "test column3")
        self.assertEqual(table_entity.columns[1].name.root, "column3")
        self.assertEqual(table_entity.columns[1].displayName, "COLUMN THREE OVERRIDEN")
        self.assertEqual(table_entity.columns[1].tags[0].tagFQN.root, "PII.Sensitive")
        self.assertEqual(table_entity.columns[1].tags[1].tagFQN.root, "Tier.Tier2")
        self.assertEqual(
            table_entity.columns[2].description.root, "test column4 overriden"
        )
        self.assertEqual(table_entity.columns[2].name.root, "column4")
        self.assertIsNone(table_entity.columns[2].displayName)
        self.assertEqual(table_entity.columns[3].description.root, "test column5")
        self.assertEqual(table_entity.columns[3].name.root, "column5")
        self.assertEqual(table_entity.columns[3].displayName, "COLUMN FIVE")
        self.assertEqual(table_entity.columns[3].tags[0].tagFQN.root, "PII.Sensitive")
        self.assertEqual(table_entity.columns[4].description.root, "test column7")
        self.assertEqual(table_entity.columns[4].name.root, "column7")
        self.assertIsNone(table_entity.columns[4].displayName)
        self.assertEqual(table_entity.columns[5].description.root, "test column6")
        self.assertEqual(table_entity.columns[5].name.root, "column6")
        self.assertEqual(table_entity.columns[5].displayName, "COLUMN SIX")
