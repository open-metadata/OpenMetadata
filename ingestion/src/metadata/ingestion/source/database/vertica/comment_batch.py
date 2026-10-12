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
Table and column comments of a bounded batch of Vertica tables.

Resolving column comments with a per-table join on v_catalog.comments dominates
Vertica ingestion time (issue #29429), while fetching every comment of a schema or
database up front holds an unbounded amount of them in memory. The source instead
fetches the comments of one batch of tables with a single query, processes those
tables, and releases the batch before loading the next one.
"""

from collections.abc import Iterable, Iterator
from dataclasses import dataclass, field
from itertools import islice
from typing import TypeVar

from sqlalchemy import bindparam, text

from metadata.ingestion.source.database.vertica.queries import VERTICA_BATCH_COMMENTS

COMMENT_BATCH_SIZE = 1_000

TABLE_OBJECT_TYPE = "TABLE"
COLUMN_OBJECT_TYPE = "COLUMN"

T = TypeVar("T")


def batched(items: Iterable[T], size: int) -> Iterator[list[T]]:
    """itertools.batched, which only exists from Python 3.12."""
    iterator = iter(items)
    while batch := list(islice(iterator, size)):
        yield batch


@dataclass(frozen=True)
class CommentBatch:
    """
    Comments of the tables of one batch, keyed by the catalog names exactly as the
    per-table join matched them.
    """

    schema_name: str
    table_names: frozenset[str]
    table_comments: dict[str, str] = field(default_factory=dict)
    column_comments: dict[tuple[str, str], str] = field(default_factory=dict)

    def covers(self, schema_name: str, table_name: str) -> bool:
        return schema_name == self.schema_name and table_name in self.table_names

    def table_comment(self, table_name: str) -> str | None:
        return self.table_comments.get(table_name)

    def column_comment(self, table_name: str, column_name: str) -> str | None:
        return self.column_comments.get((table_name, column_name))


def fetch_comment_batch(connection, schema_name: str, table_names: list[str]) -> CommentBatch:
    """Fetch the table and column comments of ``table_names`` with a single query."""
    statement = text(VERTICA_BATCH_COMMENTS).bindparams(bindparam("tables", expanding=True))
    table_comments: dict[str, str] = {}
    column_comments: dict[tuple[str, str], str] = {}
    for row in connection.execute(statement, {"schema": schema_name, "tables": table_names}):
        if row.object_type == COLUMN_OBJECT_TYPE:
            column_comments[(row.table_name, row.column_name)] = row.comment
        elif row.object_type == TABLE_OBJECT_TYPE:
            table_comments[row.table_name] = row.comment
    return CommentBatch(
        schema_name=schema_name,
        table_names=frozenset(table_names),
        table_comments=table_comments,
        column_comments=column_comments,
    )
