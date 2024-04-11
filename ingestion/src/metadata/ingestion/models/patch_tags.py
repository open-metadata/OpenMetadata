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
Custom models for tags
"""
from typing import List, Optional, Type

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.models import Entity
from metadata.ingestion.models.table_metadata import ColumnTag


class OMetaGlossariesAndTiersData(BaseModel):
    entity: Optional[Type[Entity]]
    tag_labels: Optional[List[TagLabel]]
    table: Optional[Table]
    column_tags: Optional[List[ColumnTag]]
