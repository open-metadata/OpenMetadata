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

"""
LRU cache
"""

import threading
from collections import OrderedDict
from typing import Callable, Generic, TypeVar

LRU_CACHE_SIZE = 4096

T = TypeVar("T")


class LRUCache(Generic[T]):
    """Least Recently Used cache"""

    def __init__(self, capacity: int) -> None:
        self._cache = OrderedDict()
        self.capacity = capacity
        self.lock = threading.Lock()

    def clear(self):
        with self.lock:
            self._cache = OrderedDict()

    def get(self, key) -> T:
        with self.lock:
            self._cache.move_to_end(key)
            return self._cache[key]

    def put(self, key: str, value: T) -> None:
        with self.lock:
            self._cache[key] = value
            self._cache.move_to_end(key)
            if len(self._cache) > self.capacity:
                self._cache.popitem(last=False)

    def __contains__(self, key) -> bool:
        with self.lock:
            if key not in self._cache:
                return False
            self._cache.move_to_end(key)
            return True

    def __len__(self) -> int:
        with self.lock:
            return len(self._cache)

    def wrap(self, key_func: Callable[..., str]):
        def wrapper(func: Callable[..., T]):
            def wrapped(*args, **kwargs) -> T:
                key = key_func(*args, **kwargs)
                if key in self:
                    return self.get(key)
                value = func(*args, **kwargs)
                self.put(key, value)
                return value

            return wrapped

        return wrapper
