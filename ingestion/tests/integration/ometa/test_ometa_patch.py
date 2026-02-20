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
import logging
import time
from datetime import datetime
from unittest import mock

import pytest

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    Table,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.tests.testCase import TestCase as TestCaseEntity
from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestCaseParameterDefinition,
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
    RESTRICT_UPDATE_LIST,
)
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.utils.helpers import find_column_in_table

from ..integration_base import (
    generate_name,
    get_create_entity,
    get_create_service,
    get_create_team_entity,
    get_create_test_case,
    get_create_test_definition,
    get_create_test_suite,
    get_create_user_entity,
)
from .conftest import _safe_delete


def patch_with_retry(metadata, retries=3, delay=1, **kwargs):
    """Retry metadata.patch to handle transient MySQL deadlocks.

    The patch mixin catches server errors and returns None. We retry
    on None for calls expected to succeed.
    """
    for attempt in range(retries):
        res = metadata.patch(**kwargs)
        if res is not None:
            return res
        if attempt < retries - 1:
            time.sleep(delay)
    return res


def patch_owner_with_retry(metadata, retries=3, delay=1, **kwargs):
    """Retry patch_owner to handle transient MySQL deadlocks.

    Under parallel execution (--dist loadfile), concurrent writes to the
    tag_usage table from other test files can cause deadlocks during
    the server-side PATCH handler. patch_owner returns None on server
    errors, so we retry on None for calls expected to succeed.
    """
    for attempt in range(retries):
        res = metadata.patch_owner(**kwargs)
        if res is not None:
            return res
        if attempt < retries - 1:
            time.sleep(delay)
    return res


PII_TAG_LABEL = TagLabel(
    tagFQN=TagFQN("PII.Sensitive"),
    labelType=LabelType.Automated,
    state=State.Suggested.value,
    source=TagSource.Classification,
)

TIER_TAG_LABEL = TagLabel(
    tagFQN=TagFQN("Tier.Tier2"),
    labelType=LabelType.Automated,
    state=State.Suggested.value,
    source=TagSource.Classification,
)


