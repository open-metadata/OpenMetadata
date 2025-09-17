"""
Fluent API for managing custom properties on OpenMetadata entities.
"""
import logging
from typing import Any, Dict, Optional, Type, TypeVar, Union
from uuid import UUID

from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type import basic
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from pydantic import BaseModel

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class CustomPropertyUpdater:
    """
    Fluent interface for updating custom properties on entities.

    Usage:
        # Update custom properties on a Table
        table = CustomProperties.update(Table, table_id) \\
            .with_property("businessImportance", "HIGH") \\
            .with_property("dataClassification", "CONFIDENTIAL") \\
            .with_property("refreshFrequency", "DAILY") \\
            .execute()

        # Bulk update properties
        properties = {
            "businessImportance": "HIGH",
            "dataClassification": "CONFIDENTIAL"
        }

        table = CustomProperties.update(Table, table_id) \\
            .with_properties(properties) \\
            .execute()

        # Clear a specific property
        table = CustomProperties.update(Table, table_id) \\
            .clear_property("businessImportance") \\
            .execute()

        # Clear all custom properties
        table = CustomProperties.update(Table, table_id) \\
            .clear_all() \\
            .execute()
    """

    def __init__(
        self,
        entity_type: Type[T],
        identifier: Union[str, UUID],
        client: Optional[OpenMetadata] = None,
        is_fqn: bool = False,
    ):
        """
        Initialize the custom property updater.

        Args:
            entity_type: The entity type class (e.g., Table, Glossary)
            identifier: Entity ID or FQN
            client: OpenMetadata client instance (optional)
            is_fqn: Whether the identifier is a FQN
        """
        self.entity_type = entity_type
        self.identifier = str(identifier)
        self.is_fqn = is_fqn
        self._client = client
        self.properties: Dict[str, Any] = {}
        self.clear_all_flag = False

    def _get_client(self) -> OpenMetadata:
        """Get or create OpenMetadata client."""
        if self._client:
            return self._client

        # Try to get from BaseEntity if available
        try:
            from metadata.sdk.entities.base import BaseEntity

            # Find the entity class that matches our type
            for subclass in BaseEntity.__subclasses__():
                if hasattr(subclass, "entity_type") and subclass.entity_type() == self.entity_type:
                    return subclass._get_client()
        except Exception as e:
            logger.debug(f"Could not get client from BaseEntity: {e}")

        raise RuntimeError(
            "No OpenMetadata client available. Pass a client or ensure BaseEntity is configured."
        )

    def with_property(self, key: str, value: Any) -> "CustomPropertyUpdater":
        """
        Add or update a custom property.

        Args:
            key: The property key
            value: The property value

        Returns:
            Self for chaining
        """
        self.properties[key] = value
        return self

    def with_properties(self, properties: Dict[str, Any]) -> "CustomPropertyUpdater":
        """
        Add or update multiple custom properties.

        Args:
            properties: Dictionary of properties to add/update

        Returns:
            Self for chaining
        """
        self.properties.update(properties)
        return self

    def clear_property(self, key: str) -> "CustomPropertyUpdater":
        """
        Clear a specific custom property.

        Args:
            key: The property key to remove

        Returns:
            Self for chaining
        """
        self.properties[key] = None
        return self

    def clear_all(self) -> "CustomPropertyUpdater":
        """
        Clear all custom properties.

        Returns:
            Self for chaining
        """
        self.clear_all_flag = True
        return self

    def execute(self) -> T:
        """
        Execute the custom property update.

        Returns:
            The updated entity
        """
        client = self._get_client()

        # Fetch the current entity with extension field
        if self.is_fqn:
            entity = client.get_by_name(
                entity=self.entity_type,
                fqn=self.identifier,
                fields=["extension"]
            )
        else:
            entity = client.get_by_id(
                entity=self.entity_type,
                entity_id=self.identifier,
                fields=["extension"]
            )

        if not entity:
            raise ValueError(f"Entity not found: {self.identifier}")

        # Get current extension
        current_extension = {}
        if hasattr(entity, "extension") and entity.extension:
            # Handle wrapped EntityExtension type
            if isinstance(entity.extension, basic.EntityExtension):
                current_extension = entity.extension.root if hasattr(entity.extension, "root") else {}
            elif isinstance(entity.extension, dict):
                current_extension = entity.extension.copy()

        # Apply changes
        if self.clear_all_flag:
            new_extension = {}
        else:
            new_extension = current_extension.copy()
            for key, value in self.properties.items():
                if value is None:
                    new_extension.pop(key, None)
                else:
                    new_extension[key] = value

        # Create a copy of the entity with updated extension
        entity_copy = entity.model_copy(deep=True)

        # Set the new extension
        if new_extension:
            # Wrap in EntityExtension if needed
            entity_copy.extension = basic.EntityExtension(root=new_extension)
        else:
            entity_copy.extension = None

        # Update the entity using patch
        updated_entity = client.patch(
            entity=self.entity_type,
            source=entity,
            destination=entity_copy
        )

        return updated_entity


