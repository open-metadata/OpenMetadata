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
Defines the needed protocol for a Metric to support pandas
"""

from dataclasses import dataclass
from typing import (
    TYPE_CHECKING,
    Callable,
    Generic,
    Protocol,
    TypeVar,
    runtime_checkable,
)

if TYPE_CHECKING:
    import pandas as pd

T = TypeVar("T")
R = TypeVar("R")


@dataclass(frozen=True)
class PandasComputation(Generic[T, R]):
    """Defines how to compute a metric using accumulation pattern.
    Three-step computation:
    1. create_accumulator: () -> T
        Initializes empty accumulator (mutable container or scalar)
    2. update_accumulator: (T, DataFrame) -> T
        Update accumulator with chunk data, returns updated accumulator
        For mutable types (Counter, list, set): mutate and return self
        For immutable types (int, float): return new value
    3. aggregate_accumulator: (T) -> R
        Aggregate accumulated state to compute the metric final result

    """

    create_accumulator: Callable[[], T]
    update_accumulator: Callable[[T, "pd.DataFrame"], T]
    aggregate_accumulator: Callable[[T], R]


@runtime_checkable
class SupportsPandasComputation(Protocol[T, R]):
    """Protocol for pandas computation support"""

    def get_pandas_computation(self) -> PandasComputation[T, R]:
        """Return Pandas Computation Definition"""
        ...
