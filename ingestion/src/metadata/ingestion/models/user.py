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
"""
Custom class for User data
"""

from typing import List, Optional  # noqa: UP035

from pydantic.main import BaseModel

from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest


class OMetaUserProfile(BaseModel):
    user: CreateUserRequest
    teams: Optional[List[CreateTeamRequest]] = None  # noqa: UP006, UP045
    roles: Optional[List[CreateRoleRequest]] = None  # noqa: UP006, UP045
