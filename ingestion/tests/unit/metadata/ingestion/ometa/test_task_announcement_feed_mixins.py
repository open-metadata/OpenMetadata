import importlib
import json
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from metadata.generated.schema.api.feed.createConversation import (
    CreateConversationRequest,
)
from metadata.generated.schema.api.feed.createPost import CreatePostRequest
from metadata.generated.schema.type.conversationFilterType import ConversationFilterType
from metadata.generated.schema.type.conversationSource import ConversationSource
from metadata.generated.schema.type.reaction import ReactionType
from metadata.ingestion.ometa.announcement_models import (
    Announcement,
    AnnouncementStatus,
    CreateAnnouncementRequest,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.mixins.announcement_mixin import OMetaAnnouncementMixin
from metadata.ingestion.ometa.mixins.conversation_mixin import OMetaConversationMixin
from metadata.ingestion.ometa.mixins.task_mixin import OMetaTaskMixin
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.task_models import (
    BulkTaskOperationParams,
    BulkTaskOperationRequest,
    BulkTaskOperationResult,
    BulkTaskOperationType,
    CreateTaskRequest,
    ResolveTaskRequest,
    Task,
    TaskCategory,
    TaskEntityStatus,
    TaskEntityType,
    TaskPriority,
    TaskResolutionType,
)
from metadata.ingestion.ometa.utils import quote


def _make_task_mixin() -> OMetaTaskMixin:
    mixin = OMetaTaskMixin.__new__(OMetaTaskMixin)
    mixin.client = MagicMock()
    return mixin


def _make_announcement_mixin() -> OMetaAnnouncementMixin:
    mixin = OMetaAnnouncementMixin.__new__(OMetaAnnouncementMixin)
    mixin.client = MagicMock()
    return mixin


def _make_conversation_mixin() -> OMetaConversationMixin:
    mixin = OMetaConversationMixin.__new__(OMetaConversationMixin)
    mixin.client = MagicMock()
    return mixin


def _task_response(**overrides):
    payload = {
        "id": str(uuid4()),
        "category": TaskCategory.MetadataUpdate.value,
        "type": TaskEntityType.Suggestion.value,
        "status": TaskEntityStatus.Open.value,
    }
    payload.update(overrides)
    return payload


def _announcement_response(**overrides):
    payload = {
        "id": str(uuid4()),
        "description": "Announcement body",
        "startTime": 1712728800000,
        "endTime": 1712815200000,
        "status": AnnouncementStatus.Active.value,
    }
    payload.update(overrides)
    return payload


def _entity_list(item):
    return {
        "data": [item],
        "paging": {"total": 1, "after": "cursor-after", "before": "cursor-before"},
    }


def _entity_reference(entity_type="user", name="admin"):
    return {"id": str(uuid4()), "type": entity_type, "name": name}


def _conversation_response(**overrides):
    payload = {
        "id": str(uuid4()),
        "source": ConversationSource.User.value,
        "about": "<#E::table::sample_table::description>",
        "entityRef": _entity_reference("table", "sample_table"),
        "message": "Conversation message",
        "createdBy": _entity_reference(),
        "createdAt": 1712728800000,
        "updatedAt": 1712728800000,
        "resolved": False,
        "replyCount": 0,
    }
    payload.update(overrides)
    return payload


def _reply_response(**overrides):
    payload = {
        "id": str(uuid4()),
        "conversationId": str(uuid4()),
        "message": "Reply message",
        "author": _entity_reference(),
        "createdAt": 1712728800000,
        "updatedAt": 1712728800000,
    }
    payload.update(overrides)
    return payload


class TestTaskMixin:
    def test_create_and_resolve_task(self):
        mixin = _make_task_mixin()
        create_request = CreateTaskRequest(
            name="task-client-create",
            category=TaskCategory.MetadataUpdate,
            type=TaskEntityType.Suggestion,
            about="<#E::table::sample.table>",
            payload={"fieldPath": "description"},
        )
        resolve_request = ResolveTaskRequest(
            resolutionType=TaskResolutionType.Approved,
            comment="approved",
        )

        created_payload = _task_response(name="task-client-create")
        resolved_payload = _task_response(status=TaskEntityStatus.Approved.value)
        mixin.client.post.side_effect = [created_payload, resolved_payload]

        created = mixin.create_task(create_request)
        resolved = mixin.resolve_task(created.id.root, resolve_request)

        assert created.name.root == "task-client-create"
        assert resolved.status == TaskEntityStatus.Approved
        assert mixin.client.post.call_args_list[0].args[0] == "/tasks"
        assert mixin.client.post.call_args_list[1].args[0].endswith("/resolve")

    def test_get_task_handles_query_params_and_nullable_api_error(self):
        mixin = _make_task_mixin()
        task_id = uuid4()
        mixin.client.get.return_value = _task_response()

        task = mixin.get_task(task_id, fields=["status", "payload"], include="all")

        assert task is not None
        mixin.client.get.assert_called_once_with(f"/tasks/{task_id}?fields=status,payload&include=all")

        mixin.client.get.side_effect = APIError({"message": "missing", "code": 404})
        assert mixin.get_task(task_id, nullable=True) is None
        with pytest.raises(APIError):
            mixin.get_task(task_id, nullable=False)

    def test_get_task_by_task_id_and_list_tasks(self):
        mixin = _make_task_mixin()
        mixin.client.get.side_effect = [
            _task_response(taskId="TASK-00001"),
            _entity_list(_task_response(priority=TaskPriority.High.value)),
        ]

        task = mixin.get_task_by_task_id("TASK-00001", fields=["status", "priority"], include="deleted")
        tasks = mixin.list_tasks(
            fields=["status", "priority"],
            status=TaskEntityStatus.Open,
            status_group="open",
            category=TaskCategory.MetadataUpdate,
            type_=TaskEntityType.Suggestion,
            domain="Marketing",
            priority=TaskPriority.High,
            assignee="admin",
            created_by="admin",
            created_by_id=uuid4(),
            about_entity="table",
            mentioned_user="bot",
            limit=25,
            before="before-cursor",
            after="after-cursor",
            include="non-deleted",
        )

        assert task.taskId == "TASK-00001"
        assert tasks.total == 1
        assert tasks.entities[0].priority == TaskPriority.High
        assert mixin.client.get.call_args_list[0].args[0].startswith("/tasks/name/")
        assert mixin.client.get.call_args_list[1].args[0] == "/tasks"
        assert mixin.client.get.call_args_list[1].args[1]["status"] == "Open"
        assert mixin.client.get.call_args_list[1].args[1]["priority"] == "High"
        assert mixin.client.get.call_args_list[1].args[1]["limit"] == "25"

    def test_task_mutation_helpers(self):
        mixin = _make_task_mixin()
        task_id = uuid4()
        comment = "needs review"
        bulk_request = BulkTaskOperationRequest(
            taskIds=[str(task_id)],
            operation=BulkTaskOperationType.Assign,
            params=BulkTaskOperationParams(comment="bulk", assignees=["admin"]),
        )
        mixin.client.post.side_effect = [
            _task_response(comments=[]),
            _task_response(status=TaskEntityStatus.Cancelled.value),
            {"totalRequested": 1, "successful": 1, "failed": 0, "results": []},
        ]
        mixin.client.patch.return_value = _task_response(status=TaskEntityStatus.InProgress.value)
        mixin.client.put.return_value = _task_response(status=TaskEntityStatus.Approved.value)

        updated = mixin.add_task_comment(task_id, "hello")
        patched = mixin.patch_task(task_id, [{"op": "replace", "path": "/status", "value": "InProgress"}])
        closed = mixin.close_task(task_id, comment=comment)
        applied = mixin.apply_suggestion(task_id, comment=comment)
        bulk_result = mixin.bulk_task_operation(bulk_request)

        assert updated is not None
        assert patched.status == TaskEntityStatus.InProgress
        assert closed.status == TaskEntityStatus.Cancelled
        assert applied.status == TaskEntityStatus.Approved
        assert bulk_result.successful == 1
        mixin.client.post.assert_any_call(f"/tasks/{task_id}/comments", data="hello")
        mixin.client.patch.assert_called_once()
        assert mixin.client.post.call_args_list[1].args[0] == f"/tasks/{task_id}/close?comment={quote(comment)}"
        assert (
            mixin.client.put.call_args_list[0].args[0] == f"/tasks/{task_id}/suggestion/apply?comment={quote(comment)}"
        )

    def test_task_minimal_paths_and_none_responses(self):
        mixin = _make_task_mixin()
        task_id = uuid4()
        mixin.client.get.side_effect = [
            None,
            None,
            _entity_list(_task_response()),
        ]
        mixin.client.post.side_effect = [
            None,
            _task_response(status=TaskEntityStatus.Cancelled.value),
        ]
        mixin.client.put.return_value = _task_response(status=TaskEntityStatus.Approved.value)

        assert mixin.get_task(task_id) is None
        assert mixin.get_task_by_task_id("TASK-00002") is None

        tasks = mixin.list_tasks()
        updated = mixin.add_task_comment(task_id, "hello")
        closed = mixin.close_task(task_id)
        applied = mixin.apply_suggestion(task_id)

        assert tasks.total == 1
        assert updated is None
        assert closed.status == TaskEntityStatus.Cancelled
        assert applied.status == TaskEntityStatus.Approved
        assert mixin.client.get.call_args_list[0].args[0] == f"/tasks/{task_id}"
        assert mixin.client.get.call_args_list[1].args[0] == f"/tasks/name/{quote('TASK-00002')}"
        assert mixin.client.get.call_args_list[2].args[1] == {"limit": "10"}
        assert mixin.client.post.call_args_list[1].args[0] == f"/tasks/{task_id}/close"
        assert mixin.client.put.call_args_list[0].args[0] == f"/tasks/{task_id}/suggestion/apply"


class TestAnnouncementMixin:
    def test_list_get_and_create_announcements(self):
        mixin = _make_announcement_mixin()
        announcement = _announcement_response(name="announcement-client")
        mixin.client.get.side_effect = [
            _entity_list(announcement),
            announcement,
            announcement,
        ]
        mixin.client.post.return_value = announcement
        mixin.client.put.return_value = announcement

        create_request = CreateAnnouncementRequest(
            name="announcement-client",
            description="Announcement body",
            entityLink="<#E::table::sample.table::description>",
            startTime=1712728800000,
            endTime=1712815200000,
            owners=["admin"],
        )

        announcements = mixin.list_announcements(
            fields=["owners", "domains"],
            entity_link="<#E::table::sample.table::description>",
            status=AnnouncementStatus.Active,
            active=True,
            domain="Marketing",
            limit=20,
            before="before-cursor",
            after="after-cursor",
            include="all",
        )
        fetched = mixin.get_announcement(uuid4(), fields=["owners"], include="deleted")
        named = mixin.get_announcement_by_name("sample.announcement", fields=["owners"], include="deleted")
        created = mixin.create_announcement(create_request)
        updated = mixin.create_or_update_announcement(create_request)

        assert announcements.total == 1
        assert fetched.description.root == "Announcement body"
        assert named.status == AnnouncementStatus.Active
        assert created.name.root == "announcement-client"
        assert updated.name.root == "announcement-client"
        assert mixin.client.get.call_args_list[0].args[0] == "/announcements"
        assert mixin.client.get.call_args_list[0].args[1]["active"] == "true"
        assert "/announcements/name/" in mixin.client.get.call_args_list[2].args[0]

    def test_patch_delete_and_restore_announcement(self):
        mixin = _make_announcement_mixin()
        announcement_id = uuid4()
        mixin.client.patch.return_value = _announcement_response(status=AnnouncementStatus.Expired.value)
        mixin.client.put.return_value = _announcement_response()

        patched = mixin.patch_announcement(
            announcement_id,
            [{"op": "replace", "path": "/description", "value": "updated"}],
        )
        mixin.delete_announcement(announcement_id, hard_delete=True)
        restored = mixin.restore_announcement(announcement_id)

        assert patched.status == AnnouncementStatus.Expired
        assert restored.description.root == "Announcement body"
        mixin.client.delete.assert_called_once_with(f"/announcements/{announcement_id}?hardDelete=true")

    def test_announcement_minimal_paths_and_soft_delete(self):
        mixin = _make_announcement_mixin()
        announcement_id = uuid4()
        announcement = _announcement_response(name="announcement-minimal")
        mixin.client.get.side_effect = [
            _entity_list(announcement),
            _entity_list(announcement),
            announcement,
            announcement,
        ]

        listed_without_active = mixin.list_announcements()
        listed = mixin.list_announcements(active=False)
        fetched = mixin.get_announcement(announcement_id)
        named = mixin.get_announcement_by_name("sample.announcement")
        mixin.delete_announcement(announcement_id, hard_delete=False)

        assert listed_without_active.total == 1
        assert listed.total == 1
        assert str(fetched.id.root) == announcement["id"]
        assert named.name.root == "announcement-minimal"
        assert mixin.client.get.call_args_list[0].args[1] == {"limit": "10"}
        assert mixin.client.get.call_args_list[1].args[1] == {
            "limit": "10",
            "active": "false",
        }
        assert mixin.client.get.call_args_list[2].args[0] == (f"/announcements/{announcement_id}")
        assert mixin.client.get.call_args_list[3].args[0] == (f"/announcements/name/{quote('sample.announcement')}")
        mixin.client.delete.assert_called_once_with(f"/announcements/{announcement_id}")


class TestConversationMixin:
    def test_list_get_and_create_conversations(self):
        mixin = _make_conversation_mixin()
        conversation_id = uuid4()
        user_id = uuid4()
        conversation = _conversation_response(id=str(conversation_id))
        mixin.client.get.side_effect = [_entity_list(conversation), conversation]
        mixin.client.post.return_value = conversation
        request = CreateConversationRequest(
            message="Open conversation",
            about="<#E::table::sample.table::description>",
        )

        conversations = mixin.list_conversations(
            limit=15,
            before="before-cursor",
            after="after-cursor",
            entity_link="<#E::table::sample.table::description>",
            user_id=user_id,
            filter_type=ConversationFilterType.OWNER,
            resolved=True,
            start_ts=1712728800000,
            end_ts=1712815200000,
        )
        fetched = mixin.get_conversation(conversation_id)
        created = mixin.create_conversation(request)

        assert conversations.total == 1
        assert fetched.message.root == "Conversation message"
        assert created.source == ConversationSource.User
        assert mixin.client.get.call_args_list[0].args[0] == "/conversations"
        assert mixin.client.get.call_args_list[0].args[1] == {
            "limit": "15",
            "resolved": "true",
            "before": "before-cursor",
            "after": "after-cursor",
            "entityLink": "<#E::table::sample.table::description>",
            "userId": str(user_id),
            "filterType": "OWNER",
            "startTs": "1712728800000",
            "endTs": "1712815200000",
        }
        assert json.loads(mixin.client.post.call_args.args[1]) == {
            "message": "Open conversation",
            "about": "<#E::table::sample.table::description>",
        }

    def test_patch_delete_and_root_reactions(self):
        mixin = _make_conversation_mixin()
        conversation_id = uuid4()
        patched_payload = _conversation_response(id=str(conversation_id), resolved=True)
        mixin.client.patch.return_value = patched_payload
        mixin.client.put.return_value = patched_payload
        mixin.client.delete.side_effect = [patched_payload, patched_payload]
        patch = [{"op": "replace", "path": "/resolved", "value": True}]

        patched = mixin.patch_conversation(conversation_id, patch)
        reacted = mixin.add_conversation_reaction(conversation_id, ReactionType.rocket)
        unreacted = mixin.remove_conversation_reaction(conversation_id, ReactionType.rocket)
        deleted = mixin.delete_conversation(conversation_id)

        assert patched.resolved is True
        assert reacted.id.root == conversation_id
        assert unreacted.id.root == conversation_id
        assert deleted.id.root == conversation_id
        mixin.client.patch.assert_called_once_with(f"/conversations/{conversation_id}", json.dumps(patch))
        mixin.client.put.assert_called_once_with(f"/conversations/{conversation_id}/reaction/rocket")
        assert mixin.client.delete.call_args_list[0].args[0] == (f"/conversations/{conversation_id}/reaction/rocket")
        assert mixin.client.delete.call_args_list[1].args[0] == (f"/conversations/{conversation_id}")

    def test_conversation_reply_routes(self):
        mixin = _make_conversation_mixin()
        conversation_id = uuid4()
        reply_id = uuid4()
        reply = _reply_response(id=str(reply_id), conversationId=str(conversation_id))
        mixin.client.get.return_value = _entity_list(reply)
        mixin.client.post.return_value = reply
        mixin.client.patch.return_value = reply
        mixin.client.put.return_value = reply
        mixin.client.delete.side_effect = [reply, reply]
        request = CreatePostRequest(message="Reply")
        patch = [{"op": "replace", "path": "/message", "value": "Edited"}]

        replies = mixin.list_conversation_replies(
            conversation_id,
            limit=25,
            before="before-cursor",
            after="after-cursor",
        )
        created = mixin.create_conversation_reply(conversation_id, request)
        patched = mixin.patch_conversation_reply(conversation_id, reply_id, patch)
        reacted = mixin.add_conversation_reply_reaction(conversation_id, reply_id, ReactionType.heart)
        unreacted = mixin.remove_conversation_reply_reaction(conversation_id, reply_id, ReactionType.heart)
        deleted = mixin.delete_conversation_reply(conversation_id, reply_id)

        assert replies.total == 1
        assert created.message.root == "Reply message"
        assert patched.id.root == reply_id
        assert reacted.id.root == reply_id
        assert unreacted.id.root == reply_id
        assert deleted.id.root == reply_id
        assert mixin.client.get.call_args.args == (
            f"/conversations/{conversation_id}/replies",
            {
                "limit": "25",
                "before": "before-cursor",
                "after": "after-cursor",
            },
        )
        assert json.loads(mixin.client.post.call_args.args[1]) == {"message": "Reply"}
        mixin.client.patch.assert_called_once_with(
            f"/conversations/{conversation_id}/replies/{reply_id}",
            json.dumps(patch),
        )
        mixin.client.put.assert_called_once_with(f"/conversations/{conversation_id}/replies/{reply_id}/reaction/heart")
        assert mixin.client.delete.call_args_list[0].args[0].endswith(f"/{reply_id}/reaction/heart")
        assert mixin.client.delete.call_args_list[1].args[0].endswith(f"/replies/{reply_id}")

    def test_activity_reply_routes(self):
        mixin = _make_conversation_mixin()
        activity_id = uuid4()
        reply = _reply_response(conversationId=str(activity_id))
        mixin.client.get.return_value = _entity_list(reply)
        mixin.client.post.return_value = reply
        request = CreatePostRequest(message="Activity reply")

        replies = mixin.list_activity_replies(
            activity_id,
            limit=30,
            before="before-cursor",
            after="after-cursor",
        )
        created = mixin.create_activity_reply(activity_id, request)

        assert replies.total == 1
        assert created.conversationId.root == activity_id
        mixin.client.get.assert_called_once_with(
            f"/activity/{activity_id}/replies",
            {
                "limit": "30",
                "before": "before-cursor",
                "after": "after-cursor",
            },
        )
        assert mixin.client.post.call_args.args[0] == f"/activity/{activity_id}/replies"
        assert json.loads(mixin.client.post.call_args.args[1]) == {"message": "Activity reply"}

    def test_minimal_list_params(self):
        mixin = _make_conversation_mixin()
        conversation_id = uuid4()
        mixin.client.get.side_effect = [
            _entity_list(_conversation_response()),
            _entity_list(_reply_response(conversationId=str(conversation_id))),
            _entity_list(_reply_response(conversationId=str(conversation_id))),
        ]

        conversations = mixin.list_conversations()
        replies = mixin.list_conversation_replies(conversation_id)
        activity_replies = mixin.list_activity_replies(conversation_id)

        assert conversations.total == 1
        assert replies.total == 1
        assert activity_replies.total == 1
        assert mixin.client.get.call_args_list[0].args[1] == {
            "limit": "10",
            "resolved": "false",
        }
        assert mixin.client.get.call_args_list[1].args[1] == {"limit": "20"}
        assert mixin.client.get.call_args_list[2].args[1] == {"limit": "20"}


class TestClientModels:
    def test_task_models_validate_nested_payloads(self):
        owner_ref = {"id": str(uuid4()), "type": "user", "name": "owner"}
        about_ref = {
            "id": str(uuid4()),
            "type": "table",
            "name": "sample_table",
            "fullyQualifiedName": "service.db.schema.sample_table",
        }
        task = Task.model_validate(
            {
                "id": str(uuid4()),
                "taskId": "TASK-00042",
                "name": "workflow-task",
                "displayName": "Workflow task",
                "description": "Task body",
                "category": TaskCategory.MetadataUpdate.value,
                "type": TaskEntityType.Suggestion.value,
                "status": TaskEntityStatus.Pending.value,
                "priority": TaskPriority.High.value,
                "about": about_ref,
                "domains": [owner_ref],
                "createdBy": owner_ref,
                "createdById": str(uuid4()),
                "assignees": [owner_ref],
                "reviewers": [owner_ref],
                "watchers": [owner_ref],
                "payload": {"fieldPath": "description"},
                "dueDate": 1712728800000,
                "externalReference": {
                    "system": "jira",
                    "externalId": "TASK-42",
                    "externalUrl": "https://example.com/TASK-42",
                    "syncStatus": "SYNCED",
                    "lastSyncedAt": 1712728800000,
                },
                "tags": [
                    {
                        "tagFQN": "PII.Sensitive",
                        "source": "Classification",
                        "labelType": "Manual",
                        "state": "Confirmed",
                    }
                ],
                "comments": [
                    {
                        "id": str(uuid4()),
                        "message": "Looks good",
                        "author": owner_ref,
                        "createdAt": 1712728800000,
                    }
                ],
                "resolution": {
                    "type": TaskResolutionType.Approved.value,
                    "resolvedBy": owner_ref,
                    "resolvedAt": 1712729800000,
                    "comment": "approved",
                    "newValue": "updated",
                },
                "workflowDefinitionId": str(uuid4()),
                "workflowInstanceId": str(uuid4()),
                "workflowStageId": "review",
                "availableTransitions": [
                    {
                        "id": "approve",
                        "label": "Approve",
                        "targetStageId": "done",
                        "targetTaskStatus": TaskEntityStatus.Approved.value,
                        "resolutionType": TaskResolutionType.Approved.value,
                        "formRef": "taskForm",
                        "requiresComment": True,
                    }
                ],
                "createdAt": 1712728800000,
                "updatedAt": 1712729800000,
                "updatedBy": "owner",
                "version": 1.2,
                "href": "https://example.com/task/42",
                "deleted": False,
                "ignoredField": "ignored",
            }
        )
        create_request = CreateTaskRequest(
            name="task-client-create",
            category=TaskCategory.MetadataUpdate,
            type=TaskEntityType.Suggestion,
            priority=TaskPriority.High,
            about="<#E::table::sample.table>",
            domain="Marketing",
            assignees=["owner"],
            reviewers=["reviewer"],
            payload={"fieldPath": "description"},
            dueDate=1712728800000,
            externalReference=task.externalReference,
            tags=task.tags,
        )
        resolve_request = ResolveTaskRequest(
            transitionId="approve",
            resolutionType=TaskResolutionType.Approved,
            comment="approved",
            newValue="updated",
            payload={"fieldPath": "description"},
        )
        bulk_result = BulkTaskOperationResult.model_validate(
            {
                "totalRequested": 1,
                "successful": 1,
                "failed": 0,
                "results": [{"taskId": str(task.id.root), "status": "success", "error": None}],
            }
        )

        assert task.externalReference.system == "jira"
        assert task.comments[0].author.name == "owner"
        assert task.availableTransitions[0].resolutionType == TaskResolutionType.Approved
        assert create_request.assignees == ["owner"]
        assert resolve_request.transitionId == "approve"
        assert bulk_result.results[0].status == "success"
        assert "ignoredField" not in task.model_dump()

    def test_announcement_models_validate_and_reject_unknown_fields(self):
        owner_ref = {"id": str(uuid4()), "type": "user", "name": "owner"}
        announcement = Announcement.model_validate(
            {
                "id": str(uuid4()),
                "name": "announcement-client",
                "fullyQualifiedName": "sample.announcement",
                "displayName": "Announcement Client",
                "description": "Announcement body",
                "entityLink": "<#E::table::sample.table::description>",
                "startTime": 1712728800000,
                "endTime": 1712815200000,
                "status": AnnouncementStatus.Active.value,
                "createdBy": "admin",
                "updatedBy": "admin",
                "owners": [owner_ref],
                "domains": [owner_ref],
                "createdAt": 1712728800000,
                "updatedAt": 1712815200000,
                "version": 1.0,
                "href": "https://example.com/announcements/1",
                "deleted": False,
                "ignoredField": "ignored",
            }
        )
        request = CreateAnnouncementRequest(
            name="announcement-client",
            displayName="Announcement Client",
            description="Announcement body",
            entityLink="<#E::table::sample.table::description>",
            startTime=1712728800000,
            endTime=1712815200000,
            owners=["admin"],
        )

        assert announcement.status == AnnouncementStatus.Active
        assert request.owners == ["admin"]
        assert "ignoredField" not in announcement.model_dump()

        with pytest.raises(ValidationError):
            CreateAnnouncementRequest(
                description="Announcement body",
                startTime=1712728800000,
                endTime=1712815200000,
                owners=["admin"],
                ignoredField="ignored",
            )

    def test_request_models_reject_invalid_input(self):
        with pytest.raises(ValidationError):
            CreateTaskRequest(
                category=TaskCategory.MetadataUpdate,
                type=TaskEntityType.Suggestion,
                ignoredField="ignored",
            )

        with pytest.raises(ValidationError):
            BulkTaskOperationRequest(
                taskIds=[],
                operation=BulkTaskOperationType.Assign,
            )

        with pytest.raises(ValidationError):
            CreateConversationRequest(
                message="   ",
                about="<#E::table::sample.table>",
            )

        with pytest.raises(ValidationError):
            CreatePostRequest(message="\n\t")


def test_openmetadata_includes_new_client_mixins():
    assert issubclass(OpenMetadata, OMetaConversationMixin)
    assert issubclass(OpenMetadata, OMetaAnnouncementMixin)
    assert issubclass(OpenMetadata, OMetaTaskMixin)


def test_reimport_new_client_modules_for_coverage():
    expected_exports = {
        "metadata.ingestion.ometa.announcement_models": [
            "Announcement",
            "CreateAnnouncementRequest",
        ],
        "metadata.ingestion.ometa.task_models": [
            "Task",
            "CreateTaskRequest",
            "BulkTaskOperationResult",
        ],
        "metadata.ingestion.ometa.mixins.announcement_mixin": ["OMetaAnnouncementMixin"],
        "metadata.ingestion.ometa.mixins.conversation_mixin": ["OMetaConversationMixin"],
        "metadata.ingestion.ometa.mixins.task_mixin": ["OMetaTaskMixin"],
        "metadata.ingestion.ometa.ometa_api": ["OpenMetadata"],
    }

    for module_name, exported_names in expected_exports.items():
        module = importlib.import_module(module_name)
        reloaded = importlib.reload(module)

        for exported_name in exported_names:
            assert hasattr(reloaded, exported_name)
