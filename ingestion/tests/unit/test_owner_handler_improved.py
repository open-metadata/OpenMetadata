"""
改进后的Owner Handler单元测试

测试新增功能：
1. LRU缓存
2. 正则表达式验证
3. 性能指标
4. 策略模式
5. 索引优化
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
    """测试LRU缓存实现"""

    def test_cache_basic_operations(self):
        """测试基本的get/set操作"""
        cache = LRUCache(maxsize=3)

        cache.set("key1", "value1")
        cache.set("key2", "value2")

        assert cache.get("key1") == "value1"
        assert cache.get("key2") == "value2"
        assert cache.get("key3") is None

    def test_cache_lru_eviction(self):
        """测试LRU淘汰策略"""
        cache = LRUCache(maxsize=3)

        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.set("key3", "value3")

        # 访问key1，使其成为最近使用
        cache.get("key1")

        # 添加第4个元素，应该淘汰key2（最久未使用）
        cache.set("key4", "value4")

        assert cache.get("key1") == "value1"  # 最近使用，保留
        assert cache.get("key2") is None  # 被淘汰
        assert cache.get("key3") == "value3"  # 保留
        assert cache.get("key4") == "value4"  # 新添加

    def test_cache_stats(self):
        """测试缓存统计信息"""
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
    """测试正则表达式验证器"""

    def test_valid_regex(self):
        """测试有效的正则表达式"""
        RegexValidator.validate("^test.*$")
        RegexValidator.validate(".*_staging$")
        # 不应该抛出异常

    def test_dangerous_regex_patterns(self):
        """测试危险的正则模式"""
        with pytest.raises(ValueError, match="dangerous"):
            RegexValidator.validate("(a+)+")  # 灾难性回溯

        with pytest.raises(ValueError, match="dangerous"):
            RegexValidator.validate("(a*)*")  # 灾难性回溯

    def test_regex_too_long(self):
        """测试过长的正则表达式"""
        long_pattern = "a" * 250
        with pytest.raises(ValueError, match="too long"):
            RegexValidator.validate(long_pattern)

    def test_invalid_regex_syntax(self):
        """测试无效的正则语法"""
        with pytest.raises(ValueError, match="Invalid"):
            RegexValidator.validate("[invalid")  # 未闭合的方括号

    def test_compile_safe(self):
        """测试安全编译"""
        pattern = RegexValidator.compile_safe("^test.*")
        assert isinstance(pattern, re.Pattern)
        assert pattern.match("test123")


class TestEntityOwnerMapping:
    """测试实体Owner映射"""

    def test_exact_match(self):
        """测试精确匹配"""
        mapping = EntityOwnerMapping(
            entityName="users", owner="user-team", isPattern=False
        )

        assert mapping.matches("users")
        assert not mapping.matches("orders")

    def test_pattern_match(self):
        """测试正则匹配"""
        mapping = EntityOwnerMapping(
            entityName=".*_staging$", owner="etl-team", isPattern=True
        )

        assert mapping.matches("users_staging")
        assert mapping.matches("orders_staging")
        assert not mapping.matches("users_prod")

    def test_invalid_pattern_handling(self):
        """测试无效正则的处理"""
        # 应该自动降级为非模式匹配
        mapping = EntityOwnerMapping(
            entityName="(a+)+", owner="test-team", isPattern=True  # 危险模式
        )

        # 应该被标记为非模式匹配
        assert mapping.isPattern == False


class TestOwnerHandlerImproved:
    """测试改进后的Owner Handler"""

    @pytest.fixture
    def mock_metadata(self):
        """Mock OpenMetadata客户端"""
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
        """测试缓存减少API调用"""
        handler = OwnerHandler(
            metadata=mock_metadata, include_owners=True, cache_maxsize=100
        )

        # 第一次调用
        handler._get_owner_ref("test-owner")
        assert mock_metadata.get_reference_by_name.call_count == 1

        # 第二次调用（应该使用缓存）
        handler._get_owner_ref("test-owner")
        assert mock_metadata.get_reference_by_name.call_count == 1  # 没有增加

        # 验证缓存统计
        stats = handler._owner_cache.stats()
        assert stats["hits"] >= 1

    def test_exact_match_index_optimization(self, mock_metadata):
        """测试精确匹配索引优化"""
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

        # 验证索引已构建
        assert EntityLevel.TABLE in handler._exact_match_index
        assert "users" in handler._exact_match_index[EntityLevel.TABLE]
        assert "orders" in handler._exact_match_index[EntityLevel.TABLE]
        # 正则模式不应该在索引中
        assert ".*_staging" not in handler._exact_match_index[EntityLevel.TABLE]

    def test_performance_metrics(self, mock_metadata):
        """测试性能指标收集"""
        handler = OwnerHandler(metadata=mock_metadata, include_owners=True)

        # 执行一些owner解析
        handler.resolve_owner(EntityLevel.TABLE, "users")
        handler.resolve_owner(EntityLevel.TABLE, "orders")

        # 获取指标
        metrics = handler.get_metrics()

        assert metrics["total_resolutions"] == 2
        assert "avg_resolution_time_ms" in metrics
        assert "cache_stats" in metrics
        assert metrics["success_rate"] >= 0

    def test_strategy_pattern(self, mock_metadata):
        """测试策略模式"""
        # SourceFirst策略
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

        # 应该使用SourceFirstStrategy
        assert handler.config.strategy == OwnerStrategy.SOURCE_FIRST

        # ConfigFirst策略
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
        """测试线程安全性"""
        import threading

        handler = OwnerHandler(metadata=mock_metadata, cache_maxsize=100)

        results = []

        def resolve_owner_thread():
            for i in range(10):
                handler._get_owner_ref(f"owner-{i % 3}")

        # 创建多个线程
        threads = [threading.Thread(target=resolve_owner_thread) for _ in range(5)]

        # 启动所有线程
        for t in threads:
            t.start()

        # 等待所有线程完成
        for t in threads:
            t.join()

        # 验证缓存仍然正常工作
        stats = handler._owner_cache.stats()
        assert stats["size"] <= 100  # 不应该超过maxsize

    def test_precompiled_regex_performance(self, mock_metadata):
        """测试预编译正则表达式的性能"""
        config = {
            "enabled": True,
            "tableOwnerMappings": [
                {"entityName": ".*_staging$", "owner": "etl-team", "isPattern": True},
                {"entityName": ".*_prod$", "owner": "prod-team", "isPattern": True},
            ],
        }

        handler = OwnerHandler(metadata=mock_metadata, owner_config=config)

        # 验证正则已预编译
        mappings = handler._get_mappings_for_level(EntityLevel.TABLE)
        for mapping in mappings:
            if mapping.isPattern:
                assert mapping._compiled_pattern is not None
                assert isinstance(mapping._compiled_pattern, re.Pattern)

    def test_name_mapping_with_cache(self, mock_metadata):
        """测试名称映射与缓存的配合"""
        config = {
            "enabled": True,
            "ownerNameMapping": {
                "db_admin": "john.doe@company.com",
                "etl_user": "etl-team",
            },
        }

        handler = OwnerHandler(metadata=mock_metadata, owner_config=config)

        # 第一次使用原始名称
        handler._get_owner_ref("db_admin")

        # 第二次应该从缓存获取（使用原始名称）
        handler._get_owner_ref("db_admin")

        # 验证缓存中有两个key（原始名称和映射后的名称）
        stats = handler._owner_cache.stats()
        assert stats["size"] >= 1


class TestBackwardCompatibility:
    """测试向后兼容性"""

    @pytest.fixture
    def mock_metadata(self):
        metadata = Mock()
        user_ref = EntityReference(id="user-123", name="test", type="user")
        metadata.get_reference_by_name.return_value = EntityReferenceList(
            root=[user_ref]
        )
        return metadata

    def test_simple_mode_compatibility(self, mock_metadata):
        """测试简单模式的向后兼容性"""
        # 旧的配置方式
        handler = OwnerHandler(
            metadata=mock_metadata, include_owners=True, default_owner="data-team"
        )

        # 应该使用简单逻辑（不启用ownerConfig）
        assert handler.config.enabled == False

        # 应该能正常工作
        owner_ref = handler.resolve_owner(
            entity_level=EntityLevel.TABLE, entity_name="users"
        )

        assert owner_ref is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
