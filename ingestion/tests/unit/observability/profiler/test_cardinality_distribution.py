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

"""Tests for exact low-cardinality distributions."""

from collections.abc import Callable

import pandas as pd
import pytest
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Session

from metadata.profiler.metrics.hybrid.cardinality_distribution import (
    CardinalityDistribution,
)
from metadata.profiler.metrics.static.count import Count
from metadata.profiler.metrics.static.distinct_count import DistinctCount


class Base(DeclarativeBase):
    """Test-only declarative base."""


class CategoryRow(Base):
    """A categorical value profiled by both implementations."""

    __tablename__ = "category_rows"

    id = Column(Integer, primary_key=True)
    category = Column(String(64), nullable=False)


def category_values(distinct_count: int) -> list[str]:
    frequent = [f"frequent-{index}" for index in range(5) for _ in range(20)]
    rare = [f"rare-{index}" for index in range(distinct_count - 5)]
    return frequent + rare


def sqlalchemy_distribution(values: list[str]) -> dict:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add_all(CategoryRow(category=value) for value in values)
        session.commit()
        result = CardinalityDistribution(CategoryRow.category).fn(
            CategoryRow,
            {
                Count.name(): len(values),
                DistinctCount.name(): len(set(values)),
            },
            session,
        )
    engine.dispose()
    assert result is not None
    return result


def pandas_distribution(values: list[str]) -> dict:
    result = CardinalityDistribution(CategoryRow.category).df_fn(
        {
            Count.name(): len(values),
            DistinctCount.name(): len(set(values)),
        },
        dfs=[pd.DataFrame({"category": values})],
    )
    assert result is not None
    return result


@pytest.mark.parametrize(
    "compute_distribution",
    [sqlalchemy_distribution, pandas_distribution],
    ids=["sqlalchemy", "pandas"],
)
def test_preserves_every_category_at_exact_value_limit(
    compute_distribution: Callable[[list[str]], dict],
) -> None:
    values = category_values(20)

    distribution = compute_distribution(values)

    assert "Others" not in distribution["categories"]
    assert set(distribution["categories"]) == set(values)
    assert sum(distribution["counts"]) == len(values)


@pytest.mark.parametrize(
    "compute_distribution",
    [sqlalchemy_distribution, pandas_distribution],
    ids=["sqlalchemy", "pandas"],
)
def test_keeps_others_bucket_above_exact_value_limit(
    compute_distribution: Callable[[list[str]], dict],
) -> None:
    values = category_values(21)

    distribution = compute_distribution(values)

    assert "Others" in distribution["categories"]
    assert len(distribution["categories"]) < len(set(values))
    assert sum(distribution["counts"]) == len(values)
