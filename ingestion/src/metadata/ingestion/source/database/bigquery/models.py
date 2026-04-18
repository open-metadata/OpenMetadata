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
BigQuery models
"""
from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from metadata.generated.schema.entity.data.storedProcedure import Language
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

TableName = str
SchemaName = str

STORED_PROC_LANGUAGE_MAP = {
    "SQL": Language.SQL,
    "JAVASCRIPT": Language.JavaScript,
}


class BigQueryStoredProcedure(BaseModel):
    """BigQuery Stored Procedure list query results"""

    name: str
    definition: str
    language: Optional[str] = Field(
        None, description="Will only be informed for non-SQL routines."
    )


class BigQueryTable(BaseModel):
    name: TableName
    timestamp: datetime
    deleted: bool


class BigQueryTableMap:
    """Tracks changed tables per schema using minimal memory.

    Stores only table_name -> is_deleted (bool) per schema instead of full
    Pydantic models. With 100K+ tables, this saves ~50MB vs storing
    BigQueryTable objects.
    """

    __slots__ = ("_table_map",)

    def __init__(self):
        self._table_map: Dict[SchemaName, Dict[TableName, bool]] = {}

    def update(self, schema_name: SchemaName, table_name: TableName, deleted: bool):
        """Add a single table entry. First-seen wins (entries ordered DESC by time)."""
        schema_tables = self._table_map.get(schema_name)
        if schema_tables is None:
            self._table_map[schema_name] = {table_name: deleted}
        elif table_name not in schema_tables:
            schema_tables[table_name] = deleted

    def get_deleted(self, schema_name: SchemaName) -> List[TableName]:
        return [
            name
            for name, deleted in self._table_map.get(schema_name, {}).items()
            if deleted
        ]

    def get_all_deleted(self) -> Dict[SchemaName, List[TableName]]:
        result = {}
        for schema in self._table_map:
            deleted = self.get_deleted(schema)
            if deleted:
                result[schema] = deleted
        return result

    def get_not_deleted(self, schema_name: SchemaName) -> List[TableName]:
        return [
            name
            for name, deleted in self._table_map.get(schema_name, {}).items()
            if not deleted
        ]
