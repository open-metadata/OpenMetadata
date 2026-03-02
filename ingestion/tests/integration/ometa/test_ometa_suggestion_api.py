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
from .conftest import _safe_delete


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


@pytest.fixture(scope="module")
def suggestion_service(metadata):
    """Module-scoped database service for suggestion tests."""
    service_name = generate_name()
    create_service = get_create_service(entity=DatabaseService, name=service_name)
    service_entity = metadata.create_or_update(create_service)

    yield service_entity

    _safe_delete(
        metadata,
        entity=DatabaseService,
        entity_id=service_entity.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def suggestion_database(metadata, suggestion_service):
    """Module-scoped database for suggestion tests."""
    database_name = generate_name()
    create_database = get_create_entity(
        entity=Database, name=database_name, reference=suggestion_service.name.root
    )
    database = metadata.create_or_update(create_database)

    yield database

    _safe_delete(metadata, entity=Database, entity_id=database.id, hard_delete=True)


@pytest.fixture(scope="module")
def suggestion_schema(metadata, suggestion_database):
    """Module-scoped database schema for suggestion tests."""
    schema_name = generate_name()
    create_schema = get_create_entity(
        entity=DatabaseSchema,
        name=schema_name,
        reference=suggestion_database.fullyQualifiedName.root,
    )
    schema = metadata.create_or_update(create_schema)

    yield schema

    _safe_delete(
        metadata,
        entity=DatabaseSchema,
        entity_id=schema.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def suggestion_table(metadata, suggestion_schema):
    """Module-scoped table for suggestion tests."""
    table_name = generate_name()
    create_table = get_create_entity(
        entity=Table,
        name=table_name,
        reference=suggestion_schema.fullyQualifiedName.root,
    )
    table = metadata.create_or_update(create_table)

    yield table

    _safe_delete(metadata, entity=Table, entity_id=table.id, hard_delete=True)


class TestOMetaSuggestionAPI:
    """
    Suggestion API integration tests.
    Tests suggestion creation, acceptance, rejection, and updates.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    @pytest.mark.order(1)
    def test_accept_all_delete_user(self, metadata, suggestion_table):
        """We can accept all suggestions of a deleted user"""
        user, bot = _create_bot(metadata)
        bot_metadata = int_admin_ometa(
            jwt=user.authenticationMechanism.config.JWTToken.get_secret_value()
        )

        metadata.patch_description(
            entity=Table,
            source=metadata.get_by_name(
                entity=Table, fqn=suggestion_table.fullyQualifiedName.root
            ),
            description="I come from a patch",
        )

        patched_table = metadata.get_by_name(
            entity=Table, fqn=suggestion_table.fullyQualifiedName.root
        )
        assert (
            patched_table.description.root == "I come from a patch"
        ), f"Patch failed: description is {patched_table.description.root}"

        suggestion_request = CreateSuggestionRequest(
            description="something new from test_accept_all_delete_user",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                root=get_entity_link(
                    Table, fqn=suggestion_table.fullyQualifiedName.root
                )
            ),
        )

        suggestion = bot_metadata.create(suggestion_request)
        assert suggestion

        # Bot deletion cascades to User, which deletes from entity_relationship.
        # Parallel test workers can cause MySQL deadlocks on this table.
        _safe_delete(
            metadata,
            entity=Bot,
            entity_id=bot.id,
            recursive=True,
            hard_delete=True,
        )

        metadata.accept_all_suggestions(
            fqn=suggestion_table.fullyQualifiedName.root,
            user_id=user.id,
            suggestion_type=SuggestionType.SuggestDescription,
        )
        updated_table: Table = metadata.get_by_name(
            entity=Table, fqn=suggestion_table.fullyQualifiedName.root
        )
        assert updated_table.description.root == "I come from a patch"

    @pytest.mark.order(2)
    def test_accept_reject_suggestion(self, metadata, suggestion_table):
        """We can create and accept a suggestion"""
        suggestion_request = CreateSuggestionRequest(
            description="i won't be accepted",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                root=get_entity_link(
                    Table, fqn=suggestion_table.fullyQualifiedName.root
                )
            ),
        )

        metadata.patch_description(
            entity=Table,
            source=metadata.get_by_name(
                entity=Table, fqn=suggestion_table.fullyQualifiedName.root
            ),
            description="I come from a patch",
        )

        suggestion = metadata.create(suggestion_request)

        metadata.reject_suggestion(suggestion.root.id)
        updated_table: Table = metadata.get_by_name(
            entity=Table, fqn=suggestion_table.fullyQualifiedName.root
        )
        assert updated_table.description.root == "I come from a patch"

        suggestion_request = CreateSuggestionRequest(
            description="something new",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                root=get_entity_link(
                    Table, fqn=suggestion_table.fullyQualifiedName.root
                )
            ),
        )

        suggestion = metadata.create(suggestion_request)

        metadata.accept_suggestion(suggestion.root.id)
        updated_table: Table = metadata.get_by_name(
            entity=Table, fqn=suggestion_table.fullyQualifiedName.root
        )
        assert updated_table.description.root == "something new"

    @pytest.mark.order(3)
    def test_accept_suggest_delete_user(self, metadata, suggestion_table):
        """We can accept the suggestion of a deleted user"""

        user, bot = _create_bot(metadata)
        bot_metadata = int_admin_ometa(
            jwt=user.authenticationMechanism.config.JWTToken.get_secret_value()
        )

        suggestion_request = CreateSuggestionRequest(
            description="something new",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                root=get_entity_link(
                    Table, fqn=suggestion_table.fullyQualifiedName.root
                )
            ),
        )

        suggestion = bot_metadata.create(suggestion_request)
        assert suggestion

        _safe_delete(
            metadata,
            entity=Bot,
            entity_id=bot.id,
            recursive=True,
            hard_delete=True,
        )

        with pytest.raises(APIError) as exc:
            metadata.accept_suggestion(suggestion.root.id)

        assert (
            str(exc.value)
            == f"Suggestion instance for {suggestion.root.id.root} not found"
        )

    @pytest.mark.order(4)
    def test_create_description_suggestion(self, metadata, suggestion_table):
        """We can create a suggestion"""
        suggestion_request = CreateSuggestionRequest(
            description="something",
            type=SuggestionType.SuggestDescription,
            entityLink=EntityLink(
                root=get_entity_link(
                    Table, fqn=suggestion_table.fullyQualifiedName.root
                )
            ),
        )

        metadata.create(suggestion_request)

    @pytest.mark.order(5)
    def test_create_tag_suggestion(self, metadata, suggestion_table):
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
                root=get_entity_link(
                    Table, fqn=suggestion_table.fullyQualifiedName.root
                )
            ),
        )

        metadata.create(suggestion_request)

    @pytest.mark.order(6)
    def test_list(self, metadata, suggestion_schema):
        """List filtering by creator"""

        admin_user: User = metadata.get_by_name(
            entity=User, fqn="admin", nullable=False
        )

        create_table = get_create_entity(
            entity=Table,
            reference=suggestion_schema.fullyQualifiedName.root,
        )
        table: Table = metadata.create_or_update(create_table)

        try:
            suggestion_request = CreateSuggestionRequest(
                description="something",
                type=SuggestionType.SuggestDescription,
                entityLink=EntityLink(
                    root=get_entity_link(Table, fqn=table.fullyQualifiedName.root)
                ),
            )

            metadata.create(suggestion_request)

            suggestions = metadata.list_all_entities(
                entity=Suggestion,
                params={
                    "entityFQN": table.fullyQualifiedName.root,
                    "userId": str(admin_user.id.root),
                },
            )

            assert len(list(suggestions)) == 1
        finally:
            _safe_delete(metadata, entity=Table, entity_id=table.id, hard_delete=True)

    @pytest.mark.order(7)
    def test_update_suggestion(self, metadata, suggestion_schema):
        """Update an existing suggestion"""

        create_table = get_create_entity(
            entity=Table,
            reference=suggestion_schema.fullyQualifiedName.root,
        )
        table: Table = metadata.create_or_update(create_table)

        try:
            suggestion_request = CreateSuggestionRequest(
                description="something",
                type=SuggestionType.SuggestDescription,
                entityLink=EntityLink(
                    root=get_entity_link(Table, fqn=table.fullyQualifiedName.root)
                ),
            )

            res: Suggestion = metadata.create(suggestion_request)
            assert res.root.description == "something"

            res.root.description = "new"
            new = metadata.update_suggestion(res)
            assert new.root.description == "new"
        finally:
            _safe_delete(metadata, entity=Table, entity_id=table.id, hard_delete=True)
