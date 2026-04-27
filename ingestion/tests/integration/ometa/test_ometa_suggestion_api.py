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
OpenMetadata high-level API task-based suggestion test.
"""
import json
import time

import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.createBot import CreateBot
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.auth.jwtAuth import JWTAuthMechanism, JWTTokenExpiry
from metadata.generated.schema.entity.bot import Bot
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.teams.user import AuthenticationMechanism, User
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagFQN,
    TagLabel,
    TagSource,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.task_models import (
    CreateTaskRequest,
    ResolveTaskRequest,
    Task,
    TaskCategory,
    TaskEntityStatus,
    TaskEntityType,
    TaskResolutionType,
)

from ..integration_base import generate_name, get_create_entity, get_create_service
from .conftest import _safe_delete


def _create_bot(metadata: OpenMetadata) -> tuple[User, Bot]:
    """Create a privileged bot user for task-based suggestion tests."""
    bot_name = generate_name()
    user: User = metadata.create_or_update(
        data=CreateUserRequest(
            name=bot_name,
            email=f"{bot_name.root}@user.com",
            isBot=True,
            isAdmin=True,
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


@pytest.fixture(scope="function")
def suggestion_table(metadata, suggestion_schema):
    """Function-scoped table for suggestion tests."""
    table_name = generate_name()
    create_table = get_create_entity(
        entity=Table,
        name=table_name,
        reference=suggestion_schema.fullyQualifiedName.root,
    )
    table = metadata.create_or_update(create_table)

    yield table

    _safe_delete(metadata, entity=Table, entity_id=table.id, hard_delete=True)


def _create_description_suggestion_task(
    metadata: OpenMetadata, table: Table, description: str
) -> Task:
    return metadata.create_task(
        CreateTaskRequest(
            name=generate_name(),
            description="Create a description suggestion task",
            category=TaskCategory.MetadataUpdate,
            type=TaskEntityType.Suggestion,
            about=table.fullyQualifiedName.root,
            aboutType="table",
            payload={
                "suggestionType": "Description",
                "fieldPath": "description",
                "suggestedValue": description,
                "source": "User",
            },
        )
    )


def _create_tag_suggestion_task(
    metadata: OpenMetadata, table: Table, labels: list[TagLabel]
) -> Task:
    return metadata.create_task(
        CreateTaskRequest(
            name=generate_name(),
            description="Create a tag suggestion task",
            category=TaskCategory.MetadataUpdate,
            type=TaskEntityType.Suggestion,
            about=table.fullyQualifiedName.root,
            aboutType="table",
            payload={
                "suggestionType": "Tag",
                "fieldPath": "tags",
                "suggestedValue": json.dumps(
                    [
                        label.model_dump(mode="json", by_alias=True, exclude_none=True)
                        for label in labels
                    ]
                ),
                "source": "User",
            },
        )
    )


def _await_task_ready(metadata: OpenMetadata, task_id: str, timeout: int = 15) -> Task:
    deadline = time.time() + timeout
    last_task = None
    while time.time() < deadline:
        task = metadata.get_task(
            task_id,
            fields=[
                "status",
                "payload",
                "workflowDefinitionId",
                "workflowStageId",
                "availableTransitions",
            ],
            nullable=False,
        )
        last_task = task
        if (
            task.workflowDefinitionId
            and task.workflowStageId
            and task.availableTransitions
        ):
            return task
        time.sleep(0.25)

    raise AssertionError(
        f"Task {task_id} did not become ready for workflow resolution: {last_task}"
    )


def _await_task_deleted(
    metadata: OpenMetadata, task_id: str, timeout: int = 60
) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if metadata.get_task(task_id) is None:
            return
        time.sleep(0.25)
    raise AssertionError(f"Task {task_id} was not deleted within {timeout}s")


def _await_no_tasks_for_creator(
    metadata: OpenMetadata, creator_id: str, table_fqn: str, timeout: int = 60
) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        tasks = metadata.list_tasks(
            type_=TaskEntityType.Suggestion,
            created_by_id=creator_id,
            about_entity=table_fqn,
            limit=100,
            include="all",
        )
        if not tasks.entities:
            return
        time.sleep(0.25)
    raise AssertionError(
        f"Suggestion tasks created by {creator_id} for {table_fqn} were not cleaned up in time"
    )


class TestOMetaTaskSuggestionAPI:
    """
    Task-native suggestion API integration tests.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    """

    def test_delete_user_cleans_up_open_suggestion_tasks(
        self, metadata, suggestion_table
    ):
        """Deleted creators should not leave orphaned suggestion tasks behind."""
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

        task = _create_description_suggestion_task(
            bot_metadata,
            suggestion_table,
            "something new from test_delete_user_cleans_up_open_suggestion_tasks",
        )
        assert task.id is not None

        # Bot deletion cascades to User, which deletes from entity_relationship.
        # Parallel test workers can cause MySQL deadlocks on this table.
        _safe_delete(
            metadata,
            entity=Bot,
            entity_id=bot.id,
            recursive=True,
            hard_delete=True,
        )

        _await_no_tasks_for_creator(
            metadata, str(user.id.root), suggestion_table.fullyQualifiedName.root
        )
        _await_task_deleted(metadata, str(task.id.root))

        updated_table: Table = metadata.get_by_name(
            entity=Table, fqn=suggestion_table.fullyQualifiedName.root
        )
        assert updated_table.description.root == "I come from a patch"

    def test_accept_reject_suggestion(self, metadata, suggestion_table):
        """We can reject or apply suggestion tasks through the task API."""
        metadata.patch_description(
            entity=Table,
            source=metadata.get_by_name(
                entity=Table, fqn=suggestion_table.fullyQualifiedName.root
            ),
            description="I come from a patch",
        )

        rejected_task = _create_description_suggestion_task(
            metadata, suggestion_table, "i won't be accepted"
        )
        _await_task_ready(metadata, str(rejected_task.id.root))
        metadata.resolve_task(
            rejected_task.id.root,
            ResolveTaskRequest(
                resolutionType=TaskResolutionType.Rejected,
                comment="Reject suggestion",
            ),
        )
        updated_table: Table = metadata.get_by_name(
            entity=Table, fqn=suggestion_table.fullyQualifiedName.root
        )
        assert updated_table.description.root == "I come from a patch"

        accepted_task = _create_description_suggestion_task(
            metadata, suggestion_table, "something new"
        )
        _await_task_ready(metadata, str(accepted_task.id.root))
        metadata.apply_suggestion(accepted_task.id.root)
        updated_table: Table = metadata.get_by_name(
            entity=Table, fqn=suggestion_table.fullyQualifiedName.root
        )
        assert updated_table.description.root == "something new"

    def test_deleted_user_suggestion_task_cannot_be_resolved_after_cleanup(
        self, metadata, suggestion_table
    ):
        """Deleting a creator should remove their suggestion task before resolution."""

        user, bot = _create_bot(metadata)
        bot_metadata = int_admin_ometa(
            jwt=user.authenticationMechanism.config.JWTToken.get_secret_value()
        )

        task = _create_description_suggestion_task(
            bot_metadata, suggestion_table, "something new"
        )
        assert task.id is not None

        _safe_delete(
            metadata,
            entity=Bot,
            entity_id=bot.id,
            recursive=True,
            hard_delete=True,
        )

        _await_no_tasks_for_creator(
            metadata, str(user.id.root), suggestion_table.fullyQualifiedName.root
        )
        _await_task_deleted(metadata, str(task.id.root))

        with pytest.raises(APIError):
            metadata.apply_suggestion(task.id.root)

    def test_create_description_suggestion(self, metadata, suggestion_table):
        """We can create a description suggestion task."""
        task = _create_description_suggestion_task(
            metadata, suggestion_table, "something"
        )
        assert task.type == TaskEntityType.Suggestion
        assert task.status == TaskEntityStatus.Open
        assert task.payload["suggestedValue"] == "something"

    def test_create_tag_suggestion(self, metadata, suggestion_table):
        """We can create a tag suggestion task."""
        labels = [
            TagLabel(
                tagFQN=TagFQN("PII.Sensitive"),
                labelType=LabelType.Automated,
                state=State.Suggested,
                source=TagSource.Classification,
            )
        ]
        task = _create_tag_suggestion_task(metadata, suggestion_table, labels)
        assert task.type == TaskEntityType.Suggestion
        assert task.payload["suggestionType"] == "Tag"
        assert "PII.Sensitive" in task.payload["suggestedValue"]

    def test_list(self, metadata, suggestion_schema):
        """List task suggestions filtering by creator and about entity."""

        admin_user: User = metadata.get_by_name(
            entity=User, fqn="admin", nullable=False
        )

        create_table = get_create_entity(
            entity=Table,
            reference=suggestion_schema.fullyQualifiedName.root,
        )
        table: Table = metadata.create_or_update(create_table)

        try:
            created_task = _create_description_suggestion_task(
                metadata, table, "something"
            )
            tasks = metadata.list_tasks(
                type_=TaskEntityType.Suggestion,
                about_entity=table.fullyQualifiedName.root,
                created_by_id=admin_user.id.root,
                limit=100,
            )
            assert len(tasks.entities) == 1
            assert tasks.entities[0].id == created_task.id
        finally:
            _safe_delete(metadata, entity=Table, entity_id=table.id, hard_delete=True)

    def test_update_suggestion(self, metadata, suggestion_schema):
        """Update an existing suggestion task payload before applying it."""

        create_table = get_create_entity(
            entity=Table,
            reference=suggestion_schema.fullyQualifiedName.root,
        )
        table: Table = metadata.create_or_update(create_table)

        try:
            task = _create_description_suggestion_task(metadata, table, "something")
            _await_task_ready(metadata, str(task.id.root))
            updated = metadata.patch_task(
                task.id.root,
                [{"op": "replace", "path": "/payload/suggestedValue", "value": "new"}],
            )
            assert updated.payload["suggestedValue"] == "new"

            metadata.apply_suggestion(task.id.root)
            refreshed_table = metadata.get_by_name(
                entity=Table, fqn=table.fullyQualifiedName.root
            )
            assert refreshed_table.description.root == "new"
        finally:
            _safe_delete(metadata, entity=Table, entity_id=table.id, hard_delete=True)
