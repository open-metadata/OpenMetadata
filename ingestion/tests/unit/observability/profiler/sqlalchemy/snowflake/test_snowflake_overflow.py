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
Snowflake overflow fallback must drop sum/mean/stddev even when the injected
metric registry swaps in subclasses (e.g. Collate's CollateSum).
"""

from unittest.mock import MagicMock

import pytest
from sqlalchemy import Column, Integer
from sqlalchemy.exc import ProgrammingError

from metadata.profiler.interface.sqlalchemy.snowflake.profiler_interface import (
    SnowflakeProfilerInterface,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.metrics.static.mean import Mean
from metadata.profiler.metrics.static.stddev import StdDev
from metadata.profiler.metrics.static.sum import Sum


class RegistrySum(Sum):
    pass


class RegistryStdDev(StdDev):
    pass


class RegistryMean(Mean):
    pass


OVERFLOW = ProgrammingError("SELECT ...", {}, MagicMock(errno=100046))


@pytest.mark.parametrize(
    "aggregates",
    [(Sum, StdDev, Mean), (RegistrySum, RegistryStdDev, RegistryMean)],
    ids=["oss-registry", "subclassed-registry"],
)
def test_overflow_retry_drops_sum_mean_stddev(aggregates):
    column = Column("big_number", Integer)
    metrics = [*aggregates, Metrics.min.value, Metrics.max.value, Metrics.nullCount.value]

    def select_first(*entities):
        if any(entity.name == Sum.name() for entity in entities):
            raise OVERFLOW
        return MagicMock(_asdict=lambda: {entity.name: 1 for entity in entities})

    runner = MagicMock(table_name="NTE")
    runner.select_first_from_sample.side_effect = select_first
    session = MagicMock()
    session.get_bind.return_value.dialect.name = "snowflake"

    interface = SnowflakeProfilerInterface.__new__(SnowflakeProfilerInterface)
    row = interface._compute_static_metrics(metrics, runner, column, session)

    assert row == {Metrics.min.name: 1, Metrics.max.name: 1, Metrics.nullCount.name: 1}