class CustomProperties:
    """
    Static factory for creating custom property updaters.

    Usage:
        from metadata.generated.schema.entity.data.table import Table
        from metadata.sdk.entities.custom_properties import CustomProperties

        # Update by ID
        table = CustomProperties.update(Table, table_id) \\
            .with_property("businessImportance", "HIGH") \\
            .execute()

        # Update by FQN
        table = CustomProperties.update_by_name(
            Table,
            "service.database.schema.table"
        ).with_property("owner", "data-team").execute()
    """

    @staticmethod
    def update(
        entity_type: Type[T],
        entity_id: Union[str, UUID],
        client: Optional[OpenMetadata] = None
    ) -> CustomPropertyUpdater:
        """
        Create a custom property updater for an entity by ID.

        Args:
            entity_type: The entity type class (e.g., Table, Glossary)
            entity_id: The entity UUID
            client: OpenMetadata client instance (optional)

        Returns:
            CustomPropertyUpdater instance
        """
        return CustomPropertyUpdater(entity_type, entity_id, client, is_fqn=False)

    @staticmethod
    def update_by_name(
        entity_type: Type[T],
        entity_name: str,
        client: Optional[OpenMetadata] = None
    ) -> CustomPropertyUpdater:
        """
        Create a custom property updater for an entity by name/FQN.

        Args:
            entity_type: The entity type class (e.g., Table, Glossary)
            entity_name: The entity name or FQN
            client: OpenMetadata client instance (optional)

        Returns:
            CustomPropertyUpdater instance
        """
        return CustomPropertyUpdater(entity_type, entity_name, client, is_fqn=True)


# Convenience methods for entity-specific custom property updates
class TableCustomProperties:
    """Convenience methods for Table custom properties."""

    @staticmethod
    def update(table_id: Union[str, UUID], client: Optional[OpenMetadata] = None) -> CustomPropertyUpdater:
        """Update custom properties on a table by ID."""
        return CustomProperties.update(Table, table_id, client)

    @staticmethod
    def update_by_name(table_fqn: str, client: Optional[OpenMetadata] = None) -> CustomPropertyUpdater:
        """Update custom properties on a table by FQN."""
        return CustomProperties.update_by_name(Table, table_fqn, client)


class GlossaryCustomProperties:
    """Convenience methods for Glossary custom properties."""

    @staticmethod
    def update(glossary_id: Union[str, UUID], client: Optional[OpenMetadata] = None) -> CustomPropertyUpdater:
        """Update custom properties on a glossary by ID."""
        return CustomProperties.update(Glossary, glossary_id, client)

    @staticmethod
    def update_by_name(glossary_name: str, client: Optional[OpenMetadata] = None) -> CustomPropertyUpdater:
        """Update custom properties on a glossary by name."""
        return CustomProperties.update_by_name(Glossary, glossary_name, client)