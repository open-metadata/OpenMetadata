"""
Metric entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional, Union

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.metric import Metric as MetricEntity
from metadata.sdk.entities.base import BaseEntity


class Metric(BaseEntity):
    """Metric entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return MetricEntity

    @classmethod
    def create(cls, request: CreateMetricRequest) -> MetricEntity:
        """
        Create a new metric.

        Args:
            request: CreateMetricRequest with metric details

        Returns:
            Created Metric entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> MetricEntity:
        """
        Retrieve a metric by ID.

        Args:
            entity_id: Metric UUID
            fields: Optional list of fields to include

        Returns:
            Metric entity
        """
        client = cls._get_client()
        return client.get_by_id(entity=MetricEntity, entity_id=entity_id, fields=fields)

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> MetricEntity:
        """
        Retrieve a metric by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            Metric entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=MetricEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity_id: str, metric: MetricEntity) -> MetricEntity:
        """
        Update a metric (PUT operation).

        Args:
            entity_id: Metric UUID
            metric: Updated Metric entity

        Returns:
            Updated Metric entity
        """
        metric.id = entity_id
        client = cls._get_client()
        return client.create_or_update(metric)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> MetricEntity:
        """
        Patch a metric (PATCH operation).

        Args:
            entity_id: Metric UUID
            json_patch: JSON patch operations

        Returns:
            Patched Metric entity
        """
        client = cls._get_client()
        return client.patch(
            entity=MetricEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a metric.

        Args:
            entity_id: Metric UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=MetricEntity,
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
    ) -> List[MetricEntity]:
        """
        List metrics.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of Metric entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=MetricEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []

    @classmethod
    def add_followers(cls, entity_id: str, user_ids: List[str]) -> MetricEntity:
        """
        Add followers to a metric.

        Args:
            entity_id: Metric UUID
            user_ids: List of user UUIDs to add as followers

        Returns:
            Updated Metric entity
        """
        client = cls._get_client()
        return client.add_followers(
            entity=MetricEntity, entity_id=entity_id, user_ids=user_ids
        )

    @classmethod
    def remove_followers(cls, entity_id: str, user_ids: List[str]) -> MetricEntity:
        """
        Remove followers from a metric.

        Args:
            entity_id: Metric UUID
            user_ids: List of user UUIDs to remove as followers

        Returns:
            Updated Metric entity
        """
        client = cls._get_client()
        return client.remove_followers(
            entity=MetricEntity, entity_id=entity_id, user_ids=user_ids
        )

    @classmethod
    def get_versions(cls, entity_id: str) -> List[MetricEntity]:
        """
        Get all versions of a metric.

        Args:
            entity_id: Metric UUID

        Returns:
            List of Metric versions
        """
        client = cls._get_client()
        return client.get_entity_versions(entity=MetricEntity, entity_id=entity_id)

    @classmethod
    def get_version(cls, entity_id: str, version: Union[str, float]) -> MetricEntity:
        """
        Get a specific version of a metric.

        Args:
            entity_id: Metric UUID
            version: Version number or 'latest'

        Returns:
            Metric entity at specified version
        """
        client = cls._get_client()
        return client.get_entity_version(
            entity=MetricEntity, entity_id=entity_id, version=version
        )

    @classmethod
    def restore(cls, entity_id: str) -> MetricEntity:
        """
        Restore a soft-deleted metric.

        Args:
            entity_id: Metric UUID

        Returns:
            Restored Metric entity
        """
        client = cls._get_client()
        return client.restore_entity(entity=MetricEntity, entity_id=entity_id)

    @classmethod
    def export_csv(cls, name: str) -> str:
        """
        Export metrics to CSV format.

        Args:
            name: Export name

        Returns:
            CSV data as string
        """
        client = cls._get_client()
        return client.export_csv(entity=MetricEntity, name=name)

    @classmethod
    def import_csv(cls, csv_data: str, dry_run: bool = False) -> str:
        """
        Import metrics from CSV format.

        Args:
            csv_data: CSV data to import
            dry_run: Perform dry run without actual import

        Returns:
            Import status message
        """
        client = cls._get_client()
        return client.import_csv(
            entity=MetricEntity, csv_data=csv_data, dry_run=dry_run
        )

    @classmethod
    def add_related_metrics(
        cls, entity_id: str, related_metric_ids: List[str]
    ) -> MetricEntity:
        """
        Add related metrics to a metric.

        Args:
            entity_id: Metric UUID
            related_metric_ids: List of related metric UUIDs

        Returns:
            Updated Metric entity
        """
        json_patch = [
            {"op": "add", "path": "/relatedMetrics/-", "value": {"id": metric_id}}
            for metric_id in related_metric_ids
        ]
        return cls.patch(entity_id, json_patch)

    @classmethod
    def update_metric_type(cls, entity_id: str, metric_type: str) -> MetricEntity:
        """
        Update metric type.

        Args:
            entity_id: Metric UUID
            metric_type: New metric type

        Returns:
            Updated Metric entity
        """
        json_patch = [{"op": "replace", "path": "/metricType", "value": metric_type}]
        return cls.patch(entity_id, json_patch)
