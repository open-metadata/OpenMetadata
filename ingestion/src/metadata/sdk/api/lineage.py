"""Lineage API with a fluent interface."""

from __future__ import annotations

import asyncio
from functools import partial
from typing import Any, Callable, ClassVar, Optional, TypeVar, Union, cast  # noqa: UP035

from pydantic import BaseModel

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.entityLineage import (
    EntitiesEdge,
    EntityLineage,
    LineageDetails,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.client import OpenMetadata
from metadata.sdk.types import JsonDict, OMetaClient, UuidLike, ensure_uuid

T = TypeVar("T")


async def _run_async(callable_: Callable[[], T]) -> T:
    """Execute a blocking callable on the default executor."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, callable_)


class Lineage:
    """Static fluent API for lineage operations."""

    _default_client: ClassVar[Optional[OMetaClient]] = None  # noqa: UP045

    @classmethod
    def set_default_client(cls, client: Union[OpenMetadata, OMetaClient]) -> None:  # noqa: UP007
        """Set the default client for static methods."""
        cls._default_client = client.ometa if isinstance(client, OpenMetadata) else client

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
        entity_type: Union[str, type[object]] | None = None,  # noqa: UP007
    ) -> Optional[EntityLineage]:  # noqa: UP045
        """Retrieve lineage for an entity by FQN."""
        client = cast(Any, cls._get_client())  # noqa: TC006
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
        return cast(EntityLineage, payload)  # noqa: TC006

    @classmethod
    def get_entity_lineage(
        cls,
        entity_type: Union[str, type[object]],  # noqa: UP007
        entity_id: UuidLike,
        upstream_depth: int = 1,
        downstream_depth: int = 1,
    ) -> Optional[EntityLineage]:  # noqa: UP045
        """Retrieve lineage for an entity by type and ID."""
        client = cast(Any, cls._get_client())  # noqa: TC006
        payload = client.get_lineage_by_id(
            entity=entity_type,
            entity_id=ensure_uuid(entity_id),
            up_depth=upstream_depth,
            down_depth=downstream_depth,
        )
        if payload is None:
            return None
        if isinstance(payload, EntityLineage):
            return payload
        if isinstance(payload, dict):
            return EntityLineage.model_validate(payload)
        return cast(EntityLineage, payload)  # noqa: TC006

    @classmethod
    def add_lineage(
        cls,
        from_entity_id: UuidLike,
        from_entity_type: str,
        to_entity_id: UuidLike,
        to_entity_type: str,
        description: Optional[str] = None,  # noqa: UP045
    ) -> JsonDict:
        """Create a lineage edge between two entities."""
        client = cast(Any, cls._get_client())  # noqa: TC006

        edge_description = basic.Markdown(description) if description else None

        request = AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(
                    id=ensure_uuid(from_entity_id),
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
                    id=ensure_uuid(to_entity_id),
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

        return cast(JsonDict, client.add_lineage(request))  # noqa: TC006

    @classmethod
    def add_lineage_by_name(
        cls,
        from_entity_fqn: str,
        from_entity_type: str,
        to_entity_fqn: str,
        to_entity_type: str,
        description: Optional[str] = None,  # noqa: UP045
    ) -> JsonDict:
        """Create a lineage edge between two entities identified by FQN."""
        client = cast(Any, cls._get_client())  # noqa: TC006

        lineage_details = (
            LineageDetails.model_validate({"description": basic.Markdown(description)}) if description else None
        )
        return cast(
            "JsonDict",
            client.add_lineage_by_name(
                from_entity_fqn=from_entity_fqn,
                from_entity_type=from_entity_type,
                to_entity_fqn=to_entity_fqn,
                to_entity_type=to_entity_type,
                lineage_details=lineage_details,
            ),
        )

    @classmethod
    def add_lineage_request(cls, lineage_request: AddLineageRequest) -> JsonDict:
        """Submit a pre-built lineage request."""
        return cast(JsonDict, cast(Any, cls._get_client()).add_lineage(lineage_request))  # noqa: TC006

    @classmethod
    def delete_lineage(
        cls,
        from_entity: str,
        from_entity_type: str,
        to_entity: str,
        to_entity_type: str,
    ) -> None:
        """Remove a lineage edge between two entities."""
        client = cast(Any, cls._get_client())  # noqa: TC006
        edge = EntitiesEdge(
            fromEntity=EntityReference(
                id=ensure_uuid(from_entity),
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
                id=ensure_uuid(to_entity),
                type=to_entity_type,
                name=None,
                fullyQualifiedName=None,
                description=None,
                displayName=None,
                deleted=None,
                inherited=None,
                href=None,
            ),
            lineageDetails=None,
        )
        client.delete_lineage_edge(edge)

    @classmethod
    def delete_lineage_by_name(
        cls,
        from_entity_fqn: str,
        from_entity_type: str,
        to_entity_fqn: str,
        to_entity_type: str,
    ) -> None:
        """Remove a lineage edge between two entities identified by FQN."""
        client = cast(Any, cls._get_client())  # noqa: TC006
        client.delete_lineage_by_name(
            from_entity_fqn=from_entity_fqn,
            from_entity_type=from_entity_type,
            to_entity_fqn=to_entity_fqn,
            to_entity_type=to_entity_type,
        )

    @classmethod
    def delete_lineage_by_source_by_name(
        cls,
        entity_type: str,
        entity_fqn: str,
        source: str,
    ) -> None:
        """Remove lineage edges by source for the entity identified by FQN."""
        cast(Any, cls._get_client()).delete_lineage_by_source_by_name(entity_type, entity_fqn, source)  # noqa: TC006

    @classmethod
    def export_lineage(
        cls,
        entity_type: Union[str, type[object]],  # noqa: UP007
        entity_id: UuidLike,
        upstream_depth: int = 3,
        downstream_depth: int = 3,
    ) -> Optional[JsonDict]:  # noqa: UP045
        """Export lineage graph for the provided entity."""
        lineage = cls.get_entity_lineage(
            entity_type=entity_type,
            entity_id=entity_id,
            upstream_depth=upstream_depth,
            downstream_depth=downstream_depth,
        )
        if lineage is None:
            return None
        lineage_model = cast(BaseModel, lineage)  # noqa: TC006
        return lineage_model.model_dump(mode="json")

    @classmethod
    async def get_lineage_async(
        cls,
        entity: str,
        upstream_depth: int = 1,
        downstream_depth: int = 1,
        entity_type: Union[str, type[object]] | None = None,  # noqa: UP007
    ) -> Optional[EntityLineage]:  # noqa: UP045
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
        entity_type: Union[str, type[object]],  # noqa: UP007
        entity_id: UuidLike,
        upstream_depth: int = 1,
        downstream_depth: int = 1,
    ) -> Optional[EntityLineage]:  # noqa: UP045
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
        description: Optional[str] = None,  # noqa: UP045
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
        return result  # noqa: RET504

    @classmethod
    async def add_lineage_by_name_async(
        cls,
        from_entity_fqn: str,
        from_entity_type: str,
        to_entity_fqn: str,
        to_entity_type: str,
        description: Optional[str] = None,  # noqa: UP045
    ) -> JsonDict:
        """Async variant of :meth:`add_lineage_by_name`."""

        result = await _run_async(
            partial(
                cls.add_lineage_by_name,
                from_entity_fqn,
                from_entity_type,
                to_entity_fqn,
                to_entity_type,
                description,
            )
        )
        return result  # noqa: RET504

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
    async def delete_lineage_by_name_async(
        cls,
        from_entity_fqn: str,
        from_entity_type: str,
        to_entity_fqn: str,
        to_entity_type: str,
    ) -> None:
        """Async variant of :meth:`delete_lineage_by_name`."""

        await _run_async(
            partial(
                cls.delete_lineage_by_name,
                from_entity_fqn,
                from_entity_type,
                to_entity_fqn,
                to_entity_type,
            )
        )

    @classmethod
    async def export_lineage_async(
        cls,
        entity_type: Union[str, type[object]],  # noqa: UP007
        entity_id: UuidLike,
        upstream_depth: int = 3,
        downstream_depth: int = 3,
    ) -> Optional[JsonDict]:  # noqa: UP045
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
        return result  # noqa: RET504

    @classmethod
    def builder(cls) -> "LineageBuilder":  # noqa: UP037
        """Create a lineage builder."""
        return LineageBuilder()


class LineageBuilder:
    """Builder for lineage operations."""

    def __init__(self) -> None:
        self._entity: Optional[str] = None  # noqa: UP045
        self._entity_type: Optional[Union[str, type[object]]] = None  # noqa: UP007, UP045
        self._entity_id: Optional[UuidLike] = None  # noqa: UP045
        self._upstream_depth: int = 1
        self._downstream_depth: int = 1
        self._from_entity_id: Optional[UuidLike] = None  # noqa: UP045
        self._from_entity_type: Optional[str] = None  # noqa: UP045
        self._to_entity_id: Optional[UuidLike] = None  # noqa: UP045
        self._to_entity_type: Optional[str] = None  # noqa: UP045
        self._description: Optional[str] = None  # noqa: UP045

    def entity(self, entity: str) -> "LineageBuilder":  # noqa: UP037
        """Set entity FQN."""
        self._entity = entity
        return self

    def entity_type(self, entity_type: Union[str, type[object]]) -> "LineageBuilder":  # noqa: UP007, UP037
        """Set entity type."""
        self._entity_type = entity_type
        return self

    def entity_id(self, entity_id: UuidLike) -> "LineageBuilder":  # noqa: UP037
        """Set entity ID."""
        self._entity_id = entity_id
        return self

    def upstream_depth(self, depth: int) -> "LineageBuilder":  # noqa: UP037
        """Set upstream depth."""
        self._upstream_depth = depth
        return self

    def downstream_depth(self, depth: int) -> "LineageBuilder":  # noqa: UP037
        """Set downstream depth."""
        self._downstream_depth = depth
        return self

    def from_entity(self, entity_id: UuidLike, entity_type: str) -> "LineageBuilder":  # noqa: UP037
        """Set source entity."""
        self._from_entity_id = entity_id
        self._from_entity_type = entity_type
        return self

    def to_entity(self, entity_id: UuidLike, entity_type: str) -> "LineageBuilder":  # noqa: UP037
        """Set target entity."""
        self._to_entity_id = entity_id
        self._to_entity_type = entity_type
        return self

    def description(self, description: str) -> "LineageBuilder":  # noqa: UP037
        """Set lineage description."""
        self._description = description
        return self

    def execute(self) -> Union[Optional[EntityLineage], JsonDict]:  # noqa: UP007, UP045
        """Execute the lineage operation synchronously."""
        if self._from_entity_id and self._to_entity_id and self._from_entity_type and self._to_entity_type:
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

    async def execute_async(self) -> Union[Optional[EntityLineage], JsonDict]:  # noqa: UP007, UP045
        """Execute the lineage operation asynchronously."""
        if self._from_entity_id and self._to_entity_id and self._from_entity_type and self._to_entity_type:
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
