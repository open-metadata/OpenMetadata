#  Copyright 2024 Collate
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
Define constraints helper methods useful for the metadata ingestion
"""

from typing import Dict, List

from metadata.generated.schema.entity.data.table import (
    Column,
    ConstraintType,
    RelationshipType,
)
from metadata.ingestion.ometa.utils import model_str


def _is_column_unique(column: Dict, columns: List[Column]) -> bool:
    """
    Method to check if the column in unique in the table
    """
    if column and len(column) > 0:
        constrained_column = column[0]
        for col in columns or []:
            if model_str(col.name) == constrained_column:
                if col.constraint and col.constraint.value in {
                    ConstraintType.UNIQUE.value,
                    ConstraintType.PRIMARY_KEY.value,
                }:
                    return True
                break
    return False


def get_relationship_type(
    column: Dict, referred_table_columns: List[Column], columns: List[Column]
) -> str:
    """
    Determine the type of relationship (one-to-one, one-to-many, etc.)
    """
    # Check if the column is unique in the current table
    is_unique_in_current_table = _is_column_unique(
        column.get("constrained_columns"), columns
    )

    # Check if the referred column is unique in the referred table
    is_unique_in_referred_table = _is_column_unique(
        column.get("referred_columns"), referred_table_columns
    )

    if is_unique_in_current_table and is_unique_in_referred_table:
        return RelationshipType.ONE_TO_ONE
    if is_unique_in_current_table:
        return RelationshipType.ONE_TO_MANY
    if is_unique_in_referred_table:
        return RelationshipType.MANY_TO_ONE
    return RelationshipType.MANY_TO_MANY
