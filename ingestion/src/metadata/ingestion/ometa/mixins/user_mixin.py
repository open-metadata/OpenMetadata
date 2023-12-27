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
import traceback
from functools import lru_cache
from typing import Optional

from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.ometa.client import REST
from metadata.utils.elasticsearch import ES_INDEX_MAP
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaUserMixin:
    """
    OpenMetadata API methods related to user.

    To be inherited by OpenMetadata
    """

    client: REST

    email_search = (
        "/search/query?q=email.keyword:{email}&from={from_}&size={size}&index="
        + ES_INDEX_MAP[User.__name__]
    )

    # Allow for more flexible name lookup
    name_search = (
        "/search/query?q={name}&from={from_}&size={size}&index="
        + ES_INDEX_MAP[User.__name__]
    )

    def _get_user_by_es(
        self, query_string: str, fields: Optional[list] = None
    ) -> Optional[User]:
        """Fetch user information via ES"""

        try:
            entity_list = self._search_es_entity(
                entity_type=User, query_string=query_string, fields=fields
            )
            for user in entity_list or []:
                return user
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not get user info from ES due to {err}")

        return None

    @lru_cache(maxsize=None)
    def get_user_by_email(
        self,
        email: Optional[str],
        from_count: int = 0,
        size: int = 1,
        fields: Optional[list] = None,
    ) -> Optional[User]:
        """
        GET user entity by mail

        Args:
            email: user email to search
            from_count: records to expect
            size: number of records
            fields: Optional field list to pass to ES request
        """
        if email:
            query_string = self.email_search.format(
                email=email, from_=from_count, size=size
            )
            return self._get_user_by_es(query_string=query_string, fields=fields)

        return None

    @lru_cache(maxsize=None)
    def get_user_by_name(
        self,
        name: Optional[str],
        from_count: int = 0,
        size: int = 1,
        fields: Optional[list] = None,
    ) -> Optional[User]:
        """
        GET user entity by name

        Args:
            name: user name to search
            from_count: records to expect
            size: number of records
            fields: Optional field list to pass to ES request
        """
        if name:
            query_string = self.name_search.format(
                name=name, from_=from_count, size=size
            )
            return self._get_user_by_es(query_string=query_string, fields=fields)

        return None
