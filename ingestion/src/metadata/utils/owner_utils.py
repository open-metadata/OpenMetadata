# SPDX-License-Identifier: Apache-2.0
"""
Owner resolution utilities for metadata ingestion.

This module provides utilities to resolve owners for entities based on hierarchical
configuration following the topology structure (service -> database -> schema -> table).
"""

import traceback
from typing import Dict, Optional, Union

from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class OwnerResolver:
    """
    Resolves owners for entities based on hierarchical ownerConfig.
    
    Configuration structure:
    {
        "default": "fallback-owner",  # 用于所有实体的默认 owner
        "service": "service-owner",   # 可选
        "database": "db-owner" | {"db1": "owner1", "db2": "owner2"},
        "schema": "schema-owner" | {"schema1": "owner1"},
        "table": "table-owner" | {"table1": "owner1"},
        "enableInheritance": true  # 默认 true
    }
    
    Resolution order (优先级从高到低):
    1. 当前层次的自定义配置（精确匹配 FQN 或名称）
    2. 当前层次的通用配置（字符串形式）
    3. 继承的父级 owner（如果 enableInheritance=true）
    4. default 配置
    """
    
    def __init__(
        self, 
        metadata: OpenMetadata,
        owner_config: Optional[Dict] = None
    ):
        """
        Initialize the owner resolver
        
        Args:
            metadata: OpenMetadata client for owner lookups
            owner_config: Owner configuration dict
        """
        self.metadata = metadata
        self.config = owner_config or {}
        self.enable_inheritance = self.config.get("enableInheritance", True)
    
    def resolve_owner(
        self,
        entity_type: str,
        entity_name: str,
        parent_owner: Optional[str] = None,
    ) -> Optional[EntityReferenceList]:
        """
        Resolve owner for an entity based on configuration
        
        Args:
            entity_type: Type of entity ("database", "schema", "table")
            entity_name: Name or FQN of the entity
            parent_owner: Owner inherited from parent entity
            
        Returns:
            EntityReferenceList with resolved owner, or None
        """
        if not self.config:
            return None
        
        try:
            # 1. 尝试从当前层次的配置中获取 owner
            level_config = self.config.get(entity_type)
            
            if level_config:
                # 如果是 dict，尝试精确匹配
                if isinstance(level_config, dict):
                    # 先尝试完整名称匹配
                    if entity_name in level_config:
                        owner_name = level_config[entity_name]
                        owner_ref = self._get_owner_ref(owner_name)
                        if owner_ref:
                            logger.debug(
                                f"Using specific {entity_type} owner for '{entity_name}': {owner_name}"
                            )
                            return owner_ref
                    
                    # 尝试只用最后一部分名称匹配（例如 "sales_db.public.orders" 匹配 "orders"）
                    simple_name = entity_name.split('.')[-1]
                    if simple_name != entity_name and simple_name in level_config:
                        owner_name = level_config[simple_name]
                        owner_ref = self._get_owner_ref(owner_name)
                        if owner_ref:
                            logger.debug(
                                f"Using specific {entity_type} owner for '{simple_name}': {owner_name}"
                            )
                            return owner_ref
                
                # 如果是字符串，直接使用
                elif isinstance(level_config, str):
                    owner_ref = self._get_owner_ref(level_config)
                    if owner_ref:
                        logger.debug(
                            f"Using {entity_type} level owner for '{entity_name}': {level_config}"
                        )
                        return owner_ref
            
            # 2. 如果启用了继承，使用父级的 owner
            if self.enable_inheritance and parent_owner:
                owner_ref = self._get_owner_ref(parent_owner)
                if owner_ref:
                    logger.debug(
                        f"Using inherited owner for '{entity_name}': {parent_owner}"
                    )
                    return owner_ref
            
            # 3. 使用默认 owner
            default_owner = self.config.get("default")
            if default_owner:
                owner_ref = self._get_owner_ref(default_owner)
                if owner_ref:
                    logger.debug(
                        f"Using default owner for '{entity_name}': {default_owner}"
                    )
                    return owner_ref
        
        except Exception as exc:
            logger.warning(f"Error resolving owner for {entity_type} '{entity_name}': {exc}")
            logger.debug(traceback.format_exc())
        
        return None
    
    def _get_owner_ref(self, owner_name: str) -> Optional[EntityReferenceList]:
        """
        Get owner reference from OpenMetadata
        
        Args:
            owner_name: User or team name/email
            
        Returns:
            EntityReferenceList or None if not found
        """
        try:
            if not owner_name:
                return None
            
            # Try to get owner by name (handles both users and teams)
            owner_ref = self.metadata.get_reference_by_name(
                name=owner_name, is_owner=True
            )
            
            if owner_ref:
                return owner_ref
            
            # Try by email if name lookup failed and it looks like an email
            if '@' in owner_name:
                owner_ref = self.metadata.get_reference_by_email(owner_name)
                if owner_ref:
                    return owner_ref
            
            logger.warning(f"Could not find owner: {owner_name}")
        
        except Exception as exc:
            logger.debug(f"Error getting owner reference for '{owner_name}': {exc}")
            logger.debug(traceback.format_exc())
        
        return None


def get_owner_from_config(
    metadata: OpenMetadata,
    owner_config: Optional[Union[str, Dict]],
    entity_type: str,
    entity_name: str,
    parent_owner: Optional[str] = None,
) -> Optional[EntityReferenceList]:
    """
    Convenience function to resolve owner from configuration
    
    Args:
        metadata: OpenMetadata client
        owner_config: Owner configuration (string for legacy mode, dict for new mode)
        entity_type: Type of entity ("database", "schema", "table")
        entity_name: Name or FQN of the entity
        parent_owner: Owner inherited from parent entity
        
    Returns:
        EntityReferenceList with resolved owner, or None
    """
    # Handle legacy string mode (old 'owner' field)
    if isinstance(owner_config, str):
        resolver = OwnerResolver(metadata, {"default": owner_config})
        return resolver.resolve_owner(entity_type, entity_name, parent_owner)
    
    # Handle new ownerConfig dict mode
    if isinstance(owner_config, dict):
        resolver = OwnerResolver(metadata, owner_config)
        return resolver.resolve_owner(entity_type, entity_name, parent_owner)
    
    return None

