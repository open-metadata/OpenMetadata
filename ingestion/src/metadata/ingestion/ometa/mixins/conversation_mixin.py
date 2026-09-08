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
Mixin class containing Conversation V2 methods.
"""

from __future__ import annotations

import json
from typing import Any, TypeVar
from uuid import UUID  # noqa: TC003

from pydantic import BaseModel

from metadata.generated.schema.api.feed.createConversation import (  # noqa: TC001
    CreateConversationRequest,
)
from metadata.generated.schema.api.feed.createPost import CreatePostRequest  # noqa: TC001
from metadata.generated.schema.entity.feed.conversation import Conversation
from metadata.generated.schema.entity.feed.conversationReply import ConversationReply
from metadata.generated.schema.type.conversationFilterType import (  # noqa: TC001
    ConversationFilterType,
)
from metadata.generated.schema.type.reaction import ReactionType  # noqa: TC001
from metadata.ingestion.ometa.client import REST  # noqa: TC001
from metadata.ingestion.ometa.models import EntityList
from metadata.ingestion.ometa.utils import model_str

T = TypeVar("T", bound=BaseModel)


class OMetaConversationMixin:
    """OpenMetadata API methods related to conversations and activity replies."""

    client: REST
    _conversations_path = "/conversations"
    _activity_path = "/activity"

    @staticmethod
    def _result_list(
        response: Any,
        model: type[T],
    ) -> EntityList[T]:
        # REST.get is untyped and can hand back a raw Response or None; the paged
        # endpoints only ever return a decoded body.
        if not isinstance(response, dict):
            return EntityList(entities=[], total=0)
        # An error body decodes to a dict too, so read the paged shape defensively rather than
        # turning an unexpected payload into a KeyError.
        paging = response.get("paging") or {}
        return EntityList(
            entities=[model.model_validate(item) for item in response.get("data") or []],
            total=paging.get("total", 0),
            after=paging.get("after"),
            before=paging.get("before"),
        )

    def list_conversations(
        self,
        limit: int = 10,
        before: str | None = None,
        after: str | None = None,
        entity_link: str | None = None,
        user_id: str | UUID | None = None,
        filter_type: ConversationFilterType | None = None,
        resolved: bool = False,
        start_ts: int | None = None,
        end_ts: int | None = None,
    ) -> EntityList[Conversation]:
        params: dict[str, str] = {
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
            params["filterType"] = filter_type.value
        if start_ts is not None:
            params["startTs"] = str(start_ts)
        if end_ts is not None:
            params["endTs"] = str(end_ts)

        response = self.client.get(self._conversations_path, params)
        return self._result_list(response, Conversation)

    def create_conversation(self, request: CreateConversationRequest) -> Conversation:
        response = self.client.post(
            self._conversations_path,
            request.model_dump_json(context={"mask_secrets": False}, by_alias=True),
        )
        return Conversation.model_validate(response)

    def get_conversation(self, conversation_id: str | UUID) -> Conversation:
        response = self.client.get(f"{self._conversations_path}/{model_str(conversation_id)}")
        return Conversation.model_validate(response)

    def patch_conversation(
        self,
        conversation_id: str | UUID,
        patch: list[dict],
    ) -> Conversation:
        response = self.client.patch(
            f"{self._conversations_path}/{model_str(conversation_id)}",
            json.dumps(patch),
        )
        return Conversation.model_validate(response)

    def delete_conversation(self, conversation_id: str | UUID) -> Conversation:
        response = self.client.delete(f"{self._conversations_path}/{model_str(conversation_id)}")
        return Conversation.model_validate(response)

    def add_conversation_reaction(
        self,
        conversation_id: str | UUID,
        reaction_type: ReactionType,
    ) -> Conversation:
        response = self.client.put(
            f"{self._conversations_path}/{model_str(conversation_id)}/reaction/{reaction_type.value}"
        )
        return Conversation.model_validate(response)

    def remove_conversation_reaction(
        self,
        conversation_id: str | UUID,
        reaction_type: ReactionType,
    ) -> Conversation:
        response = self.client.delete(
            f"{self._conversations_path}/{model_str(conversation_id)}/reaction/{reaction_type.value}"
        )
        return Conversation.model_validate(response)

    def list_conversation_replies(
        self,
        conversation_id: str | UUID,
        limit: int = 20,
        before: str | None = None,
        after: str | None = None,
    ) -> EntityList[ConversationReply]:
        params: dict[str, str] = {"limit": str(limit)}
        if before:
            params["before"] = before
        if after:
            params["after"] = after
        response = self.client.get(f"{self._conversations_path}/{model_str(conversation_id)}/replies", params)
        return self._result_list(response, ConversationReply)

    def create_conversation_reply(
        self,
        conversation_id: str | UUID,
        request: CreatePostRequest,
    ) -> ConversationReply:
        response = self.client.post(
            f"{self._conversations_path}/{model_str(conversation_id)}/replies",
            request.model_dump_json(context={"mask_secrets": False}, by_alias=True),
        )
        return ConversationReply.model_validate(response)

    def patch_conversation_reply(
        self,
        conversation_id: str | UUID,
        reply_id: str | UUID,
        patch: list[dict],
    ) -> ConversationReply:
        response = self.client.patch(
            f"{self._conversations_path}/{model_str(conversation_id)}/replies/{model_str(reply_id)}",
            json.dumps(patch),
        )
        return ConversationReply.model_validate(response)

    def delete_conversation_reply(
        self,
        conversation_id: str | UUID,
        reply_id: str | UUID,
    ) -> ConversationReply:
        response = self.client.delete(
            f"{self._conversations_path}/{model_str(conversation_id)}/replies/{model_str(reply_id)}"
        )
        return ConversationReply.model_validate(response)

    def add_conversation_reply_reaction(
        self,
        conversation_id: str | UUID,
        reply_id: str | UUID,
        reaction_type: ReactionType,
    ) -> ConversationReply:
        response = self.client.put(
            f"{self._conversations_path}/{model_str(conversation_id)}/replies/"
            f"{model_str(reply_id)}/reaction/{reaction_type.value}"
        )
        return ConversationReply.model_validate(response)

    def remove_conversation_reply_reaction(
        self,
        conversation_id: str | UUID,
        reply_id: str | UUID,
        reaction_type: ReactionType,
    ) -> ConversationReply:
        response = self.client.delete(
            f"{self._conversations_path}/{model_str(conversation_id)}/replies/"
            f"{model_str(reply_id)}/reaction/{reaction_type.value}"
        )
        return ConversationReply.model_validate(response)

    def list_activity_replies(
        self,
        activity_id: str | UUID,
        limit: int = 20,
        before: str | None = None,
        after: str | None = None,
    ) -> EntityList[ConversationReply]:
        params: dict[str, str] = {"limit": str(limit)}
        if before:
            params["before"] = before
        if after:
            params["after"] = after
        response = self.client.get(f"{self._activity_path}/{model_str(activity_id)}/replies", params)
        return self._result_list(response, ConversationReply)

    def create_activity_reply(
        self,
        activity_id: str | UUID,
        request: CreatePostRequest,
    ) -> ConversationReply:
        response = self.client.post(
            f"{self._activity_path}/{model_str(activity_id)}/replies",
            request.model_dump_json(context={"mask_secrets": False}, by_alias=True),
        )
        return ConversationReply.model_validate(response)
