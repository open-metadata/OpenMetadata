"""
API Endpoint entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional

from metadata.generated.schema.api.data.createAPIEndpoint import (
    CreateAPIEndpointRequest,
)
from metadata.generated.schema.entity.data.apiEndpoint import (
    APIEndpoint as APIEndpointEntity,
)
from metadata.sdk.entities.base import BaseEntity


class APIEndpoint(BaseEntity):
    """API Endpoint entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return APIEndpointEntity

    @classmethod
    def create(cls, request: CreateAPIEndpointRequest) -> APIEndpointEntity:
        """
        Create a new api endpoint.

        Args:
            request: CreateAPIEndpointRequest with api endpoint details

        Returns:
            Created APIEndpoint entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> APIEndpointEntity:
        """
        Retrieve a api endpoint by ID.

        Args:
            entity_id: APIEndpoint UUID
            fields: Optional list of fields to include

        Returns:
            APIEndpoint entity
        """
        client = cls._get_client()
        return client.get_by_id(
            entity=APIEndpointEntity, entity_id=entity_id, fields=fields
        )

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> APIEndpointEntity:
        """
        Retrieve a api endpoint by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            APIEndpoint entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=APIEndpointEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity_id: str, entity: APIEndpointEntity) -> APIEndpointEntity:
        """
        Update a api endpoint (PUT operation).

        Args:
            entity_id: APIEndpoint UUID
            entity: Updated APIEndpoint entity

        Returns:
            Updated APIEndpoint entity
        """
        entity.id = entity_id
        client = cls._get_client()
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> APIEndpointEntity:
        """
        Patch a api endpoint (PATCH operation).

        Args:
            entity_id: APIEndpoint UUID
            json_patch: JSON patch operations

        Returns:
            Patched APIEndpoint entity
        """
        client = cls._get_client()
        return client.patch(
            entity=APIEndpointEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a api endpoint.

        Args:
            entity_id: APIEndpoint UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=APIEndpointEntity,
            entity_id=entity_id,
            recursive=recursive,
            hard_delete=hard_delete,
        )

    @classmethod
    def list(
        cls,
        fields: Optional[List[str]] = None,
        after: Optional[str] = None,
        before: Optional[str] = None,
        limit: int = 100,
    ) -> List[APIEndpointEntity]:
        """
        List api endpoints.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of APIEndpoint entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=APIEndpointEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []
