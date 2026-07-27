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
from typing import Any, Dict, List, Optional, Set, Tuple  # noqa: UP035

from metadata.generated.schema.entity.teams.team import Team, TeamType
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.metadataIngestion.pipelineServiceMetadataPipeline import (
    OwnershipUpdateMode,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

OWNER_CACHE_PAGE_SIZE = 1000
OWNER_PIPELINE_ENTITY = "pipeline"
OWNER_TEAM_ENTITY = "team"
OWNER_USER_ENTITY = "user"


class OpenLineageOwnerResolver:
    """
    Resolve OpenLineage job ownership facet owners.

    OpenLineage recommends owner identifiers such as ``team:data`` and
    ``user:jdoe``. Qualified identifiers are resolved against their matching
    OpenMetadata entity type. Unqualified names are resolved as Group team
    first, then user, with a warning when both exist.
    """

    def __init__(
        self,
        metadata: OpenMetadata,
        include_owners: bool | None,
        ownership_update_mode: OwnershipUpdateMode | str | None,
    ):
        self.metadata = metadata
        self.include_owners = bool(include_owners)
        self.ownership_update_mode = OwnershipUpdateMode(
            ownership_update_mode.value
            if isinstance(ownership_update_mode, OwnershipUpdateMode)
            else ownership_update_mode or OwnershipUpdateMode.replace.value
        )
        self._owner_cache_loaded = False
        self._team_owner_ref_by_name: Dict[str, EntityReference] = {}  # noqa: UP006
        self._user_owner_ref_by_name: Dict[str, EntityReference] = {}  # noqa: UP006
        self._owner_refs_by_pipeline_fqn: Dict[str, List[EntityReference]] = {}  # noqa: UP006

    def get_pipeline_job_owners(
        self,
        job: Dict[str, Any],  # noqa: UP006
        pipeline_fqn: Optional[str] = None,  # noqa: UP045
    ) -> Optional[EntityReferenceList]:  # noqa: UP045
        """
        Resolve owners from ``job.facets.ownership.owners``.

        ``replace`` returns owners resolved from the current event. ``append``
        returns active existing Pipeline owners plus newly resolved owners.
        """
        if not self.include_owners:
            return None

        owners = (((job or {}).get("facets") or {}).get("ownership") or {}).get("owners") or []
        if not isinstance(owners, list) or not owners:
            return None

        self._ensure_pipeline_owner_cache()

        resolved: List[EntityReference] = []  # noqa: UP006
        seen: Set[Tuple[str, str]] = set()  # noqa: UP006

        for owner in owners:
            owner_ref = self._get_owner_ref(owner)
            if not owner_ref:
                continue

            ref_key = (owner_ref.type, str(owner_ref.id))
            if ref_key not in seen:
                resolved.append(owner_ref)
                seen.add(ref_key)

        if not resolved:
            return None

        if self.ownership_update_mode != OwnershipUpdateMode.append or not pipeline_fqn:
            return EntityReferenceList(root=resolved)

        existing_owners = self._owner_refs_by_pipeline_fqn.get(pipeline_fqn, [])
        merged_owners = list(existing_owners)
        seen_refs = {(owner_ref.type, str(owner_ref.id)) for owner_ref in existing_owners}
        for owner_ref in resolved:
            ref_key = (owner_ref.type, str(owner_ref.id))
            if ref_key not in seen_refs:
                merged_owners.append(owner_ref)
                seen_refs.add(ref_key)

        self._owner_refs_by_pipeline_fqn[pipeline_fqn] = merged_owners
        return EntityReferenceList(root=merged_owners)

    def _get_owner_ref(self, owner: Any) -> Optional[EntityReference]:  # noqa: UP045
        """
        Resolve a single OpenLineage ownership owner object to an OpenMetadata owner reference.

        Qualified names such as ``team:data-platform`` and ``user:jdoe`` are resolved against the
        matching entity cache. Unqualified names are resolved as Group team first, then user.
        """
        if not isinstance(owner, dict):
            return None

        raw_owner_name = owner.get("name")
        if not isinstance(raw_owner_name, str) or not raw_owner_name:
            return None

        owner_type, separator, owner_name = raw_owner_name.partition(":")
        if separator:
            owner_type = owner_type.lower()
        else:
            owner_type = None
            owner_name = raw_owner_name

        owner_key = owner_name.strip().lower()
        if not owner_key:
            return None

        if owner_type == OWNER_TEAM_ENTITY:
            owner_ref = self._team_owner_ref_by_name.get(owner_key)
        elif owner_type == OWNER_USER_ENTITY:
            owner_ref = self._user_owner_ref_by_name.get(owner_key)
        else:
            team_ref = self._team_owner_ref_by_name.get(owner_key)
            user_ref = self._user_owner_ref_by_name.get(owner_key)
            if team_ref and user_ref:
                logger.warning(
                    f"OpenLineage owner [{raw_owner_name}] matched both a team "
                    "and a user. Using the team for pipeline ownership."
                )
            owner_ref = team_ref or user_ref

        if not owner_ref:
            logger.warning(f"Unable to resolve OpenLineage owner [{raw_owner_name}] for pipeline ownership.")
        return owner_ref

    def _ensure_pipeline_owner_cache(self) -> None:
        """
        Load OpenMetadata Group teams, users, and pipeline ownership references.
        """
        if self._owner_cache_loaded:
            return

        team_owner_ref_by_name: Dict[str, EntityReference] = {}  # noqa: UP006
        user_owner_ref_by_name: Dict[str, EntityReference] = {}  # noqa: UP006
        owner_refs_by_pipeline_fqn: Dict[str, List[EntityReference]] = {}  # noqa: UP006

        try:
            for team in self.metadata.list_all_entities(
                entity=Team,
                fields=["teamType", "owns"],
                limit=OWNER_CACHE_PAGE_SIZE,
                params={"ownsEntityType": OWNER_PIPELINE_ENTITY},
                skip_on_failure=True,
            ):
                if team.teamType != TeamType.Group:
                    continue
                team_name = model_str(team.name).strip().lower()
                if team_name:
                    team_ref = team_owner_ref_by_name.setdefault(
                        team_name,
                        EntityReference(  # pyright: ignore[reportCallIssue]
                            id=model_str(team.id),
                            type=OWNER_TEAM_ENTITY,
                            name=model_str(team.name),
                            displayName=team.displayName,
                        ),
                    )
                    for owned_pipeline in team.owns.root if team.owns else []:
                        pipeline_fqn_value = owned_pipeline.fullyQualifiedName or owned_pipeline.name
                        if owned_pipeline.type == OWNER_PIPELINE_ENTITY and pipeline_fqn_value:
                            pipeline_fqn = model_str(pipeline_fqn_value)
                            pipeline_owner_refs = owner_refs_by_pipeline_fqn.setdefault(pipeline_fqn, [])
                            if not any(
                                owner.type == team_ref.type and str(owner.id) == str(team_ref.id)
                                for owner in pipeline_owner_refs
                            ):
                                pipeline_owner_refs.append(team_ref)
        except Exception as exc:
            logger.warning(f"Unable to load OpenMetadata teams for owner cache: {exc}")

        try:
            for user in self.metadata.list_all_entities(
                entity=User,
                fields=["owns"],
                limit=OWNER_CACHE_PAGE_SIZE,
                params={
                    "ownsEntityType": OWNER_PIPELINE_ENTITY,
                    "directOwnsOnly": "true",
                },
                skip_on_failure=True,
            ):
                user_name = model_str(user.name).strip().lower()
                if user_name:
                    user_ref = user_owner_ref_by_name.setdefault(
                        user_name,
                        EntityReference(  # pyright: ignore[reportCallIssue]
                            id=model_str(user.id),
                            type=OWNER_USER_ENTITY,
                            name=model_str(user.name),
                            displayName=user.displayName,
                        ),
                    )
                    for owned_pipeline in user.owns.root if user.owns else []:
                        pipeline_fqn_value = owned_pipeline.fullyQualifiedName or owned_pipeline.name
                        if owned_pipeline.type == OWNER_PIPELINE_ENTITY and pipeline_fqn_value:
                            pipeline_fqn = model_str(pipeline_fqn_value)
                            pipeline_owner_refs = owner_refs_by_pipeline_fqn.setdefault(pipeline_fqn, [])
                            if not any(
                                owner.type == user_ref.type and str(owner.id) == str(user_ref.id)
                                for owner in pipeline_owner_refs
                            ):
                                pipeline_owner_refs.append(user_ref)
        except Exception as exc:
            logger.warning(f"Unable to load OpenMetadata users for owner cache: {exc}")

        self._team_owner_ref_by_name = team_owner_ref_by_name
        self._user_owner_ref_by_name = user_owner_ref_by_name
        self._owner_refs_by_pipeline_fqn = owner_refs_by_pipeline_fqn
        self._owner_cache_loaded = True
