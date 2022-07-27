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
