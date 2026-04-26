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

import pytest

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.teams.user import User
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

from ..integration_base import generate_name
from .conftest import _safe_create_or_update

# Module-level tag label constants
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


@pytest.fixture(scope="module")
def topology_users(metadata):
    """Create users for topology patch tests."""
    user = _safe_create_or_update(
        metadata,
        CreateUserRequest(name="topology-patch-user", email="topologypatchuser@user.com"),
    )
    override_user = _safe_create_or_update(
        metadata,
        CreateUserRequest(name="override-user", email="overrideuser@user.com"),
    )

    owner = EntityReferenceList(
        root=[
            EntityReference(
                id=user.id,
                type="user",
                fullyQualifiedName=user.fullyQualifiedName.root,
            )
        ]
    )
    override_owner = EntityReferenceList(
        root=[
            EntityReference(
                id=override_user.id,
                type="user",
                fullyQualifiedName=override_user.fullyQualifiedName.root,
            )
        ]
    )

    yield {"owner": owner, "override_owner": override_owner}

    # Cleanup
    metadata.delete(entity=User, entity_id=user.id, hard_delete=True)
    metadata.delete(entity=User, entity_id=override_user.id, hard_delete=True)


@pytest.fixture(scope="module")
def topology_database(metadata, database_service):
    """Module-scoped database for topology patch tests."""
    database_name = generate_name()
    database_request = CreateDatabaseRequest(
        name=database_name,
        service=database_service.fullyQualifiedName,
    )
    database = _safe_create_or_update(metadata, database_request)

    yield database

    metadata.delete(entity=Database, entity_id=database.id, hard_delete=True)


@pytest.fixture(scope="module")
def topology_schema(metadata, topology_database):
    """Module-scoped database schema for topology patch tests."""
    schema_name = generate_name()
    schema_request = CreateDatabaseSchemaRequest(
        name=schema_name,
        database=topology_database.fullyQualifiedName,
    )
    schema = _safe_create_or_update(metadata, schema_request)

    yield schema

    metadata.delete(entity=DatabaseSchema, entity_id=schema.id, recursive=True, hard_delete=True)


