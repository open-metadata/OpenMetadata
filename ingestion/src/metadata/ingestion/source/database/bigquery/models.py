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


class BigQueryTableMap(BaseModel):
    table_map: Dict[SchemaName, Dict[TableName, BigQueryTable]]

    def add(self, schema_name: SchemaName, table_map: Dict[TableName, BigQueryTable]):
        """Adds a new schema table map."""
        self.table_map[schema_name] = table_map

    def get_deleted(self, schema_name: SchemaName) -> List[TableName]:
        """Returns all deleted table names for a given schema."""
        return [
            table.name
            for table in self.table_map.get(schema_name, {}).values()
            if table.deleted
        ]

    def get_not_deleted(self, schema_name: SchemaName) -> List[TableName]:
        """Returns all not deleted table names for a given schema."""
        return [
            table.name
            for table in self.table_map.get(schema_name, {}).values()
            if not table.deleted
        ]
