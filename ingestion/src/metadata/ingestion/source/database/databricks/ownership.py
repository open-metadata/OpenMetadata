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
from threading import Lock
from typing import TYPE_CHECKING

from pydantic import EmailStr, TypeAdapter, ValidationError

from metadata.utils.logger import ingestion_logger
from metadata.utils.lru_cache import LRUCache

if TYPE_CHECKING:
    from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
    from metadata.ingestion.ometa.ometa_api import OpenMetadata
    from metadata.ingestion.source.database.databricks.client import DatabricksClient

logger = ingestion_logger()

IDENTITY_CACHE_SIZE = 10000
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
        self._identity_maps_loaded = False
        self._identity_maps_lock = Lock()
        self._service_principal_names = LRUCache(capacity=IDENTITY_CACHE_SIZE)
        self._group_names_by_id = LRUCache(capacity=IDENTITY_CACHE_SIZE)
        self._group_names = LRUCache(capacity=IDENTITY_CACHE_SIZE)
        self._owner_cache = LRUCache(capacity=IDENTITY_CACHE_SIZE)

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

        self._load_identity_maps()
        owner_key = owner.casefold()

        service_principal_name = self._get_cached_value(self._service_principal_names, owner_key)
        if service_principal_name:
            return ResolvedDatabricksOwner(service_principal_name)

        group_name = self._get_cached_value(self._group_names_by_id, owner_key) or self._get_cached_value(
            self._group_names, owner_key
        )
        if group_name:
            return ResolvedDatabricksOwner(group_name, is_group=True)

        return ResolvedDatabricksOwner(owner)

    def _load_identity_maps(self) -> None:
        with self._identity_maps_lock:
            if self._identity_maps_loaded:
                return

            self._identity_maps_loaded = True
            try:
                for principal in self.api_client.list_service_principals():
                    application_id = principal.get("applicationId")
                    display_name = principal.get("displayName")
                    if application_id and display_name:
                        self._service_principal_names.put(application_id.casefold(), display_name)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Unable to fetch Databricks service principals: {exc}")

            try:
                for group in self.api_client.list_groups():
                    group_id = group.get("id")
                    display_name = group.get("displayName")
                    if not display_name:
                        continue
                    self._group_names.put(display_name.casefold(), display_name)
                    if group_id:
                        self._group_names_by_id.put(str(group_id).casefold(), display_name)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Unable to fetch Databricks groups: {exc}")

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
    def _get_cached_value(cache: LRUCache[str | None], key: str) -> str | None:
        if key not in cache:
            return None
        try:
            return cache.get(key)
        except KeyError:
            return None
