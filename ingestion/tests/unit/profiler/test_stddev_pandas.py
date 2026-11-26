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
Test the pandas computation of the StdDev metric
"""

import numpy as np
import pandas as pd
import pytest
from sqlalchemy import BigInteger, Column, Numeric

from metadata.profiler.metrics.static.stddev import StdDev, SumSumSquaresCount


def _pandas_stddev(metric, chunks):
    computation = metric.get_pandas_computation()
    accumulator = computation.create_accumulator()
    for chunk in chunks:
        accumulator = computation.update_accumulator(accumulator, chunk)
    return computation.aggregate_accumulator(accumulator)


def _population_stddev(values):
    # Shift by the first value so float64 keeps every digit of the spread.
    return float(np.std(np.array(values, dtype=np.float64) - values[0]))


@pytest.mark.parametrize(
    "values",
    [
        # Squares overflow int64 (values above ~3.04e9).
        [3_100_000_000, 3_100_000_002],
        # Epoch milliseconds stored as BIGINT (#38377).
        [1_700_000_000_000 + i for i in range(1000)],
        # Small values, unchanged behaviour.
        [1, 2, 3, 4],
    ],
)
def test_stddev_of_large_integers_is_exact(values):
    """The sum of squares of an integer column must not wrap around or lose digits"""
    metric = StdDev(Column("value", BigInteger()))
    half = len(values) // 2
    chunks = [pd.DataFrame({"value": values[:half]}), pd.DataFrame({"value": values[half:]})]

    assert _pandas_stddev(metric, chunks) == pytest.approx(_population_stddev(values), rel=1e-12)


def test_stddev_of_decimal_column():
    metric = StdDev(Column("value", Numeric()))

    assert _pandas_stddev(metric, [pd.DataFrame({"value": [1.5, 2.5, None]})]) == pytest.approx(0.5)


def test_aggregate_accumulator_of_summed_integer_groups():
    """Integer statistics summed across groups (the dimensional "Others" bucket) stay exact"""
    first = [1_700_000_000_000 + i for i in range(10)]
    second = [1_700_000_000_000 + i for i in range(10, 20)]
    accumulator = SumSumSquaresCount(
        sum_value=sum(first) + sum(second),
        sum_squares_value=sum(v * v for v in first) + sum(v * v for v in second),
        count_value=len(first) + len(second),
    )

    assert StdDev.aggregate_accumulator(accumulator) == pytest.approx(_population_stddev(first + second), rel=1e-12)


def test_stddev_of_large_unsigned_integers():
    """uint64 values above the int64 range must not wrap when they are summed"""
    values = [2**63 + 1, 2**63 + 3]
    metric = StdDev(Column("value", BigInteger()))
    chunks = [pd.DataFrame({"value": pd.Series(values, dtype="uint64")})]

    assert _pandas_stddev(metric, chunks) == pytest.approx(1.0)


def test_aggregate_accumulator_returns_none_for_wrapped_integer_sums():
    """Integer sums that already wrapped around in int64 give no stddev instead of raising"""
    accumulator = SumSumSquaresCount(
        sum_value=10,
        sum_squares_value=-(2**62),
        count_value=5,
    )

    assert StdDev.aggregate_accumulator(accumulator) is None
