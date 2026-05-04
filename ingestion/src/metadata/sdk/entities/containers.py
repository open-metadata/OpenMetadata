"""
Containers entity SDK with fluent API
"""
from typing import List, Type  # noqa: UP035

from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.entities.base import BaseEntity, EntityList


class Containers(BaseEntity[Container, CreateContainerRequest]):
    """Containers SDK class - plural to avoid conflict with generated Container entity"""

    @classmethod
    def entity_type(cls) -> Type[Container]:
        """Return the Container entity type"""
        return Container

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
        from metadata.ingestion.ometa.utils import quote  # noqa: PLC0415

        path = f"{endpoint}/name/{quote(container_fqn)}/ancestors"
        resp = rest_client.get(path)
        if not isinstance(resp, list):
            return []
        return [EntityReference(**ref) for ref in resp]
