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
Redshift models
"""
import re
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel

TableName = str
SchemaName = str


class RedshiftStoredProcedure(BaseModel):
    """Redshift stored procedure list query results"""

    name: str
    owner: Optional[str] = None
    definition: str


class RedshiftTableChangeQueryRegex(BaseModel):
    """Redshift Table Change Query Regex Model. Used for Incremental Extraction."""

    regex: re.Pattern
    deleted: bool


class RedshiftTable(BaseModel):
    """Redshift Simplified Table Model. Used for Incremental Extraction."""

    name: str
    deleted: bool


class RedshiftTableMap(BaseModel):
    """Redshift TableMap Model. Used for Incremental Extraction"""

    table_map: Dict[SchemaName, Dict[TableName, RedshiftTable]]

    @classmethod
    def default(cls) -> "RedshiftTableMap":
        """Creates a new RedshiftTableMap with an Empty dict."""
        return cls(table_map={})

    def update(self, schema: SchemaName, table: RedshiftTable):
        """Updates the Redshift Table Map.

        If the table is already registered in the map, it does nothing.
        This relies on the processing of the table being ordered by latest changes first.
        """
        if schema not in self.table_map:
            self.table_map[schema] = {table.name: table}
        else:
            if table.name not in self.table_map[schema]:
                self.table_map[schema][table.name] = table

    def get_deleted(
        self, schema_name: Optional[SchemaName] = None
    ) -> List[Tuple[SchemaName, TableName]]:
        """Returns all deleted table names for a given schema."""
        if schema_name:
            return [
                (schema_name, table.name)
                for table in self.table_map.get(schema_name, {}).values()
                if table.deleted
            ]

        deleted_tables = []

        for schema_name in self.table_map:
            deleted_tables.extend(
                [
                    (schema_name, table.name)
                    for table in self.table_map.get(schema_name, {}).values()
                    if table.deleted
                ]
            )

        return deleted_tables

    def get_not_deleted(self, schema_name: SchemaName) -> List[TableName]:
        """Returns all not deleted table names for a given schema."""
        return [
            table.name
            for table in self.table_map.get(schema_name, {}).values()
            if not table.deleted
        ]
