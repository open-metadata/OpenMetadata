"""Tests for the LRU cache class"""

import pytest

from metadata.utils.lru_cache import LRUCache


class TestLRUCache:
    def test_create_cache(self) -> None:
        cache = LRUCache(2)
        cache.put(1, 1)

    def test_get_fails_if_key_doesnt_exist(self) -> None:
        cache = LRUCache(2)
        with pytest.raises(KeyError):
            cache.get(1)

    def test_putting_an_element_increases_cache_size(self) -> None:
        cache = LRUCache(2)
        assert len(cache) == 0
        cache.put(1, None)
        cache.put(2, None)
        assert len(cache) == 2

    def test_contains_determines_if_an_element_exists(self) -> None:
        cache = LRUCache(2)
        cache.put(1, 1)
        assert 1 in cache
        assert 2 not in cache

    def test_putting_over_capacity_rotates_cache(self) -> None:
        cache = LRUCache(2)
        cache.put(1, None)
        cache.put(2, None)
        cache.put(3, None)
        assert 1 not in cache

    def test_interacting_with_a_key_makes_it_used(self) -> None:
        cache = LRUCache(2)
        cache.put(1, None)
        cache.put(2, None)
        1 in cache
        cache.put(3, None)
        assert 1 in cache
        assert 2 not in cache

    def test_getting_an_existing_key_returns_the_associated_element(self) -> None:
        cache = LRUCache(2)
        cache.put(1, 2)
        assert cache.get(1) == 2
