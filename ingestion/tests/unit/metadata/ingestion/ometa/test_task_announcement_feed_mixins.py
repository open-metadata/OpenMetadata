from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from metadata.generated.schema.api.feed.closeTask import CloseTaskRequest
from metadata.generated.schema.api.feed.createPost import CreatePostRequest
from metadata.generated.schema.api.feed.createThread import CreateThreadRequest
from metadata.generated.schema.api.feed.resolveTask import (
    ResolveTaskRequest as FeedResolveTaskRequest,
)
from metadata.generated.schema.entity.feed.thread import ThreadTaskStatus, ThreadType
from metadata.ingestion.ometa.announcement_models import (
    AnnouncementStatus,
    CreateAnnouncementRequest,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.mixins.announcement_mixin import OMetaAnnouncementMixin
from metadata.ingestion.ometa.mixins.feed_mixin import OMetaFeedMixin
from metadata.ingestion.ometa.mixins.task_mixin import OMetaTaskMixin
from metadata.ingestion.ometa.task_models import (
    BulkTaskOperationParams,
    BulkTaskOperationRequest,
    BulkTaskOperationType,
    CreateTaskRequest,
    ResolveTaskRequest,
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


def _make_feed_mixin() -> OMetaFeedMixin:
    mixin = OMetaFeedMixin.__new__(OMetaFeedMixin)
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


def _thread_response(**overrides):
    payload = {
        "id": str(uuid4()),
        "about": "<#E::table::sample_table::description>",
        "message": "Thread message",
        "type": ThreadType.Conversation.value,
    }
    payload.update(overrides)
    return payload


def _post_response(**overrides):
    payload = {
        "id": str(uuid4()),
        "message": "Post message",
        "from": "admin",
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
            about="sample.table",
            aboutType="table",
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
        mixin.client.get.assert_called_once_with(
            f"/tasks/{task_id}?fields=status,payload&include=all"
        )

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

        task = mixin.get_task_by_task_id(
            "TASK-00001", fields=["status", "priority"], include="deleted"
        )
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
        mixin.client.patch.return_value = _task_response(
            status=TaskEntityStatus.InProgress.value
        )
        mixin.client.put.return_value = _task_response(
            status=TaskEntityStatus.Approved.value
        )

        updated = mixin.add_task_comment(task_id, "hello")
        patched = mixin.patch_task(
            task_id, [{"op": "replace", "path": "/status", "value": "InProgress"}]
        )
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
        assert (
            mixin.client.post.call_args_list[1].args[0]
            == f"/tasks/{task_id}/close?comment={quote(comment)}"
        )
        assert (
            mixin.client.put.call_args_list[0].args[0]
            == f"/tasks/{task_id}/suggestion/apply?comment={quote(comment)}"
        )


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
        named = mixin.get_announcement_by_name(
            "sample.announcement", fields=["owners"], include="deleted"
        )
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
        mixin.client.patch.return_value = _announcement_response(
            status=AnnouncementStatus.Expired.value
        )
        mixin.client.put.return_value = _announcement_response()

        patched = mixin.patch_announcement(
            announcement_id,
            [{"op": "replace", "path": "/description", "value": "updated"}],
        )
        mixin.delete_announcement(announcement_id, hard_delete=True)
        restored = mixin.restore_announcement(announcement_id)

        assert patched.status == AnnouncementStatus.Expired
        assert restored.description.root == "Announcement body"
        mixin.client.delete.assert_called_once_with(
            f"/announcements/{announcement_id}?hardDelete=true"
        )


class TestFeedMixin:
    def test_list_and_get_threads(self):
        mixin = _make_feed_mixin()
        thread = _thread_response(type=ThreadType.Task.value)
        mixin.client.get.side_effect = [_entity_list(thread), thread, thread]

        threads = mixin.list_threads(
            limit_posts=5,
            limit=15,
            before="before-cursor",
            after="after-cursor",
            entity_link="<#E::table::sample.table::description>",
            user_id=uuid4(),
            filter_type="OWNER",
            resolved=True,
            thread_type=ThreadType.Task,
            task_status=ThreadTaskStatus.Open,
        )
        fetched = mixin.get_thread(uuid4())
        task_thread = mixin.get_task_thread(42)

        assert threads.total == 1
        assert fetched.message == "Thread message"
        assert task_thread.type == ThreadType.Task
        assert mixin.client.get.call_args_list[0].args[0] == "/feed"
        assert mixin.client.get.call_args_list[0].args[1]["resolved"] == "true"
        assert mixin.client.get.call_args_list[0].args[1]["taskStatus"] == "Open"

    def test_create_posts_and_resolve_close_feed_task(self):
        mixin = _make_feed_mixin()
        thread_id = uuid4()
        create_thread_request = CreateThreadRequest.model_validate(
            {
                "message": "Open thread",
                "from": "admin",
                "about": "<#E::table::sample.table::description>",
                "type": ThreadType.Task.value,
            }
        )
        create_post_request = CreatePostRequest.model_validate(
            {"message": "Reply", "from": "admin"}
        )
        resolve_request = FeedResolveTaskRequest(newValue="updated-description")
        close_request = CloseTaskRequest(comment="closing")

        mixin.client.post.side_effect = [_thread_response(), _post_response()]
        mixin.client.get.return_value = _entity_list(_post_response())
        mixin.client.put.side_effect = [
            _thread_response(resolved=True),
            _thread_response(resolved=True),
        ]

        created_thread = mixin.create_thread(create_thread_request)
        created_post = mixin.create_post(thread_id, create_post_request)
        posts = mixin.list_posts(
            thread_id, after="after-cursor", before="before-cursor"
        )
        resolved = mixin.resolve_feed_task(42, resolve_request)
        closed = mixin.close_feed_task(42, close_request)

        assert created_thread.message == "Thread message"
        assert created_post.from_ == "admin"
        assert posts.total == 1
        assert resolved.resolved is True
        assert closed.resolved is True
        assert mixin.client.post.call_args_list[0].args[0] == "/feed"
        assert mixin.client.post.call_args_list[1].args[0] == f"/feed/{thread_id}/posts"
        assert mixin.client.put.call_args_list[0].args[0] == "/feed/tasks/42/resolve"
        assert mixin.client.put.call_args_list[1].args[0] == "/feed/tasks/42/close"
