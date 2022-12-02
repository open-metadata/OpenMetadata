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
from typing import Optional

from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import ometa_logger

logger = ometa_logger()


class OMetaUserMixin:
    """
    OpenMetadata API methods related to user.

    To be inherited by OpenMetadata
    """

    client: REST

    def get_user_by_email(self, email: str) -> Optional[User]:
        """
        GET user entity by name

        :param email: User Email
        """
        if email:

            name = email.split("@")[0]
            users = self.es_search_from_fqn(entity_type=User, fqn_search_string=name)
            for user in users or []:
                if user.email.__root__ == email:
                    return user
        return None
