"""
Data Product entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional

from metadata.generated.schema.api.domains.createDataProduct import (
    CreateDataProductRequest,
)
from metadata.generated.schema.entity.domains.dataProduct import (
    DataProduct as DataProductEntity,
)
from metadata.sdk.entities.base import BaseEntity


class DataProduct(BaseEntity):
    """Data Product entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return DataProductEntity

    @classmethod
    def create(cls, request: CreateDataProductRequest) -> DataProductEntity:
        """
        Create a new data product.

        Args:
            request: CreateDataProductRequest with data product details

        Returns:
            Created DataProduct entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> DataProductEntity:
        """
        Retrieve a data product by ID.

        Args:
            entity_id: DataProduct UUID
            fields: Optional list of fields to include

        Returns:
            DataProduct entity
        """
        client = cls._get_client()
        return client.get_by_id(
            entity=DataProductEntity, entity_id=entity_id, fields=fields
        )

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> DataProductEntity:
        """
        Retrieve a data product by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            DataProduct entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=DataProductEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity_id: str, entity: DataProductEntity) -> DataProductEntity:
        """
        Update a data product (PUT operation).

        Args:
            entity_id: DataProduct UUID
            entity: Updated DataProduct entity

        Returns:
            Updated DataProduct entity
        """
        entity.id = entity_id
        client = cls._get_client()
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> DataProductEntity:
        """
        Patch a data product (PATCH operation).

        Args:
            entity_id: DataProduct UUID
            json_patch: JSON patch operations

        Returns:
            Patched DataProduct entity
        """
        client = cls._get_client()
        return client.patch(
            entity=DataProductEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a data product.

        Args:
            entity_id: DataProduct UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=DataProductEntity,
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
    ) -> List[DataProductEntity]:
        """
        List data products.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of DataProduct entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=DataProductEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []

    # ============= Asset Management Methods =============

    @classmethod
    def add_assets(
        cls,
        data_product_id: str,
        asset_ids: List[str],
        asset_types: Optional[List[str]] = None,
    ) -> DataProductEntity:
        """
        Add assets to a data product.

        Args:
            data_product_id: DataProduct UUID
            asset_ids: List of asset UUIDs to add
            asset_types: Optional list of asset types corresponding to asset_ids

        Returns:
            Updated DataProduct entity
        """
        json_patch = []
        for i, asset_id in enumerate(asset_ids):
            asset_type = (
                asset_types[i] if asset_types and i < len(asset_types) else "table"
            )
            json_patch.append(
                {
                    "op": "add",
                    "path": "/assets/-",
                    "value": {"id": asset_id, "type": asset_type},
                }
            )
        return cls.patch(data_product_id, json_patch)

    @classmethod
    def remove_assets(
        cls, data_product_id: str, asset_ids: List[str]
    ) -> DataProductEntity:
        """
        Remove assets from a data product.

        Args:
            data_product_id: DataProduct UUID
            asset_ids: List of asset UUIDs to remove

        Returns:
            Updated DataProduct entity
        """
        data_product = cls.retrieve(data_product_id, fields=["assets"])

        json_patch = []
        if hasattr(data_product, "assets") and data_product.assets:
            for asset_id in asset_ids:
                for i, asset in enumerate(data_product.assets):
                    if str(asset.id) == asset_id:
                        json_patch.append({"op": "remove", "path": f"/assets/{i}"})
                        break

        return cls.patch(data_product_id, json_patch) if json_patch else data_product

    @classmethod
    def set_domain(cls, data_product_id: str, domain_id: str) -> DataProductEntity:
        """
        Set the domain for a data product.

        Args:
            data_product_id: DataProduct UUID
            domain_id: Domain UUID

        Returns:
            Updated DataProduct entity
        """
        json_patch = [
            {
                "op": "add",
                "path": "/domain",
                "value": {"id": domain_id, "type": "domain"},
            }
        ]
        return cls.patch(data_product_id, json_patch)

    @classmethod
    def add_owners(
        cls, data_product_id: str, owner_ids: List[str], owner_type: str = "user"
    ) -> DataProductEntity:
        """
        Add owners to a data product.

        Args:
            data_product_id: DataProduct UUID
            owner_ids: List of owner UUIDs
            owner_type: Type of owner (user or team)

        Returns:
            Updated DataProduct entity
        """
        json_patch = []
        for owner_id in owner_ids:
            json_patch.append(
                {
                    "op": "add",
                    "path": "/owners/-",
                    "value": {"id": owner_id, "type": owner_type},
                }
            )
        return cls.patch(data_product_id, json_patch)

    @classmethod
    def remove_owners(
        cls, data_product_id: str, owner_ids: List[str]
    ) -> DataProductEntity:
        """
        Remove owners from a data product.

        Args:
            data_product_id: DataProduct UUID
            owner_ids: List of owner UUIDs to remove

        Returns:
            Updated DataProduct entity
        """
        data_product = cls.retrieve(data_product_id, fields=["owners"])

        json_patch = []
        if hasattr(data_product, "owners") and data_product.owners:
            for owner_id in owner_ids:
                for i, owner in enumerate(data_product.owners):
                    if str(owner.id) == owner_id:
                        json_patch.append({"op": "remove", "path": f"/owners/{i}"})
                        break

        return cls.patch(data_product_id, json_patch) if json_patch else data_product

    @classmethod
    def get_assets(cls, data_product_id: str, asset_type: Optional[str] = None) -> List:
        """
        Get all assets in a data product.

        Args:
            data_product_id: DataProduct UUID
            asset_type: Optional filter by asset type

        Returns:
            List of assets
        """
        data_product = cls.retrieve(data_product_id, fields=["assets"])

        if not hasattr(data_product, "assets") or not data_product.assets:
            return []

        if asset_type:
            return [asset for asset in data_product.assets if asset.type == asset_type]

        return data_product.assets

    @classmethod
    def add_experts(
        cls, data_product_id: str, expert_ids: List[str]
    ) -> DataProductEntity:
        """
        Add experts to a data product.

        Args:
            data_product_id: DataProduct UUID
            expert_ids: List of user UUIDs to add as experts

        Returns:
            Updated DataProduct entity
        """
        json_patch = []
        for expert_id in expert_ids:
            json_patch.append(
                {
                    "op": "add",
                    "path": "/experts/-",
                    "value": {"id": expert_id, "type": "user"},
                }
            )
        return cls.patch(data_product_id, json_patch)

    @classmethod
    def add_tables(
        cls, data_product_id: str, table_ids: List[str]
    ) -> DataProductEntity:
        """
        Add tables to a data product.

        Args:
            data_product_id: DataProduct UUID
            table_ids: List of table UUIDs

        Returns:
            Updated DataProduct entity
        """
        return cls.add_assets(data_product_id, table_ids, ["table"] * len(table_ids))

    @classmethod
    def add_dashboards(
        cls, data_product_id: str, dashboard_ids: List[str]
    ) -> DataProductEntity:
        """
        Add dashboards to a data product.

        Args:
            data_product_id: DataProduct UUID
            dashboard_ids: List of dashboard UUIDs

        Returns:
            Updated DataProduct entity
        """
        return cls.add_assets(
            data_product_id, dashboard_ids, ["dashboard"] * len(dashboard_ids)
        )

    @classmethod
    def add_pipelines(
        cls, data_product_id: str, pipeline_ids: List[str]
    ) -> DataProductEntity:
        """
        Add pipelines to a data product.

        Args:
            data_product_id: DataProduct UUID
            pipeline_ids: List of pipeline UUIDs

        Returns:
            Updated DataProduct entity
        """
        return cls.add_assets(
            data_product_id, pipeline_ids, ["pipeline"] * len(pipeline_ids)
        )

    @classmethod
    def add_metrics(
        cls, data_product_id: str, metric_ids: List[str]
    ) -> DataProductEntity:
        """
        Add metrics to a data product.

        Args:
            data_product_id: DataProduct UUID
            metric_ids: List of metric UUIDs

        Returns:
            Updated DataProduct entity
        """
        return cls.add_assets(data_product_id, metric_ids, ["metric"] * len(metric_ids))
