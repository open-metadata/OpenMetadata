"""Typed helpers for custom property updates."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Generic, Optional, Type, TypeVar, Union, cast
from uuid import UUID

from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type import basic
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.sdk.client import OpenMetadata
from metadata.sdk.types import OMetaClient, UuidLike

TEntity = TypeVar("TEntity", bound=BaseModel)  # pylint: disable=invalid-name


@dataclass
class CustomPropertyUpdater(Generic[TEntity]):
    """Mutable builder that applies custom property updates through the API."""

    entity_type: Type[TEntity]
    identifier: str
    is_fqn: bool = False
    properties: Dict[str, Any] = field(default_factory=dict)
    clear_all_flag: bool = False
    _client_override: Optional[OMetaClient] = field(
        default=None, init=False, repr=False
    )

    @staticmethod
    def _get_client() -> OMetaClient:
        return OpenMetadata.get_default_client()

    # ------------------------------------------------------------------
    # Mutation helpers
    # ------------------------------------------------------------------
    def with_property(self, key: str, value: Any) -> "CustomPropertyUpdater[TEntity]":
        """Set a single custom property value."""
        self.properties[key] = value
        return self

    def with_properties(
        self, properties: Dict[str, Any]
    ) -> "CustomPropertyUpdater[TEntity]":
        """Set multiple custom property values in one call."""
        self.properties.update(properties)
        return self

    def clear_property(self, key: str) -> "CustomPropertyUpdater[TEntity]":
        """Unset a specific custom property."""
        self.properties[key] = None
        return self

    def clear_all(self) -> "CustomPropertyUpdater[TEntity]":
        """Remove all custom properties from the entity."""
        self.clear_all_flag = True
        return self

    def use_client(self, client: OMetaClient) -> "CustomPropertyUpdater[TEntity]":
        """Provide an explicit client (useful for patched tests)."""
        self._client_override = client
        return self

    # ------------------------------------------------------------------
    # Execution
    # ------------------------------------------------------------------
    def execute(self) -> TEntity:
        """Persist the queued custom property changes and return the entity."""
        client = self._client_override or self._get_client()
        fields = ["extension"]
        if self.is_fqn:
            current = client.get_by_name(
                entity=self.entity_type,
                fqn=self.identifier,
                fields=fields,
            )
        else:
            current = client.get_by_id(
                entity=self.entity_type,
                entity_id=self.identifier,
                fields=fields,
            )

        working = getattr(current, "model_copy", None)
        working = working(deep=True) if callable(working) else current

        if self.clear_all_flag:
            setattr(working, "extension", None)
        elif self.properties:
            existing = getattr(current, "extension", None)
            root: Dict[str, Any] = dict(getattr(existing, "root", {}) or {})
            root.update(self.properties)
            setattr(working, "extension", basic.EntityExtension(root=root))

        updated = cast(Any, client).patch(
            entity=self.entity_type,
            source=current,
            destination=working,
        )
        return updated


class CustomProperties:
    """Factory helpers for custom property updates."""

    @staticmethod
    def update(
        entity_type: Type[TEntity], identifier: Union[UuidLike, UUID]
    ) -> CustomPropertyUpdater[TEntity]:
        """Create an updater targeting the provided entity identifier."""
        identifier_str = str(identifier)
        return CustomPropertyUpdater(entity_type, identifier_str, is_fqn=False)

    @staticmethod
    def update_by_name(
        entity_type: Type[TEntity], fqn: str
    ) -> CustomPropertyUpdater[TEntity]:
        """Create an updater referencing an entity by FQN."""
        return CustomPropertyUpdater(entity_type, fqn, is_fqn=True)


class TableCustomProperties:
    """Table-specific convenience wrappers."""

    @staticmethod
    def update(identifier: Union[UuidLike, UUID]) -> CustomPropertyUpdater[Any]:
        return CustomProperties.update(Table, identifier)

    @staticmethod
    def update_by_name(fqn: str) -> CustomPropertyUpdater[Any]:
        return CustomProperties.update_by_name(Table, fqn)


class GlossaryCustomProperties:
    """Glossary-specific convenience wrappers."""

    @staticmethod
    def update(identifier: Union[UuidLike, UUID]) -> CustomPropertyUpdater[Any]:
        return CustomProperties.update(Glossary, identifier)

    @staticmethod
    def update_by_name(fqn: str) -> CustomPropertyUpdater[Any]:
        return CustomProperties.update_by_name(Glossary, fqn)
