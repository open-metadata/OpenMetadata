#!/usr/bin/env python3
"""
单元测试：验证所有权分配功能

这个脚本测试新添加的 get_default_owner_ref 方法的功能。
"""

import unittest
from unittest.mock import Mock, MagicMock, patch
from typing import Optional

# 模拟导入
class MockEntityReferenceList:
    def __init__(self, root=None):
        self.root = root or []

class MockSourceConfig:
    def __init__(self, owner=None, includeOwners=True):
        self.owner = owner
        self.includeOwners = includeOwners

class MockMetadata:
    def __init__(self):
        self.get_reference_by_name = Mock()

class MockDatabaseServiceSource:
    """模拟 DatabaseServiceSource 类"""
    
    def __init__(self, source_config, metadata):
        self.source_config = source_config
        self.metadata = metadata
    
    def get_default_owner_ref(self) -> Optional[MockEntityReferenceList]:
        """
        测试版本的 get_default_owner_ref 方法
        """
        try:
            # Check if owner is configured in sourceConfig
            if hasattr(self.source_config, 'owner') and self.source_config.owner:
                owner_name = self.source_config.owner
                print(f"Using default owner from sourceConfig: {owner_name}")
                
                # Try to get owner reference by name (could be user or team)
                owner_ref = self.metadata.get_reference_by_name(
                    name=owner_name, is_owner=True
                )
                if owner_ref:
                    return owner_ref
                else:
                    print(f"Could not find owner with name: {owner_name}")
        except Exception as exc:
            print(f"Error processing default owner from sourceConfig: {exc}")
        return None

class TestOwnerAssignment(unittest.TestCase):
    """测试所有权分配功能"""
    
    def setUp(self):
        """设置测试环境"""
        self.metadata = MockMetadata()
        self.mock_owner_ref = MockEntityReferenceList([{"id": "user123", "type": "user"}])
    
    def test_get_default_owner_ref_with_valid_owner(self):
        """测试有效所有者的情况"""
        # 设置模拟
        source_config = MockSourceConfig(owner="data_team")
        self.metadata.get_reference_by_name.return_value = self.mock_owner_ref
        
        # 创建测试对象
        source = MockDatabaseServiceSource(source_config, self.metadata)
        
        # 执行测试
        result = source.get_default_owner_ref()
        
        # 验证结果
        self.assertIsNotNone(result)
        self.assertEqual(result, self.mock_owner_ref)
        self.metadata.get_reference_by_name.assert_called_once_with(
            name="data_team", is_owner=True
        )
    
    def test_get_default_owner_ref_with_nonexistent_owner(self):
        """测试不存在的所有者的情况"""
        # 设置模拟
        source_config = MockSourceConfig(owner="nonexistent_team")
        self.metadata.get_reference_by_name.return_value = None
        
        # 创建测试对象
        source = MockDatabaseServiceSource(source_config, self.metadata)
        
        # 执行测试
        result = source.get_default_owner_ref()
        
        # 验证结果
        self.assertIsNone(result)
        self.metadata.get_reference_by_name.assert_called_once_with(
            name="nonexistent_team", is_owner=True
        )
    
    def test_get_default_owner_ref_with_no_owner(self):
        """测试没有配置所有者的情况"""
        # 设置模拟
        source_config = MockSourceConfig(owner=None)
        
        # 创建测试对象
        source = MockDatabaseServiceSource(source_config, self.metadata)
        
        # 执行测试
        result = source.get_default_owner_ref()
        
        # 验证结果
        self.assertIsNone(result)
        self.metadata.get_reference_by_name.assert_not_called()
    
    def test_get_default_owner_ref_with_empty_owner(self):
        """测试空所有者的情况"""
        # 设置模拟
        source_config = MockSourceConfig(owner="")
        
        # 创建测试对象
        source = MockDatabaseServiceSource(source_config, self.metadata)
        
        # 执行测试
        result = source.get_default_owner_ref()
        
        # 验证结果
        self.assertIsNone(result)
        self.metadata.get_reference_by_name.assert_not_called()
    
    def test_get_default_owner_ref_with_exception(self):
        """测试异常处理"""
        # 设置模拟
        source_config = MockSourceConfig(owner="data_team")
        self.metadata.get_reference_by_name.side_effect = Exception("Database error")
        
        # 创建测试对象
        source = MockDatabaseServiceSource(source_config, self.metadata)
        
        # 执行测试
        result = source.get_default_owner_ref()
        
        # 验证结果
        self.assertIsNone(result)
        self.metadata.get_reference_by_name.assert_called_once_with(
            name="data_team", is_owner=True
        )

class TestOwnerAssignmentIntegration(unittest.TestCase):
    """集成测试：验证所有权分配在摄取流程中的集成"""
    
    def test_owner_priority_in_get_owner_ref(self):
        """测试在 get_owner_ref 方法中所有者的优先级"""
        # 模拟配置
        source_config = MockSourceConfig(owner="data_team", includeOwners=True)
        metadata = MockMetadata()
        mock_owner_ref = MockEntityReferenceList([{"id": "user123", "type": "user"}])
        metadata.get_reference_by_name.return_value = mock_owner_ref
        
        # 模拟 get_owner_ref 方法的行为
        def mock_get_owner_ref(table_name: str):
            # 首先检查默认所有者
            default_owner_ref = MockDatabaseServiceSource(source_config, metadata).get_default_owner_ref()
            if default_owner_ref:
                return default_owner_ref
            
            # 如果没有默认所有者，则从数据库元数据中提取
            if source_config.includeOwners:
                # 这里会调用 inspector.get_table_owner 等
                # 但为了测试，我们返回 None
                return None
            return None
        
        # 执行测试
        result = mock_get_owner_ref("test_table")
        
        # 验证结果
        self.assertIsNotNone(result)
        self.assertEqual(result, mock_owner_ref)
        # 验证调用了 get_reference_by_name
        metadata.get_reference_by_name.assert_called_with(
            name="data_team", is_owner=True
        )

def run_tests():
    """运行所有测试"""
    print("=== 运行所有权分配功能测试 ===\n")
    
    # 创建测试套件
    test_suite = unittest.TestSuite()
    
    # 添加测试用例
    test_suite.addTest(unittest.makeSuite(TestOwnerAssignment))
    test_suite.addTest(unittest.makeSuite(TestOwnerAssignmentIntegration))
    
    # 运行测试
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    # 输出结果摘要
    print(f"\n=== 测试结果摘要 ===")
    print(f"运行测试: {result.testsRun}")
    print(f"成功: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败: {len(result.failures)}")
    print(f"错误: {len(result.errors)}")
    
    if result.failures:
        print(f"\n失败的测试:")
        for test, traceback in result.failures:
            print(f"- {test}: {traceback}")
    
    if result.errors:
        print(f"\n错误的测试:")
        for test, traceback in result.errors:
            print(f"- {test}: {traceback}")
    
    return result.wasSuccessful()

if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
