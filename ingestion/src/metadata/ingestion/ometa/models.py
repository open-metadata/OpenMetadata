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
"""Pydantic models for ometa client API"""

from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class EntityList(BaseModel, Generic[T]):
    """
    Pydantic Entity list model

    Attributes
        entities (List): list of entities
        total (int): total size of the response
        after (str): after token for pagination
    """

    entities: List[T]
    total: int
    after: Optional[str] = None
    before: Optional[str] = None
