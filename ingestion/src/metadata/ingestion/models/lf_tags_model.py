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
Custom models for LF tags
"""
from typing import List, Optional

from pydantic import BaseModel


class TagItem(BaseModel):
    CatalogId: str
    TagKey: str
    TagValues: List[str]


class LFTagsOnColumnsItem(BaseModel):
    Name: str
    LFTags: List[TagItem]


class LFTags(BaseModel):
    LFTagOnDatabase: Optional[List[TagItem]] = None
    LFTagsOnTable: Optional[List[TagItem]] = None
    LFTagsOnColumns: Optional[List[LFTagsOnColumnsItem]] = None
