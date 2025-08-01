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
MongoDB adaptor for the NoSQL profiler.
"""
import json
from enum import Enum
from typing import TYPE_CHECKING, Dict, List, Optional, Union

from pydantic import BaseModel, Field

from metadata.generated.schema.entity.data.table import Column, Table
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor
from metadata.utils.sqa_like_column import SQALikeColumn

# pylint: disable=invalid-name
if TYPE_CHECKING:
    from pymongo import MongoClient
    from pymongo.command_cursor import CommandCursor
    from pymongo.cursor import Cursor
else:
    MongoClient = None
    CommandCursor = None
    Cursor = None


class AggregationFunction(Enum):
    SUM = "$sum"
    MEAN = "$avg"
    COUNT = "$count"
    MAX = "$max"
    MIN = "$min"


class Executable(BaseModel):
    def to_executable(self, client: MongoClient) -> Union[CommandCursor, Cursor]:
        raise NotImplementedError


class Query(Executable):
    database: str
    collection: str
    filter: dict = Field(default_factory=dict)
    limit: Optional[int] = None

    def to_executable(self, client: MongoClient) -> Cursor:
        db = client[self.database]
        collection = db[self.collection]
        query = collection.find(self.filter)
        if self.limit:
            query = query.limit(self.limit)
        return query


class Aggregation(Executable):
    database: str
    collection: str
    column: str
    aggregations: List[AggregationFunction]

    def to_executable(self, client: MongoClient) -> CommandCursor:
        db = client[self.database]
        collection = db[self.collection]
        return collection.aggregate(
            [
                {
                    "$group": {
                        "_id": None,
                        **{
                            a.name.lower(): {a.value: f"${self.column}"}
                            for a in self.aggregations
                        },
                    }
                }
            ]
        )


class MongoDB(NoSQLAdaptor):
    """A MongoDB client that serves as an adaptor for profiling data assets on MongoDB"""

    def __init__(self, client: MongoClient):
        self.client = client

    def item_count(self, table: Table) -> int:
        db = self.client[table.databaseSchema.name]
        collection = db[table.name.root]
        return collection.count_documents({})

    def scan(
        self, table: Table, columns: List[Column], limit: int
    ) -> List[Dict[str, any]]:
        return self.execute(
            Query(
                database=table.databaseSchema.name,
                collection=table.name.root,
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
                collection=table.name.root,
                filter=json_query,
            )
        )

    def get_aggregates(
        self,
        table: Table,
        column: SQALikeColumn,
        aggregate_functions: List[AggregationFunction],
    ) -> Dict[str, Union[int, float]]:
        """
        Get the aggregate functions for a column in a table
        Returns:
            Dict[str, Union[int, float]]: A dictionary of the aggregate functions
            Example:
            {
                "sum": 100,
                "avg": 50,
                "count": 2,
                "max": 75,
                "min": 25
            }
        """
        row = self.execute(
            Aggregation(
                database=table.databaseSchema.name,
                collection=table.name.root,
                column=column.name,
                aggregations=aggregate_functions,
            )
        )[0]
        return {k: v for k, v in row.items() if k != "_id"}

    def sum(self, table: Table, column: SQALikeColumn) -> AggregationFunction:
        return AggregationFunction.SUM

    def mean(self, table: Table, column: SQALikeColumn) -> AggregationFunction:
        return AggregationFunction.MEAN

    def max(self, table: Table, column: SQALikeColumn) -> AggregationFunction:
        return AggregationFunction.MAX

    def min(self, table: Table, column: SQALikeColumn) -> AggregationFunction:
        return AggregationFunction.MIN

    def execute(self, query: Executable) -> List[Dict[str, any]]:
        return list(query.to_executable(self.client))
