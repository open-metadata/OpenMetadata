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
from metadata.ingestion.ometa.utils import ometa_logger
from metadata.utils.elasticsearch import ES_INDEX_MAP

logger = ometa_logger()


class OMetaUserMixin:
    """
    OpenMetadata API methods related to user.

    To be inherited by OpenMetadata
    """

    client: REST

    email_search = (
        "/search/query?q=email:{email}&from={from_}&size={size}&index="
        + ES_INDEX_MAP[User.__name__]
    )

    @lru_cache(maxsize=None)
    def get_user_by_email(
        self,
        email: Optional[str],
        from_count: int = 0,
        size: int = 10,
    ) -> Optional[User]:
        """
        GET user entity by name

        Args:
            email: user email to search
            from_count: records to expect
            size: number of records
        """
        if email:

            query_string = self.email_search.format(
                email=email, from_=from_count, size=size
            )

            try:
                entity_list = self._search_es_entity(
                    entity_type=User, query_string=query_string
                )
                for user in entity_list or []:
                    return user
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Could not get user info from ES for user email {email} due to {err}"
                )

        return None
