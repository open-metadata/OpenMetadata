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
        "default": "fallback-owner",  # Default owner for all entities
        "service": "service-owner",   # Optional
        "database": "db-owner" | {"db1": "owner1", "db2": "owner2"},
        "schema": "schema-owner" | {"schema1": "owner1"},
        "table": "table-owner" | {"table1": "owner1"},
        "enableInheritance": true  # Default true
    }

    Resolution order (highest to lowest priority):
    1. Current level custom configuration (exact FQN or name match)
    2. Current level general configuration (string format)
    3. Inherited parent owner (if enableInheritance=true)
    4. Default configuration
    """

    def __init__(self, metadata: OpenMetadata, owner_config: Optional[Dict] = None):
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
            logger.debug(
                f"Resolving owner for {entity_type} '{entity_name}', parent_owner: {parent_owner}"
            )
            logger.debug(f"Full config: {self.config}")

            # 1. Try to get owner from current level configuration
            level_config = self.config.get(entity_type)
            logger.debug(f"Level config for '{entity_type}': {level_config}")

            if level_config:
                # If it's a dict, try exact matching
                if isinstance(level_config, dict):
                    # First try full name matching
                    if entity_name in level_config:
                        owner_name = level_config[entity_name]
                        owner_ref = self._get_owner_ref(owner_name)
                        if owner_ref:
                            logger.debug(
                                f"Using specific {entity_type} owner for '{entity_name}': {owner_name}"
                            )
                            return owner_ref

                    # Try matching with only the last part of the name (e.g., "sales_db.public.orders" matches "orders")
                    simple_name = entity_name.split(".")[-1]
                    if simple_name != entity_name and simple_name in level_config:
                        owner_name = level_config[simple_name]
                        owner_ref = self._get_owner_ref(owner_name)
                        if owner_ref:
                            logger.debug(
                                f"Using specific {entity_type} owner for '{simple_name}': {owner_name}"
                            )
                            return owner_ref

                # If it's a string, use it directly
                elif isinstance(level_config, str):
                    owner_ref = self._get_owner_ref(level_config)
                    if owner_ref:
                        logger.debug(
                            f"Using {entity_type} level owner for '{entity_name}': {level_config}"
                        )
                        return owner_ref

            # 2. If inheritance is enabled, use parent owner
            if self.enable_inheritance and parent_owner:
                owner_ref = self._get_owner_ref(parent_owner)
                if owner_ref:
                    logger.debug(
                        f"Using inherited owner for '{entity_name}': {parent_owner}"
                    )
                    return owner_ref

            # 3. Use default owner
            default_owner = self.config.get("default")
            if default_owner:
                owner_ref = self._get_owner_ref(default_owner)
                if owner_ref:
                    logger.debug(
                        f"Using default owner for '{entity_name}': {default_owner}"
                    )
                    return owner_ref

        except Exception as exc:
            logger.warning(
                f"Error resolving owner for {entity_type} '{entity_name}': {exc}"
            )
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
            if "@" in owner_name:
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
        owner_config: Owner configuration (string for simple mode, dict for hierarchical mode)
        entity_type: Type of entity ("database", "databaseSchema", "table")
        entity_name: Name or FQN of the entity
        parent_owner: Owner inherited from parent entity

    Returns:
        EntityReferenceList with resolved owner, or None
    """
    logger.debug(
        f"get_owner_from_config called: entity_type={entity_type}, entity_name={entity_name}, owner_config type={type(owner_config)}"
    )

    # Handle simple string mode (single owner for all entities)
    if isinstance(owner_config, str):
        resolver = OwnerResolver(metadata, {"default": owner_config})
        return resolver.resolve_owner(entity_type, entity_name, parent_owner)

    # Handle new ownerConfig dict mode or Pydantic model
    if isinstance(owner_config, dict):
        resolver = OwnerResolver(metadata, owner_config)
        return resolver.resolve_owner(entity_type, entity_name, parent_owner)

    # Handle Pydantic model (convert to dict)
    if hasattr(owner_config, "model_dump"):
        logger.debug("Converting Pydantic model to dict")
        config_dict = owner_config.model_dump(exclude_none=True)
        resolver = OwnerResolver(metadata, config_dict)
        return resolver.resolve_owner(entity_type, entity_name, parent_owner)

    logger.debug(f"Unsupported owner_config type: {type(owner_config)}")
    return None
