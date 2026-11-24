#  Copyright 2024 Collate
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
Define constraints helper methods useful for the metadata ingestion
"""

from metadata.generated.schema.entity.data.table import (
    Column,
    ConstraintType,
    RelationshipType,
)
from metadata.ingestion.ometa.utils import model_str


def _is_column_unique(column: dict, columns: list[Column]) -> bool:
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


def resolve_column_names(column_names: list[str], columns: list[Column]) -> list[str] | None:
    """
    Map column names reported by the source to the names stored for the table.

    Sources with case-insensitive identifiers can report a name in a different case than the
    column was created with (MySQL keeps a foreign key's referenced column as written in the
    FK definition), while the server matches column names case-sensitively. An exact match
    wins, then a single case-insensitive match. Returns None if any name matches no column
    or several.
    """
    stored_names = [model_str(col.name) for col in columns or []]
    resolved = []
    for name in column_names:
        if name in stored_names:
            resolved.append(name)
            continue
        case_insensitive_matches = [stored for stored in stored_names if stored.lower() == name.lower()]
        if len(case_insensitive_matches) != 1:
            return None
        resolved.append(case_insensitive_matches[0])
    return resolved


def get_relationship_type(column: dict, referred_table_columns: list[Column], columns: list[Column]) -> str:
    """
    Determine the type of relationship (one-to-one, one-to-many, etc.)
    """
    # Check if the column is unique in the current table
    is_unique_in_current_table = _is_column_unique(column.get("constrained_columns"), columns)

    # Check if the referred column is unique in the referred table
    is_unique_in_referred_table = _is_column_unique(column.get("referred_columns"), referred_table_columns)

    if is_unique_in_current_table and is_unique_in_referred_table:
        return RelationshipType.ONE_TO_ONE
    if is_unique_in_current_table:
        return RelationshipType.ONE_TO_MANY
    if is_unique_in_referred_table:
        return RelationshipType.MANY_TO_ONE
    return RelationshipType.MANY_TO_MANY
