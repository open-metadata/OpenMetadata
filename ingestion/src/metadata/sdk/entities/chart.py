"""
Chart entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional, Union

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.entity.data.chart import Chart as ChartEntity
from metadata.sdk.entities.base import BaseEntity


class Chart(BaseEntity):
    """Chart entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return ChartEntity

    @classmethod
    def create(cls, request: CreateChartRequest) -> ChartEntity:
        """
        Create a new chart.

        Args:
            request: CreateChartRequest with chart details

        Returns:
            Created Chart entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> ChartEntity:
        """
        Retrieve a chart by ID.

        Args:
            entity_id: Chart UUID
            fields: Optional list of fields to include

        Returns:
            Chart entity
        """
        client = cls._get_client()
        return client.get_by_id(entity=ChartEntity, entity_id=entity_id, fields=fields)

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> ChartEntity:
        """
        Retrieve a chart by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            Chart entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=ChartEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity_id: str, chart: ChartEntity) -> ChartEntity:
        """
        Update a chart (PUT operation).

        Args:
            entity_id: Chart UUID
            chart: Updated Chart entity

        Returns:
            Updated Chart entity
        """
        chart.id = entity_id
        client = cls._get_client()
        return client.create_or_update(chart)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> ChartEntity:
        """
        Patch a chart (PATCH operation).

        Args:
            entity_id: Chart UUID
            json_patch: JSON patch operations

        Returns:
            Patched Chart entity
        """
        client = cls._get_client()
        return client.patch(
            entity=ChartEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a chart.

        Args:
            entity_id: Chart UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=ChartEntity,
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
    ) -> List[ChartEntity]:
        """
        List charts.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of Chart entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=ChartEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []

    @classmethod
    def add_followers(cls, entity_id: str, user_ids: List[str]) -> ChartEntity:
        """
        Add followers to a chart.

        Args:
            entity_id: Chart UUID
            user_ids: List of user UUIDs to add as followers

        Returns:
            Updated Chart entity
        """
        client = cls._get_client()
        return client.add_followers(
            entity=ChartEntity, entity_id=entity_id, user_ids=user_ids
        )

    @classmethod
    def remove_followers(cls, entity_id: str, user_ids: List[str]) -> ChartEntity:
        """
        Remove followers from a chart.

        Args:
            entity_id: Chart UUID
            user_ids: List of user UUIDs to remove as followers

        Returns:
            Updated Chart entity
        """
        client = cls._get_client()
        return client.remove_followers(
            entity=ChartEntity, entity_id=entity_id, user_ids=user_ids
        )

    @classmethod
    def get_versions(cls, entity_id: str) -> List[ChartEntity]:
        """
        Get all versions of a chart.

        Args:
            entity_id: Chart UUID

        Returns:
            List of Chart versions
        """
        client = cls._get_client()
        return client.get_entity_versions(entity=ChartEntity, entity_id=entity_id)

    @classmethod
    def get_version(cls, entity_id: str, version: Union[str, float]) -> ChartEntity:
        """
        Get a specific version of a chart.

        Args:
            entity_id: Chart UUID
            version: Version number or 'latest'

        Returns:
            Chart entity at specified version
        """
        client = cls._get_client()
        return client.get_entity_version(
            entity=ChartEntity, entity_id=entity_id, version=version
        )

    @classmethod
    def restore(cls, entity_id: str) -> ChartEntity:
        """
        Restore a soft-deleted chart.

        Args:
            entity_id: Chart UUID

        Returns:
            Restored Chart entity
        """
        client = cls._get_client()
        return client.restore_entity(entity=ChartEntity, entity_id=entity_id)

    @classmethod
    def export_csv(cls, name: str) -> str:
        """
        Export charts to CSV format.

        Args:
            name: Export name

        Returns:
            CSV data as string
        """
        client = cls._get_client()
        return client.export_csv(entity=ChartEntity, name=name)

    @classmethod
    def import_csv(cls, csv_data: str, dry_run: bool = False) -> str:
        """
        Import charts from CSV format.

        Args:
            csv_data: CSV data to import
            dry_run: Perform dry run without actual import

        Returns:
            Import status message
        """
        client = cls._get_client()
        return client.import_csv(entity=ChartEntity, csv_data=csv_data, dry_run=dry_run)
