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
Table related pydantic definitions
"""
from typing import Dict, List, Optional

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Table, TableConstraint


class DeleteTable(BaseModel):
    """
    Entity Reference of a table to be deleted
    """

    table: Table
    mark_deleted_tables: Optional[bool] = False


class OMetaTableConstraints(BaseModel):
    """
    Model to club table with its constraints
    """

    table_id: str
    foreign_constraints: Optional[List[Dict]]
    constraints: Optional[List[TableConstraint]]
