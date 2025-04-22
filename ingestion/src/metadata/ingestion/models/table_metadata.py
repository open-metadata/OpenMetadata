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
Table related pydantic definitions
"""
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from metadata.generated.schema.entity.data.table import Table, TableConstraint
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.tagLabel import TagLabel


class OMetaTableConstraints(BaseModel):
    """
    Model to club table with its constraints
    """

    table: Table
    foreign_constraints: Optional[List[Dict]] = None
    constraints: Optional[List[TableConstraint]] = None


class ColumnTag(BaseModel):
    """Column FQN and Tag Label information"""

    column_fqn: str
    tag_label: TagLabel


class ColumnDescription(BaseModel):
    """Column FQN and description information"""

    column_fqn: str
    description: Optional[basic.Markdown] = Field(
        None, description="Description of a column."
    )
