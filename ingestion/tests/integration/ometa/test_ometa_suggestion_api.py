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
OpenMetadata high-level API Suggestion test
"""
from unittest import TestCase

import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.createBot import CreateBot
from metadata.generated.schema.api.feed.createSuggestion import CreateSuggestionRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.auth.jwtAuth import JWTAuthMechanism, JWTTokenExpiry
from metadata.generated.schema.entity.bot import Bot
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.feed.suggestion import Suggestion, SuggestionType
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.teams.user import AuthenticationMechanism, User
from metadata.generated.schema.type.basic import EntityLink
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagFQN,
    TagLabel,
    TagSource,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.clickhouse.utils import Tuple
from metadata.utils.entity_link import get_entity_link

from ..integration_base import generate_name, get_create_entity, get_create_service


def _create_bot(metadata: OpenMetadata) -> Tuple[User, Bot]:
    """Create a bot"""
    bot_name = generate_name()
    user: User = metadata.create_or_update(
        data=CreateUserRequest(
            name=bot_name,
            email=f"{bot_name.root}@user.com",
            isBot=True,
            authenticationMechanism=AuthenticationMechanism(
                authType="JWT",
                config=JWTAuthMechanism(
                    JWTTokenExpiry=JWTTokenExpiry.Unlimited,
                ),
            ),
        )
    )
    bot: Bot = metadata.create_or_update(
        data=CreateBot(
            name=bot_name,
            botUser=bot_name.root,
        )
    )

    return user, bot


class OMetaSuggestionTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    metadata = int_admin_ometa()

    service_name = generate_name()
    db_name = generate_name()
    schema_name = generate_name()
    table_name = generate_name()

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients: Pipeline Entity
        """
        create_service = get_create_service(
            entity=DatabaseService, name=cls.service_name
        )
        cls.metadata.create_or_update(create_service)

        create_database = get_create_entity(
            entity=Database, name=cls.schema_name, reference=cls.service_name.root
        )
        cls.database: Database = cls.metadata.create_or_update(create_database)

        create_schema = get_create_entity(
            entity=DatabaseSchema,
            name=cls.schema_name,
            reference=cls.database.fullyQualifiedName.root,
        )
        cls.schema: DatabaseSchema = cls.metadata.create_or_update(create_schema)

        create_table = get_create_entity(
            entity=Table,
            name=cls.table_name,
            reference=cls.schema.fullyQualifiedName.root,
        )
        cls.table: Table = cls.metadata.create_or_update(create_table)

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn=cls.service_name.root
            ).id.root
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_create_description_suggestion(self):
        """We can create a suggestion"""
        suggestion_request = CreateSuggestionRequest(
            description="something",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                root=get_entity_link(Table, fqn=self.table.fullyQualifiedName.root)
            ),
        )

        # Suggestions only support POST (not PUT)
        self.metadata.create(suggestion_request)

    def test_accept_reject_suggestion(self):
        """We can create and accept a suggestion"""
        suggestion_request = CreateSuggestionRequest(
            description="i won't be accepted",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                root=get_entity_link(Table, fqn=self.table.fullyQualifiedName.root)
            ),
        )

        self.metadata.patch_description(
            entity=Table,
            source=self.metadata.get_by_name(
                entity=Table, fqn=self.table.fullyQualifiedName.root
            ),
            description="I come from a patch",
        )

        # Suggestions only support POST (not PUT)
        suggestion = self.metadata.create(suggestion_request)

        # We can reject a suggestion
        self.metadata.reject_suggestion(suggestion.root.id)
        updated_table: Table = self.metadata.get_by_name(
            entity=Table, fqn=self.table.fullyQualifiedName.root
        )
        assert updated_table.description.root == "I come from a patch"

        # We create a new suggestion and accept it this time
        suggestion_request = CreateSuggestionRequest(
            description="something new",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                root=get_entity_link(Table, fqn=self.table.fullyQualifiedName.root)
            ),
        )

        # Suggestions only support POST (not PUT)
        suggestion = self.metadata.create(suggestion_request)

        # We can accept a suggestion
        self.metadata.accept_suggestion(suggestion.root.id)
        updated_table: Table = self.metadata.get_by_name(
            entity=Table, fqn=self.table.fullyQualifiedName.root
        )
        assert updated_table.description.root == "something new"

    def test_accept_suggest_delete_user(self):
        """We can accept the suggestion of a deleted user"""

        user, bot = _create_bot(self.metadata)
        bot_metadata = int_admin_ometa(
            jwt=user.authenticationMechanism.config.JWTToken.get_secret_value()
        )

        # We create a new suggestion and accept it this time
        suggestion_request = CreateSuggestionRequest(
            description="something new",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                root=get_entity_link(Table, fqn=self.table.fullyQualifiedName.root)
            ),
        )

        # Suggestions only support POST (not PUT)
        suggestion = bot_metadata.create(suggestion_request)
        assert suggestion

        # Delete the bot
        self.metadata.delete(
            entity=Bot,
            entity_id=bot.id,
            recursive=True,
            hard_delete=True,
        )

        # We won't find the suggestion
        with pytest.raises(APIError) as exc:
            self.metadata.accept_suggestion(suggestion.root.id)

        assert (
            str(exc.value)
            == f"Suggestion instance for {suggestion.root.id.root} not found"
        )

    def test_accept_all_delete_user(self):
        """We can accept all suggestions of a deleted user"""
        user, bot = _create_bot(self.metadata)
        bot_metadata = int_admin_ometa(
            jwt=user.authenticationMechanism.config.JWTToken.get_secret_value()
        )

        self.metadata.patch_description(
            entity=Table,
            source=self.metadata.get_by_name(
                entity=Table, fqn=self.table.fullyQualifiedName.root
            ),
            description="I come from a patch",
        )

        # We create a new suggestion and accept it this time
        suggestion_request = CreateSuggestionRequest(
            description="something new from test_accept_all_delete_user",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                root=get_entity_link(Table, fqn=self.table.fullyQualifiedName.root)
            ),
        )

        # Suggestions only support POST (not PUT)
        suggestion = bot_metadata.create(suggestion_request)
        assert suggestion

        # Delete the bot
        self.metadata.delete(
            entity=Bot,
            entity_id=bot.id,
            recursive=True,
            hard_delete=True,
        )

        # This will do nothing, since there's no suggestions there
        self.metadata.accept_all_suggestions(
            fqn=self.table.fullyQualifiedName.root,
            user_id=user.id,
            suggestion_type=SuggestionType.SuggestDescription,
        )
        updated_table: Table = self.metadata.get_by_name(
            entity=Table, fqn=self.table.fullyQualifiedName.root
        )
        assert updated_table.description.root == "I come from a patch"

    def test_create_tag_suggestion(self):
        """We can create a suggestion"""
        suggestion_request = CreateSuggestionRequest(
            tagLabels=[
                TagLabel(
                    tagFQN=TagFQN("PII.Sensitive"),
                    labelType=LabelType.Automated,
                    state=State.Suggested.value,
                    source=TagSource.Classification,
                )
            ],
            type=SuggestionType.SuggestTagLabel,
            entityLink=EntityLink(
                root=get_entity_link(Table, fqn=self.table.fullyQualifiedName.root)
            ),
        )

        # Suggestions only support POST (not PUT)
        self.metadata.create(suggestion_request)

    def test_list(self):
        """List filtering by creator"""

        admin_user: User = self.metadata.get_by_name(
            entity=User, fqn="admin", nullable=False
        )

        create_table = get_create_entity(
            entity=Table,
            reference=self.schema.fullyQualifiedName.root,
        )
        table: Table = self.metadata.create_or_update(create_table)

        suggestion_request = CreateSuggestionRequest(
            description="something",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                root=get_entity_link(Table, fqn=table.fullyQualifiedName.root)
            ),
        )

        # Suggestions only support POST (not PUT)
        self.metadata.create(suggestion_request)

        suggestions = self.metadata.list_all_entities(
            entity=Suggestion,
            params={
                "entityFQN": table.fullyQualifiedName.root,
                "userId": str(admin_user.id.root),
            },
        )

        self.assertEqual(len(list(suggestions)), 1)

    def test_update_suggestion(self):
        """Update an existing suggestion"""

        create_table = get_create_entity(
            entity=Table,
            name=self.schema_name,
            reference=self.schema.fullyQualifiedName.root,
        )
        table: Table = self.metadata.create_or_update(create_table)

        suggestion_request = CreateSuggestionRequest(
            description="something",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                root=get_entity_link(Table, fqn=table.fullyQualifiedName.root)
            ),
        )

        # Suggestions only support POST (not PUT)
        res: Suggestion = self.metadata.create(suggestion_request)
        self.assertEqual(res.root.description, "something")

        res.root.description = "new"
        new = self.metadata.update_suggestion(res)
        self.assertEqual(new.root.description, "new")
