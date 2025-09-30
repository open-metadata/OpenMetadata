"""Lineage API with a fluent interface."""
from __future__ import annotations

import asyncio
from functools import partial
from typing import Any, Callable, ClassVar, Optional, TypeVar, Union, cast
from uuid import UUID

from pydantic import BaseModel

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.entityLineage import EntitiesEdge, EntityLineage
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.client import OpenMetadata
from metadata.sdk.types import JsonDict, OMetaClient, UuidLike

T = TypeVar("T")


def _ensure_uuid(value: UuidLike) -> basic.Uuid:
    """Convert user supplied ids into the schema UUID type."""
    if isinstance(value, basic.Uuid):
        return value
    if isinstance(value, UUID):
        return basic.Uuid(value)
    return basic.Uuid(UUID(value))


async def _run_async(callable_: Callable[[], T]) -> T:
    """Execute a blocking callable on the default executor."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, callable_)


class Lineage:
    """Static fluent API for lineage operations."""

    _default_client: ClassVar[Optional[OMetaClient]] = None

    @classmethod
    def set_default_client(cls, client: Union[OpenMetadata, OMetaClient]) -> None:
        """Set the default client for static methods."""
        cls._default_client = (
            client.ometa if isinstance(client, OpenMetadata) else client
        )

    @classmethod
    def _get_client(cls) -> OMetaClient:
        """Return the active OpenMetadata client."""
        if cls._default_client is None:
            cls._default_client = OpenMetadata.get_default_client()
        return cls._default_client

    @classmethod
    def get_lineage(
        cls,
        entity: str,
        upstream_depth: int = 1,
        downstream_depth: int = 1,
        entity_type: Union[str, type[object]] | None = None,
    ) -> Optional[EntityLineage]:
        """Retrieve lineage for an entity by FQN."""
        client = cast(Any, cls._get_client())
        call_kwargs = {
            "entity": entity_type or entity,
            "up_depth": upstream_depth,
            "down_depth": downstream_depth,
        }
        try:
            payload = client.get_lineage_by_name(**call_kwargs)
        except TypeError:
            call_kwargs["fqn"] = entity
            payload = client.get_lineage_by_name(**call_kwargs)
        if payload is None:
            return None
        if isinstance(payload, EntityLineage):
            return payload
        if isinstance(payload, dict):
            return EntityLineage.model_validate(payload)
        return cast(EntityLineage, payload)

    @classmethod
    def get_entity_lineage(
        cls,
        entity_type: Union[str, type[object]],
        entity_id: UuidLike,
        upstream_depth: int = 1,
        downstream_depth: int = 1,
    ) -> Optional[EntityLineage]:
        """Retrieve lineage for an entity by type and ID."""
        client = cast(Any, cls._get_client())
        payload = client.get_lineage_by_id(
            entity=entity_type,
            entity_id=_ensure_uuid(entity_id),
            up_depth=upstream_depth,
            down_depth=downstream_depth,
        )
        if payload is None:
            return None
        if isinstance(payload, EntityLineage):
            return payload
        if isinstance(payload, dict):
            return EntityLineage.model_validate(payload)
        return cast(EntityLineage, payload)

    @classmethod
    def add_lineage(
        cls,
        from_entity_id: UuidLike,
        from_entity_type: str,
        to_entity_id: UuidLike,
        to_entity_type: str,
        description: Optional[str] = None,
    ) -> JsonDict:
        """Create a lineage edge between two entities."""
        client = cast(Any, cls._get_client())

        edge_description = basic.Markdown(description) if description else None

        request = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(
                    id=_ensure_uuid(from_entity_id),
                    type=from_entity_type,
                    name=None,
                    fullyQualifiedName=None,
                    description=None,
                    displayName=None,
                    deleted=None,
                    inherited=None,
                    href=None,
                ),
                toEntity=EntityReference(
                    id=_ensure_uuid(to_entity_id),
                    type=to_entity_type,
                    name=None,
                    fullyQualifiedName=None,
                    description=None,
                    displayName=None,
                    deleted=None,
                    inherited=None,
                    href=None,
                ),
                description=edge_description,
                lineageDetails=None,
            )
        )

        return cast(JsonDict, client.add_lineage(request))

    @classmethod
    def add_lineage_request(cls, lineage_request: AddLineageRequest) -> JsonDict:
        """Submit a pre-built lineage request."""
        return cast(JsonDict, cast(Any, cls._get_client()).add_lineage(lineage_request))

    @classmethod
    def delete_lineage(
        cls,
        from_entity: str,
        from_entity_type: str,
        to_entity: str,
        to_entity_type: str,
    ) -> None:
        """Remove a lineage edge between two entities."""
        client = cast(Any, cls._get_client())
        client.delete_lineage_edge(
            from_entity=from_entity,
            from_entity_type=from_entity_type,
            to_entity=to_entity,
            to_entity_type=to_entity_type,
        )

    @classmethod
    def export_lineage(
        cls,
        entity_type: Union[str, type[object]],
        entity_id: UuidLike,
        upstream_depth: int = 3,
        downstream_depth: int = 3,
    ) -> Optional[JsonDict]:
        """Export lineage graph for the provided entity."""
        lineage = cls.get_entity_lineage(
            entity_type=entity_type,
            entity_id=entity_id,
            upstream_depth=upstream_depth,
            downstream_depth=downstream_depth,
        )
        if lineage is None:
            return None
        lineage_model = cast(BaseModel, lineage)
        return lineage_model.model_dump(mode="json")

    @classmethod
    async def get_lineage_async(
        cls,
        entity: str,
        upstream_depth: int = 1,
        downstream_depth: int = 1,
        entity_type: Union[str, type[object]] | None = None,
    ) -> Optional[EntityLineage]:
        """Async variant of :meth:`get_lineage`."""

        return await _run_async(
            partial(
                cls.get_lineage,
                entity,
                upstream_depth,
                downstream_depth,
                entity_type,
            )
        )

    @classmethod
    async def get_entity_lineage_async(
        cls,
        entity_type: Union[str, type[object]],
        entity_id: UuidLike,
        upstream_depth: int = 1,
        downstream_depth: int = 1,
    ) -> Optional[EntityLineage]:
        """Async variant of :meth:`get_entity_lineage`."""

        return await _run_async(
            partial(
                cls.get_entity_lineage,
                entity_type,
                entity_id,
                upstream_depth,
                downstream_depth,
            )
        )

    @classmethod
    async def add_lineage_async(
        cls,
        from_entity_id: UuidLike,
        from_entity_type: str,
        to_entity_id: UuidLike,
        to_entity_type: str,
        description: Optional[str] = None,
    ) -> JsonDict:
        """Async variant of :meth:`add_lineage`."""

        result = await _run_async(
            partial(
                cls.add_lineage,
                from_entity_id,
                from_entity_type,
                to_entity_id,
                to_entity_type,
                description,
            )
        )
        return result

    @classmethod
    async def delete_lineage_async(
        cls,
        from_entity: str,
        from_entity_type: str,
        to_entity: str,
        to_entity_type: str,
    ) -> None:
        """Async variant of :meth:`delete_lineage`."""

        await _run_async(
            partial(
                cls.delete_lineage,
                from_entity,
                from_entity_type,
                to_entity,
                to_entity_type,
            )
        )

    @classmethod
    async def export_lineage_async(
        cls,
        entity_type: Union[str, type[object]],
        entity_id: UuidLike,
        upstream_depth: int = 3,
        downstream_depth: int = 3,
    ) -> Optional[JsonDict]:
        """Async variant of :meth:`export_lineage`."""

        result = await _run_async(
            partial(
                cls.export_lineage,
                entity_type,
                entity_id,
                upstream_depth,
                downstream_depth,
            )
        )
        return result

    @classmethod
    def builder(cls) -> "LineageBuilder":
        """Create a lineage builder."""
        return LineageBuilder()


class LineageBuilder:
    """Builder for lineage operations."""

    def __init__(self) -> None:
        self._entity: Optional[str] = None
        self._entity_type: Optional[Union[str, type[object]]] = None
        self._entity_id: Optional[UuidLike] = None
        self._upstream_depth: int = 1
        self._downstream_depth: int = 1
        self._from_entity_id: Optional[UuidLike] = None
        self._from_entity_type: Optional[str] = None
        self._to_entity_id: Optional[UuidLike] = None
        self._to_entity_type: Optional[str] = None
        self._description: Optional[str] = None

    def entity(self, entity: str) -> "LineageBuilder":
        """Set entity FQN."""
        self._entity = entity
        return self

    def entity_type(self, entity_type: Union[str, type[object]]) -> "LineageBuilder":
        """Set entity type."""
        self._entity_type = entity_type
        return self

    def entity_id(self, entity_id: UuidLike) -> "LineageBuilder":
        """Set entity ID."""
        self._entity_id = entity_id
        return self

    def upstream_depth(self, depth: int) -> "LineageBuilder":
        """Set upstream depth."""
        self._upstream_depth = depth
        return self

    def downstream_depth(self, depth: int) -> "LineageBuilder":
        """Set downstream depth."""
        self._downstream_depth = depth
        return self

    def from_entity(self, entity_id: UuidLike, entity_type: str) -> "LineageBuilder":
        """Set source entity."""
        self._from_entity_id = entity_id
        self._from_entity_type = entity_type
        return self

    def to_entity(self, entity_id: UuidLike, entity_type: str) -> "LineageBuilder":
        """Set target entity."""
        self._to_entity_id = entity_id
        self._to_entity_type = entity_type
        return self

    def description(self, description: str) -> "LineageBuilder":
        """Set lineage description."""
        self._description = description
        return self

    def execute(self) -> Union[Optional[EntityLineage], JsonDict]:
        """Execute the lineage operation synchronously."""
        if (
            self._from_entity_id
            and self._to_entity_id
            and self._from_entity_type
            and self._to_entity_type
        ):
            return Lineage.add_lineage(
                from_entity_id=self._from_entity_id,
                from_entity_type=self._from_entity_type,
                to_entity_id=self._to_entity_id,
                to_entity_type=self._to_entity_type,
                description=self._description,
            )
        if self._entity is not None:
            return Lineage.get_lineage(
                entity=self._entity,
                upstream_depth=self._upstream_depth,
                downstream_depth=self._downstream_depth,
                entity_type=self._entity_type,
            )
        if self._entity_type is not None and self._entity_id is not None:
            return Lineage.get_entity_lineage(
                entity_type=self._entity_type,
                entity_id=self._entity_id,
                upstream_depth=self._upstream_depth,
                downstream_depth=self._downstream_depth,
            )
        raise ValueError("Either entity or entity_type/entity_id must be set")

    async def execute_async(self) -> Union[Optional[EntityLineage], JsonDict]:
        """Execute the lineage operation asynchronously."""
        if (
            self._from_entity_id
            and self._to_entity_id
            and self._from_entity_type
            and self._to_entity_type
        ):
            return await Lineage.add_lineage_async(
                from_entity_id=self._from_entity_id,
                from_entity_type=self._from_entity_type,
                to_entity_id=self._to_entity_id,
                to_entity_type=self._to_entity_type,
                description=self._description,
            )
        if self._entity is not None:
            return await Lineage.get_lineage_async(
                entity=self._entity,
                upstream_depth=self._upstream_depth,
                downstream_depth=self._downstream_depth,
                entity_type=self._entity_type,
            )
        if self._entity_type is not None and self._entity_id is not None:
            return await Lineage.get_entity_lineage_async(
                entity_type=self._entity_type,
                entity_id=self._entity_id,
                upstream_depth=self._upstream_depth,
                downstream_depth=self._downstream_depth,
            )
        raise ValueError("Either entity or entity_type/entity_id must be set")
