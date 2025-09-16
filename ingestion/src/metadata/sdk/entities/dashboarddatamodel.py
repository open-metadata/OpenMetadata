"""
Dashboard Data Model entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional

from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel as DashboardDataModelEntity,
)
from metadata.sdk.entities.base import BaseEntity


class DashboardDataModel(BaseEntity):
    """Dashboard Data Model entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return DashboardDataModelEntity

    @classmethod
    def create(
        cls, request: CreateDashboardDataModelRequest
    ) -> DashboardDataModelEntity:
        """
        Create a new dashboard data model.

        Args:
            request: CreateDashboardDataModelRequest with dashboard data model details

        Returns:
            Created DashboardDataModel entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> DashboardDataModelEntity:
        """
        Retrieve a dashboard data model by ID.

        Args:
            entity_id: DashboardDataModel UUID
            fields: Optional list of fields to include

        Returns:
            DashboardDataModel entity
        """
        client = cls._get_client()
        return client.get_by_id(
            entity=DashboardDataModelEntity, entity_id=entity_id, fields=fields
        )

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> DashboardDataModelEntity:
        """
        Retrieve a dashboard data model by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            DashboardDataModel entity
        """
        client = cls._get_client()
        return client.get_by_name(
            entity=DashboardDataModelEntity, fqn=fqn, fields=fields
        )

    @classmethod
    def update(
        cls, entity_id: str, entity: DashboardDataModelEntity
    ) -> DashboardDataModelEntity:
        """
        Update a dashboard data model (PUT operation).

        Args:
            entity_id: DashboardDataModel UUID
            entity: Updated DashboardDataModel entity

        Returns:
            Updated DashboardDataModel entity
        """
        entity.id = entity_id
        client = cls._get_client()
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> DashboardDataModelEntity:
        """
        Patch a dashboard data model (PATCH operation).

        Args:
            entity_id: DashboardDataModel UUID
            json_patch: JSON patch operations

        Returns:
            Patched DashboardDataModel entity
        """
        client = cls._get_client()
        return client.patch(
            entity=DashboardDataModelEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a dashboard data model.

        Args:
            entity_id: DashboardDataModel UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=DashboardDataModelEntity,
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
    ) -> List[DashboardDataModelEntity]:
        """
        List dashboard data models.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of DashboardDataModel entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=DashboardDataModelEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []
