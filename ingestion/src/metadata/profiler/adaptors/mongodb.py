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
MongoDB adaptor for the NoSQL profiler.
"""
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, TYPE_CHECKING

from pymongo import MongoClient

from metadata.generated.schema.entity.data.table import Column, Table
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor

if TYPE_CHECKING:
    from pymongo import MongoClient
else:
    MongoClient = None  # pylint: disable=invalid-name


@dataclass
class Query:
    database: str
    collection: str
    filter: dict = field(default_factory=dict)
    limit: Optional[int] = None

    def to_executable(self, client: MongoClient):
        db = client[self.database]
        collection = db[self.collection]
        query = collection.find(self.filter)
        if self.limit:
            query = query.limit(self.limit)
        return query


class MongoDB(NoSQLAdaptor):
    """A MongoDB client that serves as an adaptor for profiling data assets on MongoDB"""

    def __init__(self, client: MongoClient):
        self.client = client

    def item_count(self, table: Table) -> int:
        db = self.client[table.databaseSchema.name]
        collection = db[table.name.__root__]
        return collection.count_documents({})

    def scan(
        self, table: Table, columns: List[Column], limit: int
    ) -> List[Dict[str, any]]:
        return self.execute(
            Query(
                database=table.databaseSchema.name,
                collection=table.name.__root__,
                limit=limit,
            )
        )

    def query(
        self, table: Table, columns: List[Column], query: any, limit: int
    ) -> List[Dict[str, any]]:
        try:
            json_query = json.loads(query)
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON query")
        return self.execute(
            Query(
                database=table.databaseSchema.name,
                collection=table.name.__root__,
                filter=json_query,
            )
        )

    def execute(self, query: Query) -> List[Dict[str, any]]:
        records = list(query.to_executable(self.client))
        result = []
        for r in records:
            result.append({c: self._json_safe(r.get(c)) for c in r})
        return result

    @staticmethod
    def _json_safe(data: any):
        try:
            json.dumps(data)
            return data
        except Exception:
            return str(data)
