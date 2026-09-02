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
Mixin class containing announcement specific methods.
"""

from __future__ import annotations

import json
from uuid import UUID  # noqa: TC003

from metadata.generated.schema.api.data.restoreEntity import RestoreEntity
from metadata.ingestion.ometa.announcement_models import (
    Announcement,
    AnnouncementStatus,
    CreateAnnouncementRequest,
)
from metadata.ingestion.ometa.client import REST  # noqa: TC001
from metadata.ingestion.ometa.models import EntityList
from metadata.ingestion.ometa.utils import model_str, quote


class OMetaAnnouncementMixin:
    """
    OpenMetadata API methods related to announcements.
    """

    client: REST
    _announcements_path = "/announcements"

    def list_announcements(
        self,
        fields: list[str] | None = None,
        entity_link: str | None = None,
        status: AnnouncementStatus | None = None,
        active: bool | None = None,
        domain: str | None = None,
        limit: int = 10,
        before: str | None = None,
        after: str | None = None,
        include: str | None = None,
    ) -> EntityList[Announcement]:
        params = {"limit": str(limit)}
        if fields:
            params["fields"] = ",".join(fields)
        if entity_link:
            params["entityLink"] = entity_link
        if status:
            params["status"] = status.value
        if active is not None:
            params["active"] = str(active).lower()
        if domain:
            params["domain"] = domain
        if before:
            params["before"] = before
        if after:
            params["after"] = after
        if include:
            params["include"] = include

        resp = self.client.get(self._announcements_path, params)
        return EntityList(
            entities=[Announcement.model_validate(item) for item in resp["data"]],
            total=resp["paging"]["total"],
            after=resp["paging"].get("after"),
            before=resp["paging"].get("before"),
        )

    def get_announcement(
        self,
        announcement_id: str | UUID,
        fields: list[str] | None = None,
        include: str | None = None,
    ) -> Announcement:
        query = []
        if fields:
            query.append(f"fields={quote(','.join(fields))}")
        if include:
            query.append(f"include={quote(include)}")
        suffix = f"?{'&'.join(query)}" if query else ""
        resp = self.client.get(f"{self._announcements_path}/{model_str(announcement_id)}{suffix}")
        return Announcement.model_validate(resp)

    def get_announcement_by_name(
        self,
        fqn: str,
        fields: list[str] | None = None,
        include: str | None = None,
    ) -> Announcement:
        query = []
        if fields:
            query.append(f"fields={quote(','.join(fields))}")
        if include:
            query.append(f"include={quote(include)}")
        suffix = f"?{'&'.join(query)}" if query else ""
        resp = self.client.get(f"{self._announcements_path}/name/{quote(fqn)}{suffix}")
        return Announcement.model_validate(resp)

    def create_announcement(self, create_request: CreateAnnouncementRequest) -> Announcement:
        resp = self.client.post(
            self._announcements_path,
            create_request.model_dump_json(context={"mask_secrets": False}, by_alias=True),
        )
        return Announcement.model_validate(resp)

    def create_or_update_announcement(self, create_request: CreateAnnouncementRequest) -> Announcement:
        resp = self.client.put(
            self._announcements_path,
            create_request.model_dump_json(context={"mask_secrets": False}, by_alias=True),
        )
        return Announcement.model_validate(resp)

    def patch_announcement(self, announcement_id: str | UUID, patch: list[dict]) -> Announcement:
        resp = self.client.patch(
            f"{self._announcements_path}/{model_str(announcement_id)}",
            json.dumps(patch),
        )
        return Announcement.model_validate(resp)

    def delete_announcement(self, announcement_id: str | UUID, hard_delete: bool = False) -> None:
        suffix = "?hardDelete=true" if hard_delete else ""
        self.client.delete(f"{self._announcements_path}/{model_str(announcement_id)}{suffix}")

    def restore_announcement(self, announcement_id: str | UUID) -> Announcement:
        resp = self.client.put(
            f"{self._announcements_path}/restore",
            RestoreEntity(id=model_str(announcement_id)).model_dump_json(
                context={"mask_secrets": False}, by_alias=True
            ),
        )
        return Announcement.model_validate(resp)
