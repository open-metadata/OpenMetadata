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

from collections import OrderedDict


class LRUCache:
    """Least Recently Used cache"""

    def __init__(self, capacity: int) -> None:
        self._cache = OrderedDict()
        self.capacity = capacity

    def get(self, key):
        """
        Returns the value associated to `key` if it exists,
        updating the cache usage.
        Raises `KeyError` if `key doesn't exist in the cache.
        """
        self._cache.move_to_end(key)
        return self._cache[key]

    def put(self, key, value) -> None:
        """
        Assigns `value` to `key`, overwriting `key` if it already exists
        in the cache and updating the cache usage.
        If the size of the cache grows above capacity, pops the least used
        element.
        """
        self._cache[key] = value
        self._cache.move_to_end(key)
        if len(self._cache) > self.capacity:
            self._cache.popitem(last=False)

    def __contains__(self, key) -> bool:
        if key not in self._cache:
            return False
        self._cache.move_to_end(key)
        return True

    def __len__(self) -> int:
        return len(self._cache)
