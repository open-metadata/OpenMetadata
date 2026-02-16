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
Mixin class containing Task entity specific methods

To be used by OpenMetadata class
"""
from typing import List, Optional, Union
from uuid import UUID

from metadata.generated.schema.api.tasks.createTask import CreateTaskRequest
from metadata.generated.schema.api.tasks.resolveTask import ResolveTaskRequest
from metadata.generated.schema.entity.tasks.task import Task
from metadata.generated.schema.type.taskStatus import TaskStatus
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import model_str, quote
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaTaskMixin:
    """
    OpenMetadata API methods related to Tasks.

    To be inherited by OpenMetadata
    """

    client: REST

    def create_task(self, create_request: CreateTaskRequest) -> Task:
        """Create a new task.

        Args:
            create_request: CreateTaskRequest with task details

        Returns:
            Task: The created task entity
        """
        resp = self.client.post(
            self.get_suffix(Task),
            create_request.model_dump_json(),
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
        path = f"{self.get_suffix(Task)}/{model_str(task_id)}/resolve"
        resp = self.client.post(path, resolve_request.model_dump_json())
        return Task.model_validate(resp)

    def list_tasks_by_status(
        self, status: TaskStatus, limit: int = 10
    ) -> Optional[List[Task]]:
        """List tasks filtered by status.

        Args:
            status: TaskStatus to filter by
            limit: Maximum number of tasks to return

        Returns:
            List of tasks with the given status
        """
        params = {"status": status.value, "limit": str(limit)}
        resp = self.client.get(self.get_suffix(Task), params)
        if resp and resp.get("data"):
            return [Task.model_validate(task) for task in resp["data"]]
        return None

    def list_tasks_by_assignee(
        self, assignee_fqn: str, limit: int = 10
    ) -> Optional[List[Task]]:
        """List tasks assigned to a specific user or team.

        Args:
            assignee_fqn: FQN of the user or team
            limit: Maximum number of tasks to return

        Returns:
            List of tasks assigned to the given user/team
        """
        params = {"assignee": assignee_fqn, "limit": str(limit)}
        resp = self.client.get(self.get_suffix(Task), params)
        if resp and resp.get("data"):
            return [Task.model_validate(task) for task in resp["data"]]
        return None

    def list_tasks_by_domain(
        self, domain_fqn: str, limit: int = 10
    ) -> Optional[List[Task]]:
        """List tasks within a specific domain.

        Args:
            domain_fqn: FQN of the domain
            limit: Maximum number of tasks to return

        Returns:
            List of tasks in the given domain
        """
        params = {"domain": domain_fqn, "limit": str(limit)}
        resp = self.client.get(self.get_suffix(Task), params)
        if resp and resp.get("data"):
            return [Task.model_validate(task) for task in resp["data"]]
        return None

    def get_task_by_task_id(self, task_id: str) -> Optional[Task]:
        """Get a task by its human-readable task ID (e.g., TASK-00001).

        Args:
            task_id: Human-readable task ID

        Returns:
            Task entity if found, None otherwise
        """
        return self.get_by_name(entity=Task, fqn=task_id)

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
        path = f"{self.get_suffix(Task)}/{model_str(task_id)}/comments"
        resp = self.client.post(path, data=message)
        if resp:
            return Task.model_validate(resp)
        return None

    def get_my_tasks(self, limit: int = 10) -> Optional[List[Task]]:
        """Get tasks assigned to the current user.

        Args:
            limit: Maximum number of tasks to return

        Returns:
            List of tasks assigned to the current user
        """
        params = {"assignedToMe": "true", "limit": str(limit)}
        resp = self.client.get(self.get_suffix(Task), params)
        if resp and resp.get("data"):
            return [Task.model_validate(task) for task in resp["data"]]
        return None

    def get_tasks_created_by_me(self, limit: int = 10) -> Optional[List[Task]]:
        """Get tasks created by the current user.

        Args:
            limit: Maximum number of tasks to return

        Returns:
            List of tasks created by the current user
        """
        params = {"createdByMe": "true", "limit": str(limit)}
        resp = self.client.get(self.get_suffix(Task), params)
        if resp and resp.get("data"):
            return [Task.model_validate(task) for task in resp["data"]]
        return None