@pytest.fixture(scope="module")
def topology_columns():
    """Create standard column set for topology tests."""
    return [
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


@pytest.fixture(scope="module")
def table_entity_one(metadata, topology_schema, topology_columns, topology_users):
    """First table for random order patch testing."""
    table_name = generate_name()
    create = CreateTableRequest(
        name=table_name,
        displayName="TABLE ONE",
        databaseSchema=topology_schema.fullyQualifiedName,
        columns=topology_columns,
        owners=topology_users["owner"],
        description=Markdown("TABLE ONE DESCRIPTION"),
        tags=[PERSONAL_TAG_LABEL],
    )
    table = _safe_create_or_update(metadata, create)

    yield table

    metadata.delete(entity=Table, entity_id=table.id, hard_delete=True)


@pytest.fixture(scope="module")
def table_entity_two(metadata, topology_schema, topology_columns):
    """Second table for add/delete column testing."""
    table_name = generate_name()
    create = CreateTableRequest(
        name=table_name,
        databaseSchema=topology_schema.fullyQualifiedName,
        columns=topology_columns,
    )
    table = _safe_create_or_update(metadata, create)

    yield table

    metadata.delete(entity=Table, entity_id=table.id, hard_delete=True)


@pytest.fixture(scope="module")
def table_entity_three(metadata, topology_schema, topology_columns, topology_users):
    """Third table for override metadata testing."""
    table_name = generate_name()
    create = CreateTableRequest(
        name=table_name,
        displayName="TABLE THREE",
        databaseSchema=topology_schema.fullyQualifiedName,
        columns=topology_columns,
        owners=topology_users["owner"],
        description=Markdown("TABLE THREE DESCRIPTION"),
        tags=[PERSONAL_TAG_LABEL],
    )
    table = _safe_create_or_update(metadata, create)

    yield table

    metadata.delete(entity=Table, entity_id=table.id, hard_delete=True)


@pytest.fixture(scope="module")
def table_entity_column_order(metadata, topology_schema):
    """Table for testing column order after table recreation (issue #18246)."""
    table_name = generate_name()
    create = CreateTableRequest(
        name=table_name,
        databaseSchema=topology_schema.fullyQualifiedName,
        columns=[
            Column(
                name="id",
                dataType=DataType.INT,
                description=Markdown("primary key"),
            ),
            Column(
                name="name",
                dataType=DataType.VARCHAR,
                dataLength=100,
                description=Markdown("user name"),
            ),
            Column(
                name="created_at",
                dataType=DataType.TIMESTAMP,
                description=Markdown("creation timestamp"),
            ),
        ],
    )
    table = _safe_create_or_update(metadata, create)

    yield table

    metadata.delete(entity=Table, entity_id=table.id, hard_delete=True)


class TestOMetaTopologyPatchAPI:
    """
    Topology Patch API integration tests.
    Tests column patching with various scenarios: random order, add/delete, override.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    - database_service: DatabaseService (module scope)
    """

    def test_topology_patch_table_columns_with_random_order(self, metadata, table_entity_one, topology_users):
        """Check if the table columns are patched with random order."""
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
        updated_table = table_entity_one.model_copy(deep=True)
        updated_table.columns = new_columns_list
        updated_table.owners = topology_users["override_owner"]
        updated_table.description = Markdown("TABLE ONE DESCRIPTION OVERRIDEN")
        updated_table.displayName = "TABLE ONE OVERRIDEN"
        updated_table.tags = [PII_TAG_LABEL]
        metadata.patch(
            entity=type(table_entity_one),
            source=table_entity_one,
            destination=updated_table,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
        )
        table_entity = metadata.get_by_id(entity=Table, entity_id=table_entity_one.id.root, fields=["*"])
        # Table tests - should NOT override (default behavior)
        assert table_entity.owners.root[0].id == topology_users["owner"].root[0].id
        assert table_entity.description.root == "TABLE ONE DESCRIPTION"
        assert table_entity.displayName == "TABLE ONE"
        assert table_entity.tags[0].tagFQN.root == "PersonalData.Personal"

        # Column tests - order follows destination [col3, col4, col5, col1, col2]
        # Restricted fields (description, displayName, tags) preserved from source
        assert table_entity.columns[0].name.root == "column3"
        assert table_entity.columns[0].description.root == "test column3"
        assert table_entity.columns[0].displayName == "COLUMN THREE"
        assert table_entity.columns[0].tags[0].tagFQN.root == "PII.Sensitive"
        assert table_entity.columns[0].tags[1].tagFQN.root == "Tier.Tier2"
        assert table_entity.columns[1].name.root == "column4"
        assert table_entity.columns[1].description.root == "test column4"
        assert table_entity.columns[1].displayName == "COLUMN FOUR"
        assert table_entity.columns[1].tags[0].tagFQN.root == "PII.Sensitive"
        assert table_entity.columns[2].name.root == "column5"
        assert table_entity.columns[2].description.root == "test column5"
        assert table_entity.columns[2].displayName == "COLUMN FIVE"
        assert table_entity.columns[2].tags[0].tagFQN.root == "PersonalData.Personal"
        assert len(table_entity.columns[2].tags) == 1
        assert table_entity.columns[3].name.root == "column1"
        assert table_entity.columns[3].description.root == "test column1"
        assert table_entity.columns[3].displayName is None
        assert table_entity.columns[4].name.root == "column2"
        assert table_entity.columns[4].description.root == "test column2"
        assert table_entity.columns[4].displayName == "COLUMN TWO"

    def test_topology_patch_table_columns_with_add_del(self, metadata, table_entity_two):
        """Check if the table columns are patched with add/delete."""
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
        updated_table = table_entity_two.model_copy(deep=True)
        updated_table.columns = new_columns_list
        metadata.patch(
            entity=type(table_entity_two),
            source=table_entity_two,
            destination=updated_table,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
        )
        table_entity = metadata.get_by_id(entity=Table, entity_id=table_entity_two.id.root)
        # Order follows destination: [col7, col3, col5, col1, col6]
        assert table_entity.columns[0].name.root == "column7"
        assert table_entity.columns[0].description.root == "test column7"
        assert table_entity.columns[1].name.root == "column3"
        assert table_entity.columns[1].description.root == "test column3"
        assert table_entity.columns[2].name.root == "column5"
        assert table_entity.columns[2].description.root == "test column5"
        assert table_entity.columns[3].name.root == "column1"
        assert table_entity.columns[3].description.root == "test column1"
        assert table_entity.columns[4].name.root == "column6"
        assert table_entity.columns[4].description.root == "test column6"

    def test_topology_patch_with_override_enabled(self, metadata, table_entity_three, topology_users):
        """Check if the table columns are patched with override enabled."""
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
        updated_table = table_entity_three.model_copy(deep=True)
        updated_table.columns = new_columns_list
        updated_table.owners = topology_users["override_owner"]
        updated_table.description = Markdown("TABLE THREE DESCRIPTION OVERRIDEN")
        updated_table.displayName = "TABLE THREE OVERRIDEN"
        updated_table.tags = [PII_TAG_LABEL]
        metadata.patch(
            entity=type(table_entity_three),
            source=table_entity_three,
            destination=updated_table,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
            override_metadata=True,
        )
        table_entity = metadata.get_by_id(entity=Table, entity_id=table_entity_three.id.root, fields=["*"])
        # Table tests - SHOULD override (override_metadata=True)
        assert table_entity.owners.root[0].id == topology_users["override_owner"].root[0].id
        assert table_entity.description.root == "TABLE THREE DESCRIPTION OVERRIDEN"
        assert table_entity.displayName == "TABLE THREE OVERRIDEN"
        assert table_entity.tags[0].tagFQN.root == "PII.Sensitive"

        # With override + destination order, columns follow the destination order
        assert table_entity.columns[0].name.root == "column7"
        assert table_entity.columns[0].description.root == "test column7"

        assert table_entity.columns[1].name.root == "column3"
        assert table_entity.columns[1].description.root == "test column3"
        assert table_entity.columns[1].displayName == "COLUMN THREE OVERRIDEN"
        assert table_entity.columns[1].tags[0].tagFQN.root == "PII.Sensitive"
        assert table_entity.columns[1].tags[1].tagFQN.root == "Tier.Tier2"

        assert table_entity.columns[2].name.root == "column5"
        assert table_entity.columns[2].description.root == "test column5"
        assert table_entity.columns[2].displayName == "COLUMN FIVE"
        assert table_entity.columns[2].tags[0].tagFQN.root == "PII.Sensitive"

        assert table_entity.columns[3].name.root == "column1"
        assert table_entity.columns[3].description.root == "test column1 overriden"
        assert table_entity.columns[3].displayName == "COLUMN ONE OVERRIDEN"

        assert table_entity.columns[4].name.root == "column6"
        assert table_entity.columns[4].description.root == "test column6"
        assert table_entity.columns[4].displayName == "COLUMN SIX"

        assert table_entity.columns[5].name.root == "column4"
        assert table_entity.columns[5].description.root == "test column4 overriden"

    def test_topology_patch_column_order_with_new_column_in_middle(self, metadata, table_entity_column_order):
        """
        Reproduce issue #18246: a new column added in the middle should appear
        at its correct position, not appended at the end.

        Simulates: table dropped and recreated with a new column inserted
        between existing columns.
        Original:  [id, name, created_at]
        Recreated: [id, name, name_2, created_at]
        Expected:  [id, name, name_2, created_at] (not [id, name, created_at, name_2])
        """
        new_columns_list = [
            Column(
                name="id",
                dataType=DataType.INT,
            ),
            Column(
                name="name",
                dataType=DataType.VARCHAR,
                dataLength=100,
            ),
            Column(
                name="name_2",
                dataType=DataType.VARCHAR,
                dataLength=100,
                description=Markdown("secondary name"),
            ),
            Column(
                name="created_at",
                dataType=DataType.TIMESTAMP,
            ),
        ]
        updated_table = table_entity_column_order.model_copy(deep=True)
        updated_table.columns = new_columns_list
        metadata.patch(
            entity=type(table_entity_column_order),
            source=table_entity_column_order,
            destination=updated_table,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
        )
        table_entity = metadata.get_by_id(entity=Table, entity_id=table_entity_column_order.id.root)
        assert len(table_entity.columns) == 4
        assert table_entity.columns[0].name.root == "id"
        assert table_entity.columns[1].name.root == "name"
        assert table_entity.columns[2].name.root == "name_2"
        assert table_entity.columns[3].name.root == "created_at"
        # Existing columns preserve their descriptions
        assert table_entity.columns[0].description.root == "primary key"
        assert table_entity.columns[1].description.root == "user name"
        assert table_entity.columns[3].description.root == "creation timestamp"
        # New column has its own description
        assert table_entity.columns[2].description.root == "secondary name"
