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
Metabase Models
"""
from typing import List

from pydantic import BaseModel


class User(BaseModel):
    """
    Model for creator in Dashboard Model
    """

    email: str
    first_name: str
    last_login: str
    is_qbnewb: bool
    is_superuser: bool
    id: int
    last_name: str
    date_joined: str
    common_name: str


class LastEditInfo(BaseModel):
    """
    Model for last_edited_info in Dashboard Model
    """

    id: int
    email: str
    first_name: str
    last_name: str
    timestamp: str


class Dashboard(BaseModel):
    """
    Model for Dashboard in Metabase
    """

    description: str
    archived: bool
    collection_position: None
    creator: User
    enable_embedding: bool
    collection_id: None
    show_in_getting_started: bool
    name: str
    caveats: None
    creator_id: int
    updated_at: str  # datetime?
    made_public_by_id: None
    embedding_params: None
    cache_ttl: None
    id: int
    position: None
    entity_id: str
    last_edit_info: LastEditInfo
    parameters: List
    created_at: str
    public_uuid: None
    points_of_interest: None
