#  Copyright 2026 Collate
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
Mixin class containing feed/thread specific methods.
"""

from __future__ import annotations

from typing import Optional, Union
from uuid import UUID

from metadata.generated.schema.api.feed.closeTask import CloseTaskRequest
from metadata.generated.schema.api.feed.createPost import CreatePostRequest
from metadata.generated.schema.api.feed.createThread import CreateThreadRequest
from metadata.generated.schema.api.feed.resolveTask import ResolveTaskRequest
from metadata.generated.schema.entity.feed.thread import (
    Post,
    Thread,
    ThreadTaskStatus,
    ThreadType,
)
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.models import EntityList
from metadata.ingestion.ometa.utils import model_str


class OMetaFeedMixin:
    """
    OpenMetadata API methods related to feed threads and posts.
    """

    client: REST
    _feed_path = "/feed"

    def list_threads(
        self,
        limit_posts: int = 3,
        limit: int = 10,
        before: Optional[str] = None,
        after: Optional[str] = None,
        entity_link: Optional[str] = None,
        user_id: Optional[Union[str, UUID]] = None,
        filter_type: Optional[str] = None,
        resolved: bool = False,
        thread_type: Optional[ThreadType] = None,
        task_status: Optional[ThreadTaskStatus] = None,
    ) -> EntityList[Thread]:
        params = {
            "limitPosts": str(limit_posts),
            "limit": str(limit),
            "resolved": str(resolved).lower(),
        }
        if before:
            params["before"] = before
        if after:
            params["after"] = after
        if entity_link:
            params["entityLink"] = entity_link
        if user_id:
            params["userId"] = model_str(user_id)
        if filter_type:
            params["filterType"] = filter_type
        if thread_type:
            params["type"] = thread_type.value
        if task_status:
            params["taskStatus"] = task_status.value

        resp = self.client.get(self._feed_path, params)
        return EntityList(
            entities=[Thread.model_validate(item) for item in resp["data"]],
            total=resp["paging"]["total"],
            after=resp["paging"].get("after"),
            before=resp["paging"].get("before"),
        )

    def get_thread(self, thread_id: Union[str, UUID]) -> Thread:
        resp = self.client.get(f"{self._feed_path}/{model_str(thread_id)}")
        return Thread.model_validate(resp)

    def get_task_thread(self, task_id: Union[str, int]) -> Thread:
        resp = self.client.get(f"{self._feed_path}/tasks/{model_str(task_id)}")
        return Thread.model_validate(resp)

    def create_thread(self, create_request: CreateThreadRequest) -> Thread:
        resp = self.client.post(
            self._feed_path,
            create_request.model_dump_json(
                context={"mask_secrets": False}, by_alias=True
            ),
        )
        return Thread.model_validate(resp)

    def create_post(
        self, thread_id: Union[str, UUID], create_request: CreatePostRequest
    ) -> Post:
        resp = self.client.post(
            f"{self._feed_path}/{model_str(thread_id)}/posts",
            create_request.model_dump_json(
                context={"mask_secrets": False}, by_alias=True
            ),
        )
        return Post.model_validate(resp)

    def list_posts(
        self,
        thread_id: Union[str, UUID],
        after: Optional[str] = None,
        before: Optional[str] = None,
    ) -> EntityList[Post]:
        params = {}
        if after:
            params["after"] = after
        if before:
            params["before"] = before
        resp = self.client.get(
            f"{self._feed_path}/{model_str(thread_id)}/posts", params or None
        )
        return EntityList(
            entities=[Post.model_validate(item) for item in resp["data"]],
            total=resp["paging"]["total"],
            after=resp["paging"].get("after"),
            before=resp["paging"].get("before"),
        )

    def resolve_feed_task(
        self, task_id: Union[str, int], resolve_request: ResolveTaskRequest
    ) -> Thread:
        resp = self.client.put(
            f"{self._feed_path}/tasks/{model_str(task_id)}/resolve",
            resolve_request.model_dump_json(
                context={"mask_secrets": False}, by_alias=True
            ),
        )
        return Thread.model_validate(resp)

    def close_feed_task(
        self, task_id: Union[str, int], close_request: CloseTaskRequest
    ) -> Thread:
        resp = self.client.put(
            f"{self._feed_path}/tasks/{model_str(task_id)}/close",
            close_request.model_dump_json(
                context={"mask_secrets": False}, by_alias=True
            ),
        )
        return Thread.model_validate(resp)
