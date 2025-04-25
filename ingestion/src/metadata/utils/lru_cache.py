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
        """
        Returns the value associated to `key` if it exists,
        updating the cache usage.
        Raises `KeyError` if `key doesn't exist in the cache.

        Args:
            key: The key to get the value for

        Returns:
            The value associated to `key`
        """
        with self.lock:
            self._cache.move_to_end(key)
            return self._cache[key]

    def put(self, key: str, value: T) -> None:
        """
        Assigns `value` to `key`, overwriting `key` if it already exists
        in the cache and updating the cache usage.
        If the size of the cache grows above capacity, pops the least used
        element.

        Args:
            key: The key to assign the value to
            value: The value to assign to the key
        """
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

    def __getstate__(self):
        """Called when pickling the object, returns the state without the lock."""
        state = self.__dict__.copy()
        # Don't pickle the lock
        if "lock" in state:
            del state["lock"]
        return state

    def __setstate__(self, state):
        """Called when unpickling the object, restores the lock."""
        self.__dict__.update(state)
        # Restore the lock
        self.lock = threading.Lock()

    def wrap(self, key_func: Callable[..., str]):
        """Decorator to cache the result of a function based on its arguments.

        Example:
        ```python
        import time
        from metadata.utils.lru_cache import LRUCache
        cache = LRUCache(4096)

        @cache.wrap(lambda x, y: f"{x}-{y}")
        def add(x, y):
            time.sleep(1)
            return x + y
        start1 = time.time()
        add(1, 2)  # This will be cached and take 1 second
        print('took', time.time() - start1, 'seconds')
        start2 = time.time()
        add(1, 2)  # This will return the cached value and take no time
        print('took', time.time() - start2, 'seconds')
        ```
        Args:
            key_func: A function that generates a key based on the arguments
                of the decorated function.

        Returns:
            A decorator that caches the result of the decorated function.
        """

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
