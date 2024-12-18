#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Mixin class containing User specific methods

To be used by OpenMetadata class
"""
import json
from functools import lru_cache
from typing import Optional, Type

from metadata.generated.schema.entity.teams.team import Team, TeamType
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.common import T
from metadata.ingestion.ometa.client import REST
from metadata.utils.constants import ENTITY_REFERENCE_TYPE_MAP
from metadata.utils.elasticsearch import ES_INDEX_MAP
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaUserMixin:
    """
    OpenMetadata API methods related to user.

    To be inherited by OpenMetadata
    """

    client: REST

    @staticmethod
    def email_search_query_es(entity: Type[T]) -> str:
        return (
            "/search/query?q=email.keyword:{email}&from={from_}&size={size}&index="
            + ES_INDEX_MAP[entity.__name__]
        )

    @staticmethod
    def name_search_query_es(entity: Type[T], name: str, from_: int, size: int) -> str:
        """
        Allow for more flexible lookup following what the UI is doing when searching users.

        We don't want to stick to `q=name:{name}` since in case a user is named `random.user`
        but looked as `Random User`, we want to find this match.

        Search should only look in name and displayName fields and should not return bots.
        """
        query_filter = {
            "query": {
                "query_string": {
                    "query": f"{name} AND isBot:false",
                    "fields": ["name", "displayName"],
                    "default_operator": "AND",
                    "fuzziness": "AUTO",
                }
            }
        }

        return (
            f"""/search/query?query_filter={json.dumps(query_filter)}"""
            f"&from={from_}&size={size}&index=" + ES_INDEX_MAP[entity.__name__]
        )

    def _search_by_email(
        self,
        entity: Type[T],
        email: Optional[str],
        from_count: int = 0,
        size: int = 1,
        fields: Optional[list] = None,
    ) -> Optional[T]:
        """
        GET user or team entity by mail

        Args:
            email: user email to search
            from_count: records to expect
            size: number of records
            fields: Optional field list to pass to ES request
        """
        if email:
            query_string = self.email_search_query_es(entity=entity).format(
                email=email, from_=from_count, size=size
            )
            return self.get_entity_from_es(
                entity=entity, query_string=query_string, fields=fields
            )

        return None

    def _search_by_name(
        self,
        entity: Type[T],
        name: Optional[str],
        from_count: int = 0,
        size: int = 1,
        fields: Optional[list] = None,
    ) -> Optional[T]:
        """
        GET entity by name

        Args:
            name: user name to search
            from_count: records to expect
            size: number of records
            fields: Optional field list to pass to ES request
        """
        if name:
            query_string = self.name_search_query_es(
                entity=entity, name=name, from_=from_count, size=size
            )
            return self.get_entity_from_es(
                entity=entity, query_string=query_string, fields=fields
            )

        return None

    @lru_cache(maxsize=None)
    def get_reference_by_email(
        self,
        email: Optional[str],
        from_count: int = 0,
        size: int = 1,
        fields: Optional[list] = None,
    ) -> Optional[EntityReferenceList]:
        """
        Get a User or Team Entity Reference by searching by its mail
        """
        maybe_user = self._search_by_email(
            entity=User, email=email, from_count=from_count, size=size, fields=fields
        )
        if maybe_user:
            return EntityReferenceList(
                root=[
                    EntityReference(
                        id=maybe_user.id.root,
                        type=ENTITY_REFERENCE_TYPE_MAP[User.__name__],
                        name=maybe_user.name.root,
                        displayName=maybe_user.displayName,
                    )
                ]
            )

        maybe_team = self._search_by_email(
            entity=Team, email=email, from_count=from_count, size=size, fields=fields
        )
        if maybe_team:
            return EntityReferenceList(
                root=[
                    EntityReference(
                        id=maybe_team.id.root,
                        type=ENTITY_REFERENCE_TYPE_MAP[Team.__name__],
                        name=maybe_team.name.root,
                        displayName=maybe_team.displayName,
                    )
                ]
            )

        return None

    @lru_cache(maxsize=None)
    def get_reference_by_name(
        self,
        name: Optional[str],
        from_count: int = 0,
        size: int = 1,
        fields: Optional[list] = None,
        is_owner: bool = False,
    ) -> Optional[EntityReferenceList]:
        """
        Get a User or Team Entity Reference by searching by its name
        """
        maybe_user = self._search_by_name(
            entity=User, name=name, from_count=from_count, size=size, fields=fields
        )
        if maybe_user:
            return EntityReferenceList(
                root=[
                    EntityReference(
                        id=maybe_user.id.root,
                        type=ENTITY_REFERENCE_TYPE_MAP[User.__name__],
                        name=maybe_user.name.root,
                        displayName=maybe_user.displayName,
                    )
                ]
            )

        maybe_team = self._search_by_name(
            entity=Team, name=name, from_count=from_count, size=size, fields=fields
        )
        if maybe_team:
            # if is_owner is True, we only want to return the team if it is a group
            if is_owner and maybe_team.teamType != TeamType.Group:
                return None
            return EntityReferenceList(
                root=[
                    EntityReference(
                        id=maybe_team.id.root,
                        type=ENTITY_REFERENCE_TYPE_MAP[Team.__name__],
                        name=maybe_team.name.root,
                        displayName=maybe_team.displayName,
                    )
                ]
            )

        return None
