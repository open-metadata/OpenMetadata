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

import json
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


def test_normalize_aggregate_value_decimal128_overflow_to_none():
    """A finite Decimal128 beyond the float64 range normalizes to None, not inf."""
    assert MongoDB._normalize_aggregate_value(Decimal128("1E+400")) is None
    assert MongoDB._normalize_aggregate_value(Decimal128("-1E+400")) is None


def test_normalize_aggregate_value_nonfinite_float_passthrough_to_none():
    """A non-finite Python float (e.g. a stored BSON double inf/nan) normalizes to None."""
    assert MongoDB._normalize_aggregate_value(float("inf")) is None
    assert MongoDB._normalize_aggregate_value(float("-inf")) is None
    assert MongoDB._normalize_aggregate_value(float("nan")) is None


def test_get_aggregates_decimal128_overflow_serializes_to_valid_json():
    """An over-range Decimal128 aggregate does not break the table-profile publish.

    Reproduces issue #36947's failure class: a finite Decimal128 whose magnitude
    exceeds the float64 range used to convert to ``inf``, which ``json.dumps``
    serializes as the non-standard ``Infinity`` token that the OpenMetadata
    server's strict Jackson mapper rejects, dropping the whole collection's
    profile. After the fix the aggregate normalizes to None and the serialized
    ColumnProfile is standard-compliant JSON.
    """

    def raise_on_non_standard(value: str) -> float:
        raise ValueError(f"non-standard JSON token: {value}")

    client = MagicMock()
    client["analytics"]["events"].aggregate.return_value = [
        {
            "_id": None,
            "min": Decimal128("1E+400"),
            "max": Decimal128("-1E+400"),
            "sum": Decimal128("1E+400"),
            "mean": Decimal128("1E+400"),
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

    assert result == {"min": None, "max": None, "sum": None, "mean": None}

    profile = ColumnProfile(
        name="amount",
        timestamp=1700000000000,
        **result,
    )
    payload = profile.model_dump_json(exclude_unset=True, exclude_none=True)

    assert "Infinity" not in payload
    assert "NaN" not in payload
    parsed = json.loads(payload, parse_constant=raise_on_non_standard)
    assert parsed["name"] == "amount"


def test_get_aggregates_nonfinite_bson_double_serializes_to_valid_json():
    """A non-finite BSON double does not break the table-profile publish.

    A stored ``inf``/``nan`` BSON double returned by ``$min``/``$max`` used to
    pass straight through the float branch; after the fix it normalizes to None.
    """

    def raise_on_non_standard(value: str) -> float:
        raise ValueError(f"non-standard JSON token: {value}")

    client = MagicMock()
    client["analytics"]["events"].aggregate.return_value = [
        {
            "_id": None,
            "min": float("-inf"),
            "max": float("inf"),
            "sum": float("nan"),
            "mean": float("inf"),
        }
    ]

    adaptor = MongoDB(client)
    table = _make_table()
    column = SQALikeColumn(name="amount", type=DataType.FLOAT)

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

    assert result == {"min": None, "max": None, "sum": None, "mean": None}

    profile = ColumnProfile(
        name="amount",
        timestamp=1700000000000,
        **result,
    )
    payload = profile.model_dump_json(exclude_unset=True, exclude_none=True)

    assert "Infinity" not in payload
    assert "NaN" not in payload
    json.loads(payload, parse_constant=raise_on_non_standard)
