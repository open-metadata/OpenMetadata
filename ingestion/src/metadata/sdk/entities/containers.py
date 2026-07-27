"""
Containers entity SDK with fluent API
"""

from typing import Any, List, Optional, Type, cast  # noqa: UP035

from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.entities.base import BaseEntity, EntityList
from metadata.sdk.types import UuidLike


class Containers(BaseEntity[Container, CreateContainerRequest]):
    """Containers SDK class - plural to avoid conflict with generated Container entity"""

    @classmethod
    def entity_type(cls) -> Type[Container]:  # noqa: UP006
        """Return the Container entity type"""
        return Container

    @classmethod
    def set_parent(
        cls,
        container_id: UuidLike,
        parent: EntityReference,
    ) -> Container:
        """
        Re-parent an existing container via PATCH (issue #24294).

        The backend cascades the FQN change to every descendant container, nested
        column FQN, tag-usage row, entity-link, policy condition, and search-index
        document. The new ``parent`` must be a Container under the same
        StorageService — cross-service moves are rejected with HTTP 400.
        """
        return cls._patch_parent(container_id, parent)

    @classmethod
    def clear_parent(cls, container_id: UuidLike) -> Container:
        """
        Promote the container to be a direct child of its StorageService by
        clearing its ``parent`` field via PATCH.
        """
        return cls._patch_parent(container_id, None)

    @classmethod
    def _patch_parent(
        cls,
        container_id: UuidLike,
        parent: Optional[EntityReference],  # noqa: UP045
    ) -> Container:
        client = cls._get_client()
        current = client.get_by_id(
            entity=Container,
            entity_id=cls._stringify_identifier(container_id),
            fields=["parent"],
        )

        working = getattr(current, "model_copy", None)
        working = working(deep=True) if callable(working) else current
        setattr(working, "parent", parent)  # noqa: B010

        updated = cast(Any, client).patch(  # noqa: TC006
            entity=Container,
            source=current,
            destination=working,
        )
        return cls._coerce_entity(updated)

    @classmethod
    def list_children(
        cls,
        container_fqn: str,
        *,
        limit: int = 100,
        offset: int = 0,
    ) -> EntityList[Container]:
        """
        Page through the immediate children of a Container via the dedicated
        ``/v1/containers/name/{fqn}/children`` endpoint. Use this instead of
        fetching the parent with ``fields=["children"]`` — that field is no longer
        served because the inline payload is unbounded for buckets with many
        objects.

        Each row is a slim projection (id, name, displayName, fqn, description,
        service); ``dataModel``, ``tags``, ``owners``, ``extension`` are not
        populated. Re-fetch the specific child via :meth:`retrieve_by_name`
        when full details are needed.
        """
        client = cls._get_client()
        page = client.list_container_children(container_fqn, limit=limit, offset=offset)
        entities = [cls._coerce_entity(item) for item in page.entities]
        return EntityList(
            entities=entities,
            after=getattr(page, "after", None),
            before=getattr(page, "before", None),
        )

    @classmethod
    def list_ancestors(cls, container_fqn: str) -> List[EntityReference]:  # noqa: UP006
        """
        Resolve the full ancestor chain for a container in a single call.
        Returns ``EntityReference``s ordered from the root container (immediate
        child of the storage service) down to the immediate parent of
        ``container_fqn``. Empty list when the container is at the top level.
        """
        client = cls._get_client()
        rest_client = cls._get_rest_client(client)
        endpoint = cls._get_endpoint_path(client)
        from metadata.ingestion.ometa.utils import (  # noqa: PLC0415
            quote,
        )

        path = f"{endpoint}/name/{quote(container_fqn)}/ancestors"
        resp = rest_client.get(path)
        if not isinstance(resp, list):
            return []
        return [EntityReference(**ref) for ref in resp]
