"""
Improved Owner Handler Unit Tests

Testing new features:
1. LRU cache
2. Regex validation
3. Performance metrics
4. Strategy pattern
5. Index optimization
"""

import re
from unittest.mock import Mock

import pytest

from metadata.generated.schema.type.entityReference import (
    EntityReference,
    EntityReferenceList,
)
from metadata.ingestion.source.utils.owner_handler import (
    EntityLevel,
    EntityOwnerMapping,
    LRUCache,
    OwnerHandler,
    OwnerStrategy,
    RegexValidator,
)


class TestLRUCache:
    """Test LRU cache implementation"""

    def test_cache_basic_operations(self):
        """Test basic get/set operations"""
        cache = LRUCache(maxsize=3)

        cache.set("key1", "value1")
        cache.set("key2", "value2")

        assert cache.get("key1") == "value1"
        assert cache.get("key2") == "value2"
        assert cache.get("key3") is None

    def test_cache_lru_eviction(self):
        """Test LRU eviction strategy"""
        cache = LRUCache(maxsize=3)

        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.set("key3", "value3")

        # Access key1 to make it most recently used
        cache.get("key1")

        # Add 4th element, should evict key2 (least recently used)
        cache.set("key4", "value4")

        assert cache.get("key1") == "value1"  # Recently used, kept
        assert cache.get("key2") is None  # Evicted
        assert cache.get("key3") == "value3"  # Kept
        assert cache.get("key4") == "value4"  # Newly added

    def test_cache_stats(self):
        """Test cache statistics"""
        cache = LRUCache(maxsize=10)

        cache.set("key1", "value1")
        cache.get("key1")  # hit
        cache.get("key2")  # miss
        cache.get("key1")  # hit

        stats = cache.stats()
        assert stats["hits"] == 2
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 2 / 3
        assert stats["size"] == 1


class TestRegexValidator:
    """Test regex validator"""

    def test_valid_regex(self):
        """Test valid regex patterns"""
        RegexValidator.validate("^test.*$")
        RegexValidator.validate(".*_staging$")
        # Should not raise exception

    def test_dangerous_regex_patterns(self):
        """Test dangerous regex patterns"""
        with pytest.raises(ValueError, match="dangerous"):
            RegexValidator.validate("(a+)+")  # Catastrophic backtracking

        with pytest.raises(ValueError, match="dangerous"):
            RegexValidator.validate("(a*)*")  # Catastrophic backtracking

    def test_regex_too_long(self):
        """Test regex that is too long"""
        long_pattern = "a" * 250
        with pytest.raises(ValueError, match="too long"):
            RegexValidator.validate(long_pattern)

    def test_invalid_regex_syntax(self):
        """Test invalid regex syntax"""
        with pytest.raises(ValueError, match="Invalid"):
            RegexValidator.validate("[invalid")  # Unclosed bracket

    def test_compile_safe(self):
        """Test safe compilation"""
        pattern = RegexValidator.compile_safe("^test.*")
        assert isinstance(pattern, re.Pattern)
        assert pattern.match("test123")


class TestEntityOwnerMapping:
    """Test entity owner mapping"""

    def test_exact_match(self):
        """Test exact matching"""
        mapping = EntityOwnerMapping(
            entityName="users", owner="user-team", isPattern=False
        )

        assert mapping.matches("users")
        assert not mapping.matches("orders")

    def test_pattern_match(self):
        """Test regex matching"""
        mapping = EntityOwnerMapping(
            entityName=".*_staging$", owner="etl-team", isPattern=True
        )

        assert mapping.matches("users_staging")
        assert mapping.matches("orders_staging")
        assert not mapping.matches("users_prod")

    def test_invalid_pattern_handling(self):
        """Test handling of invalid regex"""
        # Should automatically fallback to non-pattern matching
        mapping = EntityOwnerMapping(
            entityName="(a+)+", owner="test-team", isPattern=True  # Dangerous pattern
        )

        # Should be marked as non-pattern matching
        assert mapping.isPattern == False


