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
from unittest import TestCase, mock

from _openmetadata_testutils.ometa import int_admin_ometa
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


class OMetaTableTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None
    table: Table = None
    patch_test_table: Table = None
    test_case: TestCaseEntity = None
    db_entity: Database = None
    db_schema_entity: DatabaseSchema = None
    user_1: User = None
    user_2: User = None
    team_1: Team = None
    team_2: Team = None
    owner_user_1: EntityReferenceList = None
    owner_user_2: EntityReferenceList = None
    owner_team_1: EntityReferenceList = None
    owner_team_2: EntityReferenceList = None

    metadata = int_admin_ometa()
    service_name = generate_name()
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
        # Create the service entity
        create_service = get_create_service(
            entity=DatabaseService, name=cls.service_name
        )
        cls.service_entity = cls.metadata.create_or_update(data=create_service)

        # Create the database entity
        create_db = get_create_entity(
            entity=Database, reference=cls.service_entity.fullyQualifiedName
        )
        cls.db_entity = cls.metadata.create_or_update(data=create_db)

        # Create the schema entity
        create_schema = get_create_entity(
            entity=DatabaseSchema, reference=cls.db_entity.fullyQualifiedName
        )
        cls.db_schema_entity = cls.metadata.create_or_update(data=create_schema)

        # Create the table entity
        cls.create = get_create_entity(
            entity=Table, reference=cls.db_schema_entity.fullyQualifiedName
        )
        cls.table = cls.metadata.create_or_update(data=cls.create)
        cls.patch_test_table = cls.metadata.create_or_update(data=cls.create)

        # Create test case
        cls.test_definition = cls.metadata.create_or_update(
            get_create_test_definition(
                parameter_definition=[TestCaseParameterDefinition(name="foo")],
                entity_type=EntityType.TABLE,
            )
        )

        cls.test_suite = cls.metadata.create_or_update_executable_test_suite(
            get_create_test_suite(
                executable_entity_reference=cls.table.fullyQualifiedName.root
            )
        )

        cls.test_case = cls.metadata.create_or_update(
            get_create_test_case(
                entity_link=f"<#E::table::{cls.table.fullyQualifiedName.root}>",
                test_suite=cls.test_suite.fullyQualifiedName,
                test_definition=cls.test_definition.fullyQualifiedName,
                parameter_values=[TestCaseParameterValue(name="foo", value="10")],
            )
        )

        cls.user_1 = cls.metadata.create_or_update(
            data=get_create_user_entity(
                name="random.user", email="random.user@getcollate.io"
            )
        )

        cls.user_2 = cls.metadata.create_or_update(data=get_create_user_entity())

        cls.team_1 = cls.metadata.create_or_update(
            data=get_create_team_entity(
                name="Team 1", users=[cls.user_1.id, cls.user_2.id]
            )
        )

        cls.team_2 = cls.metadata.create_or_update(
            data=get_create_team_entity(name="Team 2", users=[cls.user_2.id])
        )

        cls.owner_user_1 = EntityReferenceList(
            root=[EntityReference(id=cls.user_1.id, type="user")]
        )
        cls.owner_user_2 = EntityReferenceList(
            root=[EntityReference(id=cls.user_2.id, type="user")]
        )
        cls.owner_team_1 = EntityReferenceList(
            root=[EntityReference(id=cls.team_1.id, type="team")]
        )
        cls.owner_team_2 = EntityReferenceList(
            root=[EntityReference(id=cls.team_2.id, type="team")]
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
                entity=DatabaseService, fqn=cls.service_name
            ).id.root
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

    def test_patch_table(self):
        new_patched_table = self.patch_test_table.model_copy(deep=True)

        # Test adding a new column to the table
        new_patched_table.columns.append(
            Column(name=ColumnName("new_column"), dataType=DataType.BIGINT),
        )
        # Test if table and column descriptions are getting patched
        new_patched_table.description = Markdown("This should get patched")
        new_patched_table.columns[0].description = Markdown(
            root="This column description should get patched"
        )

        # Test if table and column tags are getting patched
        new_patched_table.tags = [PII_TAG_LABEL]
        new_patched_table.columns[0].tags = [PII_TAG_LABEL]

        # Test if table owners are getting patched (user and team)
        new_patched_table.owners = self.owner_user_1

        patched_table = self.metadata.patch(
            entity=type(self.patch_test_table),
            source=self.patch_test_table,
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
        assert patched_table.owners.root[0].id == self.owner_user_1.root[0].id

        # After this we'll again update the descriptions, tags and owner
        new_patched_table = patched_table.copy(deep=True)

        # Descriptions should not override already present descriptions
        new_patched_table.description = Markdown("This should NOT get patched")
        new_patched_table.columns[0].description = Markdown(
            root="This column description should NOT get patched"
        )

        # Only adding the tags is allowed
        new_patched_table.tags = [PII_TAG_LABEL, TIER_TAG_LABEL]
        new_patched_table.columns[0].tags = None

        # Already existing owner should not get patched
        new_patched_table.owners = self.owner_user_2

        patched_table = self.metadata.patch(
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
        assert patched_table.owners.root[0].id == self.owner_user_1.root[0].id

    def test_patch_description(self):
        """
        Update description and force
        """
        updated: Table = self.metadata.patch_description(
            entity=Table, source=self.table, description="New description"
        )

        assert updated.description.root == "New description"

        not_updated = self.metadata.patch_description(
            entity=Table, source=self.table, description="Not passing force"
        )

        assert not not_updated

        force_updated: Table = self.metadata.patch_description(
            entity=Table,
            source=self.table,
            description="Forced new",
            force=True,
        )

        assert force_updated.description.root == "Forced new"

    def test_patch_description_TestCase(self):
        """
        Update description and force
        """
        new_description = "Description " + str(datetime.now())
        updated: TestCaseEntity = self.metadata.patch_description(
            entity=TestCaseEntity,
            source=self.test_case,
            description=new_description,
            force=True,
        )

        assert updated.description.root == new_description

        not_updated = self.metadata.patch_description(
            entity=TestCaseEntity,
            source=self.test_case,
            description="Not passing force",
        )

        assert not not_updated

        force_updated: TestCaseEntity = self.metadata.patch_description(
            entity=TestCaseEntity,
            source=self.test_case,
            description="Forced new",
            force=True,
        )

        assert force_updated.description.root == "Forced new"

    def test_patch_column_description(self):
        """
        Update column description and force
        """

        updated: Table = self.metadata.patch_column_description(
            table=self.table,
            description="New column description",
            column_fqn=self.table.fullyQualifiedName.root + ".another",
        )

        updated_col = find_column_in_table(column_name="another", table=updated)
        assert updated_col.description.root == "New column description"

        not_updated = self.metadata.patch_column_description(
            table=self.table,
            description="Not passing force",
            column_fqn=self.table.fullyQualifiedName.root + ".another",
        )

        assert not not_updated

        force_updated: Table = self.metadata.patch_column_description(
            table=self.table,
            description="Forced new",
            column_fqn=self.table.fullyQualifiedName.root + ".another",
            force=True,
        )

        updated_col = find_column_in_table(column_name="another", table=force_updated)
        assert updated_col.description.root == "Forced new"

    def test_patch_tags(self):
        """
        Update table tags
        """
        updated: Table = self.metadata.patch_tags(
            entity=Table,
            source=self.table,
            tag_labels=[PII_TAG_LABEL, TIER_TAG_LABEL],  # Shipped by default
        )
        assert updated.tags[0].tagFQN.root == "PII.Sensitive"
        assert updated.tags[1].tagFQN.root == "Tier.Tier2"

    def test_patch_column_tags(self):
        """
        Update column tags
        """
        updated: Table = self.metadata.patch_column_tags(
            table=self.table,
            column_tags=[
                ColumnTag(
                    column_fqn=self.table.fullyQualifiedName.root + ".id",
                    tag_label=PII_TAG_LABEL,  # Shipped by default
                )
            ],
        )
        updated_col = find_column_in_table(column_name="id", table=updated)

        assert updated_col.tags[0].tagFQN.root == "PII.Sensitive"

        updated_again: Table = self.metadata.patch_column_tags(
            table=self.table,
            column_tags=[
                ColumnTag(
                    column_fqn=self.table.fullyQualifiedName.root + ".id",
                    tag_label=TIER_TAG_LABEL,  # Shipped by default
                )
            ],
        )
        updated_again_col = find_column_in_table(column_name="id", table=updated_again)

        assert updated_again_col.tags[0].tagFQN.root == "PII.Sensitive"
        assert updated_again_col.tags[1].tagFQN.root == "Tier.Tier2"

    def test_patch_owner(self):
        """
        Update owner
        """
        # Database, no existing owner, owner is a User -> Modified
        updated: Database = self.metadata.patch_owner(
            entity=Database,
            source=self.db_entity,
            owners=self.owner_user_1,
        )
        assert updated is not None
        assert updated.owners.root[0].id == self.owner_user_1.root[0].id

        # Database, existing owner, owner is a User, no force -> Unmodified
        updated: Database = self.metadata.patch_owner(
            entity=Database,
            source=self.db_entity,
            owners=self.owner_user_2,
        )
        assert updated is None

        # Database, existing owner, owner is a User, force -> Modified
        updated: Database = self.metadata.patch_owner(
            entity=Database,
            source=self.db_entity,
            owners=self.owner_user_2,
            force=True,
        )
        assert updated is not None
        assert updated.owners.root[0].id == self.owner_user_2.root[0].id

        # Database, existing owner, no owner, no force -> Unmodified
        updated: Database = self.metadata.patch_owner(
            entity=Database,
            source=self.db_entity,
        )
        assert updated is None

        # Database, existing owner, no owner, force -> Modified
        updated: Database = self.metadata.patch_owner(
            entity=Database,
            source=self.db_entity,
            force=True,
        )
        assert updated is not None
        assert updated.owners == EntityReferenceList(root=[])

        # DatabaseSchema, no existing owner, owner is Team -> Modified
        updated: DatabaseSchema = self.metadata.patch_owner(
            entity=DatabaseSchema,
            source=self.db_schema_entity,
            owners=self.owner_team_1,
        )
        assert updated is not None
        assert updated.owners.root[0].id == self.owner_team_1.root[0].id

        # DatabaseSchema, existing owner, owner is Team, no force -> Unmodified
        updated: DatabaseSchema = self.metadata.patch_owner(
            entity=DatabaseSchema,
            source=self.db_schema_entity,
            owners=self.owner_team_2,
        )
        assert updated is None

        # DatabaseSchema, existing owner, owner is Team, force -> Modified
        updated: DatabaseSchema = self.metadata.patch_owner(
            entity=DatabaseSchema,
            source=self.db_schema_entity,
            owners=self.owner_team_2,
            force=True,
        )
        assert updated is not None
        assert updated.owners.root[0].id == self.owner_team_2.root[0].id

        # DatabaseSchema, existing owner, no owner, no force -> Unmodified
        updated: DatabaseSchema = self.metadata.patch_owner(
            entity=DatabaseSchema,
            source=self.db_schema_entity,
        )
        assert updated is None

        # DatabaseSchema, existing owner, no owner, force -> Modified
        updated: DatabaseSchema = self.metadata.patch_owner(
            entity=DatabaseSchema,
            source=self.db_schema_entity,
            force=True,
        )
        assert updated is not None
        assert updated.owners == EntityReferenceList(root=[])

        # Table, no existing owner, owner is a Team -> Modified
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            source=self.table,
            owners=self.owner_team_1,
        )
        assert updated is not None
        assert updated.owners.root[0].id == self.owner_team_1.root[0].id

        # Table, existing owner, owner is a Team, no force -> Unmodified
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            source=self.table,
            owners=self.owner_team_2,
        )
        assert updated is None

        # Table, existing owner, owner is a Team, force -> Modified
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            source=self.table,
            owners=self.owner_team_2,
            force=True,
        )
        assert updated is not None
        assert updated.owners.root[0].id == self.owner_team_2.root[0].id

        # Table, existing owner, no owner, no force -> Unmodified
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            source=self.table,
        )
        assert updated is None

        # Table, existing owner, no owner, no force -> Modified
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            source=self.table,
            force=True,
        )
        assert updated is not None
        assert updated.owners == EntityReferenceList(root=[])

        # Table with non-existent id, force -> Unmodified
        non_existent_table = self.table.copy(deep=True)
        non_existent_table.id = "9facb7b3-1dee-4017-8fca-1254b700afef"
        updated: Table = self.metadata.patch_owner(
            entity=Table,
            source=non_existent_table,
            force=True,
        )
        assert updated is None

        # Table, no owner, invalid owner type -> Unmodified
        # Enable after https://github.com/open-metadata/OpenMetadata/issues/11715
        # updated: Table = self.metadata.patch_owner(
        #     entity=Table,
        #     source=self.table,
        #     owner=EntityReference(id=self.table.id, type="table"),
        #     force=True,
        # )
        # assert updated is None

    def test_patch_nested_col(self):
        """
        create a table with nested cols and run patch on it
        """
        create = get_create_entity(
            entity=Table, reference=self.db_schema_entity.fullyQualifiedName
        )
        created: Table = self.metadata.create_or_update(create)

        with_tags: Table = self.metadata.patch_column_tags(
            table=created,
            column_tags=[
                ColumnTag(
                    column_fqn=created.fullyQualifiedName.root + ".struct.id",
                    tag_label=TIER_TAG_LABEL,
                )
            ],
        )

        self.assertEqual(
            with_tags.columns[2].children[0].tags[0].tagFQN.root,
            TIER_TAG_LABEL.tagFQN.root,
        )

        with_description: Table = self.metadata.patch_column_description(
            table=created,
            column_fqn=created.fullyQualifiedName.root + ".struct.name",
            description="I am so nested",
        )

        self.assertEqual(
            with_description.columns[2].children[1].description.root,
            "I am so nested",
        )

    def test_patch_when_inherited_owner(self):
        """PATCHing anything when owner is inherited, does not add the owner to the entity"""

        # Prepare a schema with owners
        create_schema = get_create_entity(
            entity=DatabaseSchema, reference=self.db_entity.fullyQualifiedName
        )
        create_schema.owners = self.owner_team_1
        db_schema_entity = self.metadata.create_or_update(data=create_schema)

        # Add a table and check it has inherited owners
        create_table = get_create_entity(
            entity=Table, reference=db_schema_entity.fullyQualifiedName
        )
        _table = self.metadata.create_or_update(data=create_table)

        table: Table = self.metadata.get_by_name(
            entity=Table, fqn=_table.fullyQualifiedName, fields=["owners"]
        )
        assert table.owners.root
        assert table.owners.root[0].inherited

        # Add a description to the table and PATCH it
        dest = table.model_copy(deep=True)
        dest.description = Markdown(root="potato")

        self.metadata.patch(
            entity=Table,
            source=table,
            destination=dest,
        )

        patched_table = self.metadata.get_by_name(
            entity=Table, fqn=table.fullyQualifiedName, fields=["owners"]
        )

        # Check the table still has inherited owners
        assert patched_table.description.root == "potato"
        assert patched_table.owners.root
        assert patched_table.owners.root[0].inherited

    def test_patch_skip_on_failure_true(self):
        """Test that patch operation skips failures when skip_on_failure=True."""
        # Create a destination with a change to trigger a patch
        corrupted_destination = self.table.model_copy(deep=True)
        corrupted_destination.description = Markdown("Modified description")

        # Mock the client.patch to raise an exception
        with mock.patch.object(self.metadata.client, "patch") as mock_patch_client:
            mock_patch_client.side_effect = Exception("API error")

            # Test with skip_on_failure=True (should return None)
            result = self.metadata.patch(
                entity=Table,
                source=self.table,
                destination=corrupted_destination,
                skip_on_failure=True,
            )

            assert result is None
            mock_patch_client.assert_called_once()

    def test_patch_skip_on_failure_false(self):
        """Test that patch operation raises exception when skip_on_failure=False."""
        # Create a destination with a change to trigger a patch
        corrupted_destination = self.table.model_copy(deep=True)
        corrupted_destination.description = Markdown("Modified description")

        # Mock the client.patch to raise an exception
        with mock.patch.object(self.metadata.client, "patch") as mock_patch_client:
            mock_patch_client.side_effect = Exception("API error")

            # Test with skip_on_failure=False (should raise exception)
            with self.assertRaises(RuntimeError) as context:
                self.metadata.patch(
                    entity=Table,
                    source=self.table,
                    destination=corrupted_destination,
                    skip_on_failure=False,
                )

            assert "API error" in str(context.exception)
            assert "Failed to update" in str(context.exception)
            mock_patch_client.assert_called_once()

    def test_patch_skip_on_failure_default_behavior(self):
        """Test that patch operation defaults to skip_on_failure=True."""
        # Create a destination with a change to trigger a patch
        corrupted_destination = self.table.model_copy(deep=True)
        corrupted_destination.description = Markdown("Modified description")

        # Mock the client.patch to raise an exception
        with mock.patch.object(self.metadata.client, "patch") as mock_patch_client:
            mock_patch_client.side_effect = Exception("API error")

            # Test without explicitly setting skip_on_failure (should default to True)
            result = self.metadata.patch(
                entity=Table, source=self.table, destination=corrupted_destination
            )

            assert result is None
            mock_patch_client.assert_called_once()

    def test_patch_description_skip_on_failure_true(self):
        """Test that patch_description skips failures when skip_on_failure=True."""
        # Mock _fetch_entity_if_exists to raise an exception
        with mock.patch.object(self.metadata, "_fetch_entity_if_exists") as mock_fetch:
            mock_fetch.side_effect = Exception("Database error")

            # Test with skip_on_failure=True
            result = self.metadata.patch_description(
                entity=Table,
                source=self.table,
                description="New description",
                skip_on_failure=True,
            )

            assert result is None
            mock_fetch.assert_called_once()

    def test_patch_description_skip_on_failure_false(self):
        """Test that patch_description raises exception when skip_on_failure=False."""
        # Mock _fetch_entity_if_exists to raise an exception
        with mock.patch.object(self.metadata, "_fetch_entity_if_exists") as mock_fetch:
            mock_fetch.side_effect = Exception("Database error")

            # Test with skip_on_failure=False
            with self.assertRaises(Exception) as context:
                self.metadata.patch_description(
                    entity=Table,
                    source=self.table,
                    description="New description",
                    skip_on_failure=False,
                )

            assert str(context.exception) == "Database error"
            mock_fetch.assert_called_once()

    def test_patch_tags_skip_on_failure_true(self):
        """Test that patch_tags skips failures when skip_on_failure=True."""
        # Mock _fetch_entity_if_exists to raise an exception
        with mock.patch.object(self.metadata, "_fetch_entity_if_exists") as mock_fetch:
            mock_fetch.side_effect = Exception("Database error")

            # Test with skip_on_failure=True
            result = self.metadata.patch_tags(
                entity=Table,
                source=self.table,
                tag_labels=[PII_TAG_LABEL],
                skip_on_failure=True,
            )

            assert result is None
            mock_fetch.assert_called_once()

    def test_patch_tags_skip_on_failure_false(self):
        """Test that patch_tags raises exception when skip_on_failure=False."""
        # Mock _fetch_entity_if_exists to raise an exception
        with mock.patch.object(self.metadata, "_fetch_entity_if_exists") as mock_fetch:
            mock_fetch.side_effect = Exception("Database error")

            # Test with skip_on_failure=False
            with self.assertRaises(Exception) as context:
                self.metadata.patch_tags(
                    entity=Table,
                    source=self.table,
                    tag_labels=[PII_TAG_LABEL],
                    skip_on_failure=False,
                )

            assert str(context.exception) == "Database error"
            mock_fetch.assert_called_once()
