#  Copyright 2024 Collate
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
Mixin class containing Task entity specific methods.
"""
import json
from typing import Dict, List, Optional, Union
from uuid import UUID

from metadata.ingestion.ometa.client import REST, APIError
from metadata.ingestion.ometa.models import EntityList
from metadata.ingestion.ometa.task_models import (
    BulkTaskOperationRequest,
    BulkTaskOperationResult,
    CreateTaskRequest,
    ResolveTaskRequest,
    Task,
    TaskCategory,
    TaskEntityStatus,
    TaskEntityType,
    TaskPriority,
)
from metadata.ingestion.ometa.utils import model_str, quote
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaTaskMixin:
    """
    OpenMetadata API methods related to Tasks.

    To be inherited by OpenMetadata
    """

    client: REST
    _tasks_path = "/tasks"

    def create_task(self, create_request: CreateTaskRequest) -> Task:
        """Create a new task.

        Args:
            create_request: CreateTaskRequest with task details

        Returns:
            Task: The created task entity
        """
        resp = self.client.post(
            self._tasks_path,
            create_request.model_dump_json(
                context={"mask_secrets": False}, by_alias=True
            ),
        )
        return Task.model_validate(resp)

    def resolve_task(
        self,
        task_id: Union[str, UUID],
        resolve_request: ResolveTaskRequest,
    ) -> Task:
        """Resolve a task with the given resolution type.

        Args:
            task_id: Task ID (UUID or string)
            resolve_request: ResolveTaskRequest with resolution details

        Returns:
            Task: The resolved task
        """
        path = f"{self._tasks_path}/{model_str(task_id)}/resolve"
        resp = self.client.post(
            path,
            resolve_request.model_dump_json(
                context={"mask_secrets": False}, by_alias=True
            ),
        )
        return Task.model_validate(resp)

    def get_task(
        self,
        task_id: Union[str, UUID],
        fields: Optional[List[str]] = None,
        include: Optional[str] = None,
        nullable: bool = True,
    ) -> Optional[Task]:
        """Get a task by UUID."""
        query = []
        if fields:
            query.append(f"fields={','.join(fields)}")
        if include:
            query.append(f"include={include}")
        suffix = f"?{'&'.join(query)}" if query else ""
        try:
            resp = self.client.get(f"{self._tasks_path}/{model_str(task_id)}{suffix}")
            return Task.model_validate(resp) if resp else None
        except APIError:
            if nullable:
                return None
            raise

    def get_task_by_task_id(
        self,
        task_id: str,
        fields: Optional[List[str]] = None,
        include: Optional[str] = None,
    ) -> Optional[Task]:
        """Get a task by its human-readable task id (e.g. TASK-00001)."""
        query = []
        if fields:
            query.append(f"fields={','.join(fields)}")
        if include:
            query.append(f"include={include}")
        suffix = f"?{'&'.join(query)}" if query else ""
        resp = self.client.get(f"{self._tasks_path}/name/{quote(task_id)}{suffix}")
        return Task.model_validate(resp) if resp else None

    def list_tasks(
        self,
        fields: Optional[List[str]] = None,
        status: Optional[TaskEntityStatus] = None,
        status_group: Optional[str] = None,
        category: Optional[TaskCategory] = None,
        type_: Optional[TaskEntityType] = None,
        domain: Optional[str] = None,
        priority: Optional[TaskPriority] = None,
        assignee: Optional[str] = None,
        created_by: Optional[str] = None,
        created_by_id: Optional[Union[str, UUID]] = None,
        about_entity: Optional[str] = None,
        mentioned_user: Optional[str] = None,
        limit: int = 10,
        before: Optional[str] = None,
        after: Optional[str] = None,
        include: Optional[str] = None,
    ) -> EntityList[Task]:
        params: Dict[str, str] = {"limit": str(limit)}
        if fields:
            params["fields"] = ",".join(fields)
        if status:
            params["status"] = status.value
        if status_group:
            params["statusGroup"] = status_group
        if category:
            params["category"] = category.value
        if type_:
            params["type"] = type_.value
        if domain:
            params["domain"] = domain
        if priority:
            params["priority"] = priority.value
        if assignee:
            params["assignee"] = assignee
        if created_by:
            params["createdBy"] = created_by
        if created_by_id:
            params["createdById"] = model_str(created_by_id)
        if about_entity:
            params["aboutEntity"] = about_entity
        if mentioned_user:
            params["mentionedUser"] = mentioned_user
        if before:
            params["before"] = before
        if after:
            params["after"] = after
        if include:
            params["include"] = include

        resp = self.client.get(self._tasks_path, params)
        return EntityList(
            entities=[Task.model_validate(task) for task in resp["data"]],
            total=resp["paging"]["total"],
            after=resp["paging"].get("after"),
            before=resp["paging"].get("before"),
        )

    def add_task_comment(
        self, task_id: Union[str, UUID], message: str
    ) -> Optional[Task]:
        """Add a comment to a task.

        Args:
            task_id: Task ID (UUID or string)
            message: Comment message in Markdown format

        Returns:
            Updated task with the new comment
        """
        path = f"{self._tasks_path}/{model_str(task_id)}/comments"
        resp = self.client.post(path, data=message)
        if resp:
            return Task.model_validate(resp)
        return None

    def patch_task(self, task_id: Union[str, UUID], patch: list[dict]) -> Task:
        """Patch a task via JsonPatch operations."""
        resp = self.client.patch(
            f"{self._tasks_path}/{model_str(task_id)}",
            data=json.dumps(patch),
        )
        return Task.model_validate(resp)

    def close_task(
        self, task_id: Union[str, UUID], comment: Optional[str] = None
    ) -> Task:
        """Close a task without applying changes."""
        suffix = f"?comment={quote(comment)}" if comment else ""
        resp = self.client.post(
            f"{self._tasks_path}/{model_str(task_id)}/close{suffix}"
        )
        return Task.model_validate(resp)

    def apply_suggestion(
        self, task_id: Union[str, UUID], comment: Optional[str] = None
    ) -> Task:
        """Approve and apply a suggestion task to its target entity."""
        suffix = f"?comment={quote(comment)}" if comment else ""
        resp = self.client.put(
            f"{self._tasks_path}/{model_str(task_id)}/suggestion/apply{suffix}"
        )
        return Task.model_validate(resp)

    def bulk_task_operation(
        self, bulk_request: BulkTaskOperationRequest
    ) -> BulkTaskOperationResult:
        """Run a bulk task operation."""
        resp = self.client.post(
            f"{self._tasks_path}/bulk",
            bulk_request.model_dump_json(
                context={"mask_secrets": False}, by_alias=True
            ),
        )
        return BulkTaskOperationResult.model_validate(resp)