class TestOwnerHandlerImproved:
    """Test improved Owner Handler"""

    @pytest.fixture
    def mock_metadata(self):
        """Mock OpenMetadata client"""
        metadata = Mock()

        user_ref = EntityReference(id="user-123", name="john.doe", type="user")
        metadata.get_reference_by_name.return_value = EntityReferenceList(
            root=[user_ref]
        )
        metadata.get_reference_by_email.return_value = EntityReferenceList(
            root=[user_ref]
        )

        return metadata

    def test_caching_reduces_api_calls(self, mock_metadata):
        """Test caching reduces API calls"""
        handler = OwnerHandler(
            metadata=mock_metadata, include_owners=True, cache_maxsize=100
        )

        # First call
        handler._get_owner_ref("test-owner")
        assert mock_metadata.get_reference_by_name.call_count == 1

        # Second call (should use cache)
        handler._get_owner_ref("test-owner")
        assert mock_metadata.get_reference_by_name.call_count == 1  # No increase

        # Verify cache statistics
        stats = handler._owner_cache.stats()
        assert stats["hits"] >= 1

    def test_exact_match_index_optimization(self, mock_metadata):
        """Test exact match index optimization"""
        config = {
            "enabled": True,
            "strategy": "ConfigFirst",
            "tableOwnerMappings": [
                {"entityName": "users", "owner": "user-team", "isPattern": False},
                {"entityName": "orders", "owner": "order-team", "isPattern": False},
                {"entityName": ".*_staging", "owner": "etl-team", "isPattern": True},
            ],
        }

        handler = OwnerHandler(metadata=mock_metadata, owner_config=config)

        # Verify index is built
        assert EntityLevel.TABLE in handler._exact_match_index
        assert "users" in handler._exact_match_index[EntityLevel.TABLE]
        assert "orders" in handler._exact_match_index[EntityLevel.TABLE]
        # Regex patterns should not be in index
        assert ".*_staging" not in handler._exact_match_index[EntityLevel.TABLE]

    def test_performance_metrics(self, mock_metadata):
        """Test performance metrics collection"""
        handler = OwnerHandler(metadata=mock_metadata, include_owners=True)

        # Execute some owner resolution
        handler.resolve_owner(EntityLevel.TABLE, "users")
        handler.resolve_owner(EntityLevel.TABLE, "orders")

        # Get metrics
        metrics = handler.get_metrics()

        assert metrics["total_resolutions"] == 2
        assert "avg_resolution_time_ms" in metrics
        assert "cache_stats" in metrics
        assert metrics["success_rate"] >= 0

    def test_strategy_pattern(self, mock_metadata):
        """Test strategy pattern"""
        # SourceFirst strategy
        config_source_first = {
            "enabled": True,
            "strategy": "SourceFirst",
            "tableOwner": "default-team",
        }

        handler = OwnerHandler(
            metadata=mock_metadata,
            owner_config=config_source_first,
            include_owners=True,
        )

        # Should use SourceFirstStrategy
        assert handler.config.strategy == OwnerStrategy.SOURCE_FIRST

        # ConfigFirst strategy
        config_config_first = {
            "enabled": True,
            "strategy": "ConfigFirst",
            "tableOwner": "config-team",
        }

        handler2 = OwnerHandler(
            metadata=mock_metadata, owner_config=config_config_first
        )

        assert handler2.config.strategy == OwnerStrategy.CONFIG_FIRST

    def test_thread_safety(self, mock_metadata):
        """Test thread safety"""
        import threading

        handler = OwnerHandler(metadata=mock_metadata, cache_maxsize=100)

        results = []

        def resolve_owner_thread():
            for i in range(10):
                handler._get_owner_ref(f"owner-{i % 3}")

        # Create multiple threads
        threads = [threading.Thread(target=resolve_owner_thread) for _ in range(5)]

        # Start all threads
        for t in threads:
            t.start()

        # Wait for all threads to complete
        for t in threads:
            t.join()

        # Verify cache still works correctly
        stats = handler._owner_cache.stats()
        assert stats["size"] <= 100  # Should not exceed maxsize

    def test_precompiled_regex_performance(self, mock_metadata):
        """Test precompiled regex performance"""
        config = {
            "enabled": True,
            "tableOwnerMappings": [
                {"entityName": ".*_staging$", "owner": "etl-team", "isPattern": True},
                {"entityName": ".*_prod$", "owner": "prod-team", "isPattern": True},
            ],
        }

        handler = OwnerHandler(metadata=mock_metadata, owner_config=config)

        # Verify regex is precompiled
        mappings = handler._get_mappings_for_level(EntityLevel.TABLE)
        for mapping in mappings:
            if mapping.isPattern:
                assert mapping._compiled_pattern is not None
                assert isinstance(mapping._compiled_pattern, re.Pattern)

    def test_name_mapping_with_cache(self, mock_metadata):
        """Test name mapping with cache integration"""
        config = {
            "enabled": True,
            "ownerNameMapping": {
                "db_admin": "john.doe@company.com",
                "etl_user": "etl-team",
            },
        }

        handler = OwnerHandler(metadata=mock_metadata, owner_config=config)

        # First time using original name
        handler._get_owner_ref("db_admin")

        # Second time should get from cache (using original name)
        handler._get_owner_ref("db_admin")

        # Verify cache has two keys (original name and mapped name)
        stats = handler._owner_cache.stats()
        assert stats["size"] >= 1


class TestBackwardCompatibility:
    """Test backward compatibility"""

    @pytest.fixture
    def mock_metadata(self):
        metadata = Mock()
        user_ref = EntityReference(id="user-123", name="test", type="user")
        metadata.get_reference_by_name.return_value = EntityReferenceList(
            root=[user_ref]
        )
        return metadata

    def test_simple_mode_compatibility(self, mock_metadata):
        """Test simple mode backward compatibility"""
        # Old configuration method
        handler = OwnerHandler(
            metadata=mock_metadata, include_owners=True, default_owner="data-team"
        )

        # Should use simple logic (ownerConfig not enabled)
        assert handler.config.enabled == False

        # Should work correctly
        owner_ref = handler.resolve_owner(
            entity_level=EntityLevel.TABLE, entity_name="users"
        )

        assert owner_ref is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
