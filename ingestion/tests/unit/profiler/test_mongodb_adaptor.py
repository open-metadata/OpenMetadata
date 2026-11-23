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
Unit tests for the MongoDB NoSQL profiler adaptor.
"""

from datetime import datetime
from unittest.mock import MagicMock
from uuid import uuid4

from bson import Decimal128, ObjectId

from metadata.generated.schema.entity.data.table import (
    Column as EntityColumn,
)
from metadata.generated.schema.entity.data.table import (
    ColumnName,
    ColumnProfile,
    DataType,
    Table,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.adaptors.mongodb import AggregationFunction, MongoDB
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.sqa_like_column import SQALikeColumn


def _make_table() -> Table:
    return Table(
        id=uuid4(),
        name="events",
        databaseSchema=EntityReference(
            id=uuid4(),
            name="analytics",
            type="databaseSchema",
        ),
        columns=[
            EntityColumn(
                name=ColumnName("ref_id"),
                dataType=DataType.INT,
            )
        ],
    )


def test_get_aggregates_converts_bson_objectid_for_column_profile():
    """BSON ObjectId returned by $max/$min is converted to str so ColumnProfile validates."""
    oid = ObjectId("6ab390a1a18f334597a476ff")
    client = MagicMock()
    client["analytics"]["events"].aggregate.return_value = [
        {"_id": None, "min": 10, "max": oid, "sum": 10, "mean": 10.0}
    ]

    adaptor = MongoDB(client)
    table = _make_table()
    column = SQALikeColumn(name="ref_id", type=DataType.INT)

    agg_functions = [
        metric(column).nosql_fn(adaptor)(table)
        for metric in (
            Metrics.min.value,
            Metrics.max.value,
            Metrics.sum.value,
            Metrics.mean.value,
        )
    ]
    result = adaptor.get_aggregates(table, column, agg_functions)

    assert result == {
        "min": 10,
        "max": "6ab390a1a18f334597a476ff",
        "sum": 10,
        "mean": 10.0,
    }

    profile = ColumnProfile(
        name="ref_id",
        timestamp=1700000000000,
        **result,
    )
    assert profile.min == 10
    assert profile.max == "6ab390a1a18f334597a476ff"
    assert profile.sum == 10.0
    assert profile.mean == 10.0


def test_get_aggregates_normalizes_decimal128_and_datetime():
    """Decimal128 values are converted to float (or None for NaN) and datetime is preserved."""
    now = datetime(2026, 5, 1, 12, 30, 0)
    client = MagicMock()
    client["analytics"]["events"].aggregate.return_value = [
        {
            "_id": None,
            "min": Decimal128("12.50"),
            "max": now,
            "sum": Decimal128("NaN"),
            "mean": None,
        }
    ]

    adaptor = MongoDB(client)
    table = _make_table()
    column = SQALikeColumn(name="amount", type=DataType.DECIMAL)

    result = adaptor.get_aggregates(
        table,
        column,
        [
            AggregationFunction.MIN,
            AggregationFunction.MAX,
            AggregationFunction.SUM,
            AggregationFunction.MEAN,
        ],
    )

    assert result == {
        "min": 12.5,
        "max": now,
        "sum": None,
        "mean": None,
    }

    profile = ColumnProfile(
        name="amount",
        timestamp=1700000000000,
        **result,
    )
    assert profile.min == 12.5
    assert profile.sum is None


def test_get_aggregates_empty_collection_returns_empty_dict():
    """An empty aggregation result returns an empty dict instead of raising IndexError."""
    client = MagicMock()
    client["analytics"]["events"].aggregate.return_value = []

    adaptor = MongoDB(client)
    table = _make_table()
    column = SQALikeColumn(name="ref_id", type=DataType.INT)

    assert adaptor.get_aggregates(table, column, [AggregationFunction.MAX]) == {}
