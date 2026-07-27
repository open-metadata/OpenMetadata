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
Databricks owner resolution helpers.
"""

from __future__ import annotations

import traceback
from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import UUID

from pydantic import EmailStr, TypeAdapter, ValidationError

from metadata.utils.logger import ingestion_logger
from metadata.utils.lru_cache import LRUCache

if TYPE_CHECKING:
    from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
    from metadata.ingestion.ometa.ometa_api import OpenMetadata
    from metadata.ingestion.source.database.databricks.client import DatabricksClient

logger = ingestion_logger()

OWNER_CACHE_SIZE = 1000
EMAIL_STR_ADAPTER = TypeAdapter(EmailStr)


@dataclass(frozen=True)
class ResolvedDatabricksOwner:
    """
    Resolved Databricks owner name and whether the owner is a workspace group.
    """

    name: str
    is_group: bool = False


class DatabricksOwnerResolver:
    """
    Resolve Databricks service principals and groups before assigning OM owners.

    SCIM lookups are performed on demand per owner (filtered queries) and cached,
    so large workspaces are never bulk-listed.
    """

    def __init__(
        self,
        api_client: DatabricksClient,
        metadata: OpenMetadata,
        include_owners: bool | None,
    ):
        self.api_client = api_client
        self.metadata = metadata
        self.include_owners = include_owners
        self._owner_cache = LRUCache(capacity=OWNER_CACHE_SIZE)

    def get_owner_ref(self, owner: str | None) -> EntityReferenceList | None:
        """
        Resolve a Databricks owner into an OpenMetadata owner reference.
        """
        if self.include_owners is False:
            return None
        if not owner or not isinstance(owner, str):
            return None

        owner_name = owner.strip()
        if not owner_name:
            return None

        if owner_name in self._owner_cache:
            try:
                return self._owner_cache.get(owner_name)
            except KeyError:
                pass

        resolved_owner = self.resolve_owner(owner_name)
        owner_ref = self._get_reference(resolved_owner)
        self._owner_cache.put(owner_name, owner_ref)
        return owner_ref

    def resolve_owner(self, owner: str) -> ResolvedDatabricksOwner:
        """
        Resolve Databricks service-principal IDs and groups to display names.
        """
        if self._is_email(owner):
            return ResolvedDatabricksOwner(owner)

        return self._resolve_service_principal(owner) or self._resolve_group(owner) or ResolvedDatabricksOwner(owner)

    def _resolve_service_principal(self, owner: str) -> ResolvedDatabricksOwner | None:
        if not self._is_service_principal_id(owner):
            return None

        owner_key = owner.casefold()
        try:
            for principal in self.api_client.list_service_principals(
                filter_expression=f'applicationId eq "{self._escape_filter_value(owner)}"'
            ):
                application_id = str(principal.get("applicationId") or "")
                display_name = principal.get("displayName")
                if display_name and application_id.casefold() == owner_key:
                    return ResolvedDatabricksOwner(display_name)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to fetch Databricks service principal [{owner}]: {exc}")
        return None

    def _resolve_group(self, owner: str) -> ResolvedDatabricksOwner | None:
        # Group IDs are numeric and display names are never UUIDs, so skip the
        # SCIM lookup for UUID owners that failed service-principal resolution.
        if self._is_service_principal_id(owner):
            return None

        owner_key = owner.casefold()
        filter_attribute = "id" if owner.isdigit() else "displayName"
        try:
            for group in self.api_client.list_groups(
                filter_expression=f'{filter_attribute} eq "{self._escape_filter_value(owner)}"'
            ):
                group_id = str(group.get("id") or "")
                display_name = group.get("displayName")
                if not display_name:
                    continue
                if group_id.casefold() == owner_key or display_name.casefold() == owner_key:
                    return ResolvedDatabricksOwner(display_name, is_group=True)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to fetch Databricks group [{owner}]: {exc}")
        return None

    def _get_reference(self, owner: ResolvedDatabricksOwner) -> EntityReferenceList | None:
        if owner.is_group:
            return self.metadata.get_reference_by_name(name=owner.name, is_owner=True)

        try:
            owner_email = EMAIL_STR_ADAPTER.validate_python(owner.name)
            owner_ref = self.metadata.get_reference_by_email(email=owner_email)
            if owner_ref:
                return owner_ref
            owner_ref = self.metadata.get_reference_by_name(name=owner_email.split("@")[0])
            if owner_ref:
                return owner_ref
        except ValidationError:
            pass

        return self.metadata.get_reference_by_name(name=owner.name)

    @staticmethod
    def _is_email(owner: str) -> bool:
        try:
            EMAIL_STR_ADAPTER.validate_python(owner)
        except ValidationError:
            return False
        else:
            return True

    @staticmethod
    def _is_service_principal_id(owner: str) -> bool:
        try:
            UUID(owner)
        except ValueError:
            return False
        else:
            return True

    @staticmethod
    def _escape_filter_value(value: str) -> str:
        return value.replace("\\", "\\\\").replace('"', '\\"')
