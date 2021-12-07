#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import collections
from typing import Callable, Iterable, Tuple, TypeVar

T = TypeVar("T")
K = TypeVar("K")


def group_by(
    iterable: Iterable[T], key: Callable[[T], K]
) -> Iterable[Tuple[K, Iterable[T]]]:

    values = collections.defaultdict(list)
    for v in iterable:
        values[key(v)].append(v)
    return values.items()
