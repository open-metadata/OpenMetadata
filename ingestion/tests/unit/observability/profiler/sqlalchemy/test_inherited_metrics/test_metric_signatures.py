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
Test that database-specific metric overrides accept the same arguments as their
parent's _compute_sqa_fn. A signature mismatch would cause a runtime TypeError
when the parent's fn() calls _compute_sqa_fn with arguments the child doesn't expect.
"""

from typing import List, Tuple, Type
from unittest.mock import MagicMock

import pytest

from metadata.profiler.metrics.window.first_quartile import FirstQuartile
from metadata.profiler.metrics.window.median import Median
from metadata.profiler.metrics.window.third_quartile import ThirdQuartile
from metadata.profiler.source.database.mariadb.metrics.window.first_quartile import (
    MariaDBFirstQuartile,
)
from metadata.profiler.source.database.mariadb.metrics.window.median import (
    MariaDBMedian,
)
from metadata.profiler.source.database.mariadb.metrics.window.third_quartile import (
    MariaDBThirdQuartile,
)
from metadata.profiler.source.database.single_store.metrics.window.first_quartile import (
    SingleStoreFirstQuartile,
)
from metadata.profiler.source.database.single_store.metrics.window.median import (
    SingleStoreMedian,
)
from metadata.profiler.source.database.single_store.metrics.window.third_quartile import (
    SingleStoreThirdQuartile,
)

CHILD_PARENT_PAIRS: List[Tuple[Type, Type]] = [
    (MariaDBFirstQuartile, FirstQuartile),
    (MariaDBMedian, Median),
    (MariaDBThirdQuartile, ThirdQuartile),
    (SingleStoreFirstQuartile, FirstQuartile),
    (SingleStoreMedian, Median),
    (SingleStoreThirdQuartile, ThirdQuartile),
]


@pytest.mark.parametrize(
    "child_cls,parent_cls",
    CHILD_PARENT_PAIRS,
    ids=[c.__name__ for c, _ in CHILD_PARENT_PAIRS],
)
def test_child_is_subclass_of_parent(child_cls, parent_cls):
    """Each database-specific metric must be a proper subclass of the base metric."""
    assert issubclass(child_cls, parent_cls)


@pytest.mark.parametrize(
    "child_cls",
    [c for c, _ in CHILD_PARENT_PAIRS],
    ids=[c.__name__ for c, _ in CHILD_PARENT_PAIRS],
)
def test_compute_sqa_fn_accepts_parent_args(child_cls):
    """Child _compute_sqa_fn must accept all arguments the parent fn() passes.

    The parent Median.fn() passes dimension_col as a keyword argument.
    If a child override drops that parameter, the call would raise TypeError at runtime.
    """
    instance = child_cls.__new__(child_cls)
    col = MagicMock()
    result = instance._compute_sqa_fn(col, "test_table", 0.5, dimension_col="dim_col")
    assert result is not None
