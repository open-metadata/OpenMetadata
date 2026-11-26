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
"""BigQuery daily shard naming and bounded family inventory."""

import re
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime

from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.type.tableExecutionSource import TableExecutionSource
from metadata.generated.schema.type.tableSharding import SuffixFormat, TableSharding

MAX_FAMILIES = 10_000


def parse_shard_name(name: str) -> tuple[str, date] | None:
    """Return the exact prefix and calendar date for a native daily shard name."""
    match = re.fullmatch(r"(?P<prefix>.*[^0-9])?(?P<suffix>[0-9]{8})", name) if "$" not in name else None
    if not match:
        return None
    try:
        shard_date = datetime.strptime(match["suffix"], "%Y%m%d").date()
    except ValueError:
        return None
    return match["prefix"] or "", shard_date


def logical_shard_name(prefix: str) -> str:
    return f"{prefix}yyyymmdd"


def strip_partition_decorator(name: str) -> str:
    """Strip a daily partition decorator from an already parsed table identifier."""
    return re.sub(r"\$[0-9]{8}$", "", name)


def get_table_sharding(table: Table) -> TableSharding | None:
    return table.tableSharding if table.tableType == TableType.Sharded else None


def eligible_shard(name: str, table_type: str) -> tuple[str, date] | None:
    if table_type != "TABLE":
        return None
    return parse_shard_name(name)


@dataclass
class ShardFamily:
    prefix: str
    count: int
    first_date: date
    last_date: date
    representative: str

    def add(self, name: str, shard_date: date) -> None:
        self.count += 1
        self.first_date = min(self.first_date, shard_date)
        if shard_date > self.last_date:
            self.last_date = shard_date
            self.representative = name

    def descriptor(self, database: str, schema: str) -> TableSharding:
        return TableSharding(
            prefix=self.prefix,
            suffixFormat=SuffixFormat.YYYYMMDD,
            representative=TableExecutionSource(
                databaseName=database,
                schemaName=schema,
                tableName=self.representative,
                shardDate=self.last_date,
            ),
            shardCount=self.count,
            firstShardDate=self.first_date,
            lastShardDate=self.last_date,
        )


def inventory_families(tables: Iterable) -> dict[str, ShardFamily]:
    """Reduce a complete paginated inventory; fail before returning a partial inventory."""
    families: dict[str, ShardFamily] = {}
    for table in tables:
        parsed = eligible_shard(table.table_id, table.table_type)
        if parsed is None:
            continue
        prefix, shard_date = parsed
        if prefix in families:
            families[prefix].add(table.table_id, shard_date)
        else:
            if len(families) >= MAX_FAMILIES:
                raise ValueError("BigQuery dataset exceeds 10000 shard families; narrow dataset selection")
            families[prefix] = ShardFamily(prefix, 1, shard_date, shard_date, table.table_id)
    return families


@dataclass(frozen=True)
class DiscoveredTable:
    physical_name: str
    catalog_name: str
    table_type: TableType
    table_sharding: TableSharding | None = None