@pytest.fixture(scope="module")
def patch_service(metadata):
    """Module-scoped database service for patch tests."""
    service_name = generate_name()
    create_service = get_create_service(entity=DatabaseService, name=service_name)
    service_entity = metadata.create_or_update(data=create_service)

    yield service_entity

    _safe_delete(
        metadata,
        entity=DatabaseService,
        entity_id=service_entity.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def patch_database(metadata, patch_service):
    """Module-scoped database for patch tests."""
    create_db = get_create_entity(
        entity=Database, reference=patch_service.fullyQualifiedName
    )
    return metadata.create_or_update(data=create_db)


@pytest.fixture(scope="module")
def patch_schema(metadata, patch_database):
    """Module-scoped database schema for patch tests."""
    create_schema = get_create_entity(
        entity=DatabaseSchema, reference=patch_database.fullyQualifiedName
    )
    return metadata.create_or_update(data=create_schema)


@pytest.fixture(scope="module")
def patch_table(metadata, patch_schema):
    """Module-scoped table for patch tests."""
    create = get_create_entity(entity=Table, reference=patch_schema.fullyQualifiedName)
    return metadata.create_or_update(data=create)


@pytest.fixture(scope="module")
def patch_test_table(metadata, patch_schema):
    """Module-scoped second table for patch-specific tests."""
    create = get_create_entity(entity=Table, reference=patch_schema.fullyQualifiedName)
    return metadata.create_or_update(data=create)


@pytest.fixture(scope="module")
def patch_test_case(metadata, patch_table):
    """Module-scoped test case for patch tests."""
    test_definition = metadata.create_or_update(
        get_create_test_definition(
            parameter_definition=[TestCaseParameterDefinition(name="foo")],
            entity_type=EntityType.TABLE,
        )
    )

    metadata.create_or_update_executable_test_suite(
        get_create_test_suite(
            executable_entity_reference=patch_table.fullyQualifiedName.root
        )
    )

    return metadata.create_or_update(
        get_create_test_case(
            entity_link=f"<#E::table::{patch_table.fullyQualifiedName.root}>",
            test_definition=test_definition.fullyQualifiedName,
            parameter_values=[TestCaseParameterValue(name="foo", value="10")],
        )
    )


@pytest.fixture(scope="module")
def patch_user_1(metadata):
    """Module-scoped first user for patch owner tests."""
    user = metadata.create_or_update(data=get_create_user_entity())
    yield user
    _safe_delete(metadata, entity=User, entity_id=user.id, hard_delete=True)


@pytest.fixture(scope="module")
def patch_user_2(metadata):
    """Module-scoped second user for patch owner tests."""
    user = metadata.create_or_update(data=get_create_user_entity())
    yield user
    _safe_delete(metadata, entity=User, entity_id=user.id, hard_delete=True)


@pytest.fixture(scope="module")
def patch_team_1(metadata, patch_user_1, patch_user_2):
    """Module-scoped first team for patch owner tests."""
    team = metadata.create_or_update(
        data=get_create_team_entity(users=[patch_user_1.id, patch_user_2.id])
    )
    yield team
    _safe_delete(metadata, entity=Team, entity_id=team.id, hard_delete=True)


@pytest.fixture(scope="module")
def patch_team_2(metadata, patch_user_2):
    """Module-scoped second team for patch owner tests."""
    team = metadata.create_or_update(
        data=get_create_team_entity(users=[patch_user_2.id])
    )
    yield team
    _safe_delete(metadata, entity=Team, entity_id=team.id, hard_delete=True)


@pytest.fixture(scope="module")
def owner_user_1(patch_user_1):
    return EntityReferenceList(root=[EntityReference(id=patch_user_1.id, type="user")])


@pytest.fixture(scope="module")
def owner_user_2(patch_user_2):
    return EntityReferenceList(root=[EntityReference(id=patch_user_2.id, type="user")])


@pytest.fixture(scope="module")
def owner_team_1(patch_team_1):
    return EntityReferenceList(root=[EntityReference(id=patch_team_1.id, type="team")])


@pytest.fixture(scope="module")
def owner_team_2(patch_team_2):
    return EntityReferenceList(root=[EntityReference(id=patch_team_2.id, type="team")])


@pytest.fixture(scope="module")
def wait_for_patch_es_index(metadata, patch_user_1):
    """Wait for ES index to be updated with test user."""
    logging.info("Checking ES index status...")
    tries = 0
    res = None
    while not res and tries <= 5:
        res = metadata.es_search_from_fqn(
            entity_type=User,
            fqn_search_string=patch_user_1.name.root,
        )
        if not res:
            tries += 1
            time.sleep(1)
    return True


class TestOMetaPatch:
    """
    Patch API integration tests.
    Tests patch operations on tables, descriptions, tags, owners, and test cases.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    def test_patch_table(
        self,
        metadata,
        patch_test_table,
        owner_user_1,
        owner_user_2,
        wait_for_patch_es_index,
    ):
        new_patched_table = patch_test_table.model_copy(deep=True)

        new_patched_table.columns.append(
            Column(name=ColumnName("new_column"), dataType=DataType.BIGINT),
        )
        new_patched_table.description = Markdown("This should get patched")
        new_patched_table.columns[0].description = Markdown(
            root="This column description should get patched"
        )

        new_patched_table.tags = [PII_TAG_LABEL]
        new_patched_table.columns[0].tags = [PII_TAG_LABEL]

        new_patched_table.owners = owner_user_1

        patched_table = patch_with_retry(
            metadata,
            entity=type(patch_test_table),
            source=patch_test_table,
            destination=new_patched_table,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
        )

        assert patched_table.description.root == "This should get patched"
        assert (
            patched_table.columns[0].description.root
            == "This column description should get patched"
        )
        assert patched_table.tags[0].tagFQN == PII_TAG_LABEL.tagFQN
        assert patched_table.columns[0].tags[0].tagFQN == PII_TAG_LABEL.tagFQN
        assert patched_table.owners.root[0].id == owner_user_1.root[0].id

        new_patched_table = patched_table.model_copy(deep=True)

        new_patched_table.description = Markdown("This should NOT get patched")
        new_patched_table.columns[0].description = Markdown(
            root="This column description should NOT get patched"
        )

        new_patched_table.tags = [PII_TAG_LABEL, TIER_TAG_LABEL]
        new_patched_table.columns[0].tags = None

        new_patched_table.owners = owner_user_2

        patched_table = patch_with_retry(
            metadata,
            entity=type(patched_table),
            source=patched_table,
            destination=new_patched_table,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
        )

        assert patched_table.description.root != "This should NOT get patched"
        assert (
            patched_table.columns[0].description.root
            != "This column description should NOT get patched"
        )
        assert patched_table.tags[0].tagFQN == PII_TAG_LABEL.tagFQN
        assert patched_table.tags[1].tagFQN == TIER_TAG_LABEL.tagFQN
        assert patched_table.columns[0].tags[0].tagFQN == PII_TAG_LABEL.tagFQN
        assert patched_table.owners.root[0].id == owner_user_1.root[0].id

    def test_patch_description(self, metadata, patch_table):
        """Update description and force"""
        updated: Table = metadata.patch_description(
            entity=Table, source=patch_table, description="New description"
        )

        assert updated.description.root == "New description"

        not_updated = metadata.patch_description(
            entity=Table, source=patch_table, description="Not passing force"
        )

        assert not not_updated

        force_updated: Table = metadata.patch_description(
            entity=Table,
            source=patch_table,
            description="Forced new",
            force=True,
        )

        assert force_updated.description.root == "Forced new"

    def test_patch_description_TestCase(self, metadata, patch_test_case):
        """Update description and force"""
        new_description = "Description " + str(datetime.now())
        updated: TestCaseEntity = metadata.patch_description(
            entity=TestCaseEntity,
            source=patch_test_case,
            description=new_description,
            force=True,
        )

        assert updated.description.root == new_description

        not_updated = metadata.patch_description(
            entity=TestCaseEntity,
            source=patch_test_case,
            description="Not passing force",
        )

        assert not not_updated

        force_updated: TestCaseEntity = metadata.patch_description(
            entity=TestCaseEntity,
            source=patch_test_case,
            description="Forced new",
            force=True,
        )

        assert force_updated.description.root == "Forced new"

    def test_patch_column_description(self, metadata, patch_table):
        """Update column description and force"""
        updated: Table = metadata.patch_column_description(
            table=patch_table,
            description="New column description",
            column_fqn=patch_table.fullyQualifiedName.root + ".another",
        )

        updated_col = find_column_in_table(column_name="another", table=updated)
        assert updated_col.description.root == "New column description"

        not_updated = metadata.patch_column_description(
            table=patch_table,
            description="Not passing force",
            column_fqn=patch_table.fullyQualifiedName.root + ".another",
        )

        assert not not_updated

        force_updated: Table = metadata.patch_column_description(
            table=patch_table,
            description="Forced new",
            column_fqn=patch_table.fullyQualifiedName.root + ".another",
            force=True,
        )

        updated_col = find_column_in_table(column_name="another", table=force_updated)
        assert updated_col.description.root == "Forced new"

    def test_patch_tags(self, metadata, patch_table):
        """Update table tags"""
        updated: Table = metadata.patch_tags(
            entity=Table,
            source=patch_table,
            tag_labels=[PII_TAG_LABEL, TIER_TAG_LABEL],
        )
        assert updated.tags[0].tagFQN.root == "PII.Sensitive"
        assert updated.tags[1].tagFQN.root == "Tier.Tier2"

    def test_patch_column_tags(self, metadata, patch_table):
        """Update column tags"""
        updated: Table = metadata.patch_column_tags(
            table=patch_table,
            column_tags=[
                ColumnTag(
                    column_fqn=patch_table.fullyQualifiedName.root + ".id",
                    tag_label=PII_TAG_LABEL,
                )
            ],
        )
        updated_col = find_column_in_table(column_name="id", table=updated)

        assert updated_col.tags[0].tagFQN.root == "PII.Sensitive"

        updated_again: Table = metadata.patch_column_tags(
            table=patch_table,
            column_tags=[
                ColumnTag(
                    column_fqn=patch_table.fullyQualifiedName.root + ".id",
                    tag_label=TIER_TAG_LABEL,
                )
            ],
        )
        updated_again_col = find_column_in_table(column_name="id", table=updated_again)

        assert updated_again_col.tags[0].tagFQN.root == "PII.Sensitive"
        assert updated_again_col.tags[1].tagFQN.root == "Tier.Tier2"

    def test_patch_owner(
        self,
        metadata,
        patch_table,
        patch_database,
        patch_schema,
        owner_user_1,
        owner_user_2,
        owner_team_1,
        owner_team_2,
    ):
        """Update owner"""
        # Database, no existing owner, owner is a User -> Modified
        updated: Database = patch_owner_with_retry(
            metadata,
            entity=Database,
            source=patch_database,
            owners=owner_user_1,
        )
        assert updated is not None
        assert updated.owners.root[0].id == owner_user_1.root[0].id

        # Database, existing owner, owner is a User, no force -> Unmodified
        updated: Database = metadata.patch_owner(
            entity=Database,
            source=patch_database,
            owners=owner_user_2,
        )
        assert updated is None

        # Database, existing owner, owner is a User, force -> Modified
        updated: Database = patch_owner_with_retry(
            metadata,
            entity=Database,
            source=patch_database,
            owners=owner_user_2,
            force=True,
        )
        assert updated is not None
        assert updated.owners.root[0].id == owner_user_2.root[0].id

        # Database, existing owner, no owner, no force -> Unmodified
        updated: Database = metadata.patch_owner(
            entity=Database,
            source=patch_database,
        )
        assert updated is None

        # Database, existing owner, no owner, force -> Modified
        updated: Database = patch_owner_with_retry(
            metadata,
            entity=Database,
            source=patch_database,
            force=True,
        )
        assert updated is not None
        assert updated.owners == EntityReferenceList(root=[])

        # DatabaseSchema, no existing owner, owner is Team -> Modified
        updated: DatabaseSchema = patch_owner_with_retry(
            metadata,
            entity=DatabaseSchema,
            source=patch_schema,
            owners=owner_team_1,
        )
        assert updated is not None
        assert updated.owners.root[0].id == owner_team_1.root[0].id

        # DatabaseSchema, existing owner, owner is Team, no force -> Unmodified
        updated: DatabaseSchema = metadata.patch_owner(
            entity=DatabaseSchema,
            source=patch_schema,
            owners=owner_team_2,
        )
        assert updated is None

        # DatabaseSchema, existing owner, owner is Team, force -> Modified
        updated: DatabaseSchema = patch_owner_with_retry(
            metadata,
            entity=DatabaseSchema,
            source=patch_schema,
            owners=owner_team_2,
            force=True,
        )
        assert updated is not None
        assert updated.owners.root[0].id == owner_team_2.root[0].id

        # DatabaseSchema, existing owner, no owner, no force -> Unmodified
        updated: DatabaseSchema = metadata.patch_owner(
            entity=DatabaseSchema,
            source=patch_schema,
        )
        assert updated is None

        # DatabaseSchema, existing owner, no owner, force -> Modified
        updated: DatabaseSchema = patch_owner_with_retry(
            metadata,
            entity=DatabaseSchema,
            source=patch_schema,
            force=True,
        )
        assert updated is not None
        assert updated.owners == EntityReferenceList(root=[])

        # Table, no existing owner, owner is a Team -> Modified
        updated: Table = patch_owner_with_retry(
            metadata,
            entity=Table,
            source=patch_table,
            owners=owner_team_1,
        )
        assert updated is not None
        assert updated.owners.root[0].id == owner_team_1.root[0].id

        # Table, existing owner, owner is a Team, no force -> Unmodified
        updated: Table = metadata.patch_owner(
            entity=Table,
            source=patch_table,
            owners=owner_team_2,
        )
        assert updated is None

        # Table, existing owner, owner is a Team, force -> Modified
        updated: Table = patch_owner_with_retry(
            metadata,
            entity=Table,
            source=patch_table,
            owners=owner_team_2,
            force=True,
        )
        assert updated is not None
        assert updated.owners.root[0].id == owner_team_2.root[0].id

        # Table, existing owner, no owner, no force -> Unmodified
        updated: Table = metadata.patch_owner(
            entity=Table,
            source=patch_table,
        )
        assert updated is None

        # Table, existing owner, no owner, no force -> Modified
        updated: Table = patch_owner_with_retry(
            metadata,
            entity=Table,
            source=patch_table,
            force=True,
        )
        assert updated is not None
        assert updated.owners == EntityReferenceList(root=[])

        # Table with non-existent id, force -> Unmodified
        non_existent_table = patch_table.model_copy(deep=True)
        non_existent_table.id = "9facb7b3-1dee-4017-8fca-1254b700afef"
        updated: Table = metadata.patch_owner(
            entity=Table,
            source=non_existent_table,
            force=True,
        )
        assert updated is None

    def test_patch_nested_col(self, metadata, patch_schema):
        """Create a table with nested cols and run patch on it"""
        create = get_create_entity(
            entity=Table, reference=patch_schema.fullyQualifiedName
        )
        created: Table = metadata.create_or_update(create)

        with_tags: Table = metadata.patch_column_tags(
            table=created,
            column_tags=[
                ColumnTag(
                    column_fqn=created.fullyQualifiedName.root + ".struct.id",
                    tag_label=TIER_TAG_LABEL,
                )
            ],
        )

        assert (
            with_tags.columns[2].children[0].tags[0].tagFQN.root
            == TIER_TAG_LABEL.tagFQN.root
        )

        with_description: Table = metadata.patch_column_description(
            table=created,
            column_fqn=created.fullyQualifiedName.root + ".struct.name",
            description="I am so nested",
        )

        assert (
            with_description.columns[2].children[1].description.root == "I am so nested"
        )

    def test_patch_when_inherited_owner(self, metadata, patch_database, owner_team_1):
        """PATCHing anything when owner is inherited, does not add the owner to the entity"""
        create_schema = get_create_entity(
            entity=DatabaseSchema, reference=patch_database.fullyQualifiedName
        )
        create_schema.owners = owner_team_1
        db_schema_entity = metadata.create_or_update(data=create_schema)

        create_table = get_create_entity(
            entity=Table, reference=db_schema_entity.fullyQualifiedName
        )
        _table = metadata.create_or_update(data=create_table)

        table: Table = metadata.get_by_name(
            entity=Table, fqn=_table.fullyQualifiedName, fields=["owners"]
        )
        assert table.owners.root
        assert table.owners.root[0].inherited

        dest = table.model_copy(deep=True)
        dest.description = Markdown(root="potato")

        metadata.patch(
            entity=Table,
            source=table,
            destination=dest,
        )

        patched_table = metadata.get_by_name(
            entity=Table, fqn=table.fullyQualifiedName, fields=["owners"]
        )

        assert patched_table.description.root == "potato"
        assert patched_table.owners.root
        assert patched_table.owners.root[0].inherited

    def test_patch_skip_on_failure_true(self, metadata, patch_table):
        """Test that patch operation skips failures when skip_on_failure=True."""
        corrupted_destination = patch_table.model_copy(deep=True)
        corrupted_destination.description = Markdown("Modified description")

        with mock.patch.object(metadata.client, "patch") as mock_patch_client:
            mock_patch_client.side_effect = Exception("API error")

            result = metadata.patch(
                entity=Table,
                source=patch_table,
                destination=corrupted_destination,
                skip_on_failure=True,
            )

            assert result is None
            mock_patch_client.assert_called_once()

    def test_patch_skip_on_failure_false(self, metadata, patch_table):
        """Test that patch operation raises exception when skip_on_failure=False."""
        corrupted_destination = patch_table.model_copy(deep=True)
        corrupted_destination.description = Markdown("Modified description")

        with mock.patch.object(metadata.client, "patch") as mock_patch_client:
            mock_patch_client.side_effect = Exception("API error")

            with pytest.raises(RuntimeError) as context:
                metadata.patch(
                    entity=Table,
                    source=patch_table,
                    destination=corrupted_destination,
                    skip_on_failure=False,
                )

            assert "API error" in str(context.value)
            assert "Failed to update" in str(context.value)
            mock_patch_client.assert_called_once()

    def test_patch_skip_on_failure_default_behavior(self, metadata, patch_table):
        """Test that patch operation defaults to skip_on_failure=True."""
        corrupted_destination = patch_table.model_copy(deep=True)
        corrupted_destination.description = Markdown("Modified description")

        with mock.patch.object(metadata.client, "patch") as mock_patch_client:
            mock_patch_client.side_effect = Exception("API error")

            result = metadata.patch(
                entity=Table, source=patch_table, destination=corrupted_destination
            )

            assert result is None
            mock_patch_client.assert_called_once()

    def test_patch_description_skip_on_failure_true(self, metadata, patch_table):
        """Test that patch_description skips failures when skip_on_failure=True."""
        with mock.patch.object(metadata, "_fetch_entity_if_exists") as mock_fetch:
            mock_fetch.side_effect = Exception("Database error")

            result = metadata.patch_description(
                entity=Table,
                source=patch_table,
                description="New description",
                skip_on_failure=True,
            )

            assert result is None
            mock_fetch.assert_called_once()

    def test_patch_description_skip_on_failure_false(self, metadata, patch_table):
        """Test that patch_description raises exception when skip_on_failure=False."""
        with mock.patch.object(metadata, "_fetch_entity_if_exists") as mock_fetch:
            mock_fetch.side_effect = Exception("Database error")

            with pytest.raises(Exception) as context:
                metadata.patch_description(
                    entity=Table,
                    source=patch_table,
                    description="New description",
                    skip_on_failure=False,
                )

            assert str(context.value) == "Database error"
            mock_fetch.assert_called_once()

    def test_patch_tags_skip_on_failure_true(self, metadata, patch_table):
        """Test that patch_tags skips failures when skip_on_failure=True."""
        with mock.patch.object(metadata, "_fetch_entity_if_exists") as mock_fetch:
            mock_fetch.side_effect = Exception("Database error")

            result = metadata.patch_tags(
                entity=Table,
                source=patch_table,
                tag_labels=[PII_TAG_LABEL],
                skip_on_failure=True,
            )

            assert result is None
            mock_fetch.assert_called_once()

    def test_patch_tags_skip_on_failure_false(self, metadata, patch_table):
        """Test that patch_tags raises exception when skip_on_failure=False."""
        with mock.patch.object(metadata, "_fetch_entity_if_exists") as mock_fetch:
            mock_fetch.side_effect = Exception("Database error")

            with pytest.raises(Exception) as context:
                metadata.patch_tags(
                    entity=Table,
                    source=patch_table,
                    tag_labels=[PII_TAG_LABEL],
                    skip_on_failure=False,
                )

            assert str(context.value) == "Database error"
            mock_fetch.assert_called_once()
