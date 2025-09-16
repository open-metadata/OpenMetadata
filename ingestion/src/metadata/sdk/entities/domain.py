"""
Domain entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional

from metadata.generated.schema.api.domains.createDomain import CreateDomainRequest
from metadata.generated.schema.entity.domains.domain import Domain as DomainEntity
from metadata.sdk.entities.base import BaseEntity


class Domain(BaseEntity):
    """Domain entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return DomainEntity

    @classmethod
    def create(cls, request: CreateDomainRequest) -> DomainEntity:
        """
        Create a new domain.

        Args:
            request: CreateDomainRequest with domain details

        Returns:
            Created Domain entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> DomainEntity:
        """
        Retrieve a domain by ID.

        Args:
            entity_id: Domain UUID
            fields: Optional list of fields to include

        Returns:
            Domain entity
        """
        client = cls._get_client()
        return client.get_by_id(entity=DomainEntity, entity_id=entity_id, fields=fields)

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> DomainEntity:
        """
        Retrieve a domain by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            Domain entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=DomainEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity_id: str, entity: DomainEntity) -> DomainEntity:
        """
        Update a domain (PUT operation).

        Args:
            entity_id: Domain UUID
            entity: Updated Domain entity

        Returns:
            Updated Domain entity
        """
        entity.id = entity_id
        client = cls._get_client()
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> DomainEntity:
        """
        Patch a domain (PATCH operation).

        Args:
            entity_id: Domain UUID
            json_patch: JSON patch operations

        Returns:
            Patched Domain entity
        """
        client = cls._get_client()
        return client.patch(
            entity=DomainEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a domain.

        Args:
            entity_id: Domain UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=DomainEntity,
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
    ) -> List[DomainEntity]:
        """
        List domains.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of Domain entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=DomainEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []

    # ============= Asset Management Methods =============

    @classmethod
    def add_assets(
        cls, domain_id: str, asset_ids: List[str], asset_type: str = "table"
    ) -> DomainEntity:
        """
        Add assets to a domain.

        Args:
            domain_id: Domain UUID
            asset_ids: List of asset UUIDs to add
            asset_type: Type of assets (table, dashboard, pipeline, etc.)

        Returns:
            Updated Domain entity
        """
        json_patch = []
        for asset_id in asset_ids:
            json_patch.append(
                {
                    "op": "add",
                    "path": "/assets/-",
                    "value": {"id": asset_id, "type": asset_type},
                }
            )
        return cls.patch(domain_id, json_patch)

    @classmethod
    def remove_assets(cls, domain_id: str, asset_ids: List[str]) -> DomainEntity:
        """
        Remove assets from a domain.

        Args:
            domain_id: Domain UUID
            asset_ids: List of asset UUIDs to remove

        Returns:
            Updated Domain entity
        """
        domain = cls.retrieve(domain_id, fields=["assets"])

        json_patch = []
        if hasattr(domain, "assets") and domain.assets:
            for asset_id in asset_ids:
                for i, asset in enumerate(domain.assets):
                    if str(asset.id) == asset_id:
                        json_patch.append({"op": "remove", "path": f"/assets/{i}"})
                        break

        return cls.patch(domain_id, json_patch) if json_patch else domain

    @classmethod
    def add_data_products(
        cls, domain_id: str, data_product_ids: List[str]
    ) -> DomainEntity:
        """
        Add data products to a domain.

        Args:
            domain_id: Domain UUID
            data_product_ids: List of data product UUIDs

        Returns:
            Updated Domain entity
        """
        json_patch = []
        for dp_id in data_product_ids:
            json_patch.append(
                {"op": "add", "path": "/dataProducts/-", "value": {"id": dp_id}}
            )
        return cls.patch(domain_id, json_patch)

    @classmethod
    def remove_data_products(
        cls, domain_id: str, data_product_ids: List[str]
    ) -> DomainEntity:
        """
        Remove data products from a domain.

        Args:
            domain_id: Domain UUID
            data_product_ids: List of data product UUIDs to remove

        Returns:
            Updated Domain entity
        """
        domain = cls.retrieve(domain_id, fields=["dataProducts"])

        json_patch = []
        if hasattr(domain, "dataProducts") and domain.dataProducts:
            for dp_id in data_product_ids:
                for i, dp in enumerate(domain.dataProducts):
                    if str(dp.id) == dp_id:
                        json_patch.append(
                            {"op": "remove", "path": f"/dataProducts/{i}"}
                        )
                        break

        return cls.patch(domain_id, json_patch) if json_patch else domain

    @classmethod
    def add_experts(cls, domain_id: str, user_ids: List[str]) -> DomainEntity:
        """
        Add domain experts (users).

        Args:
            domain_id: Domain UUID
            user_ids: List of user UUIDs to add as experts

        Returns:
            Updated Domain entity
        """
        json_patch = []
        for user_id in user_ids:
            json_patch.append(
                {
                    "op": "add",
                    "path": "/experts/-",
                    "value": {"id": user_id, "type": "user"},
                }
            )
        return cls.patch(domain_id, json_patch)

    @classmethod
    def remove_experts(cls, domain_id: str, user_ids: List[str]) -> DomainEntity:
        """
        Remove domain experts.

        Args:
            domain_id: Domain UUID
            user_ids: List of user UUIDs to remove

        Returns:
            Updated Domain entity
        """
        domain = cls.retrieve(domain_id, fields=["experts"])

        json_patch = []
        if hasattr(domain, "experts") and domain.experts:
            for user_id in user_ids:
                for i, expert in enumerate(domain.experts):
                    if str(expert.id) == user_id:
                        json_patch.append({"op": "remove", "path": f"/experts/{i}"})
                        break

        return cls.patch(domain_id, json_patch) if json_patch else domain

    @classmethod
    def get_domain_assets(
        cls, domain_id: str, asset_type: Optional[str] = None
    ) -> List:
        """
        Get all assets in a domain.

        Args:
            domain_id: Domain UUID
            asset_type: Optional filter by asset type

        Returns:
            List of assets
        """
        domain = cls.retrieve(domain_id, fields=["assets"])

        if not hasattr(domain, "assets") or not domain.assets:
            return []

        if asset_type:
            return [asset for asset in domain.assets if asset.type == asset_type]

        return domain.assets

    @classmethod
    def get_domain_data_products(cls, domain_id: str) -> List:
        """
        Get all data products in a domain.

        Args:
            domain_id: Domain UUID

        Returns:
            List of data products
        """
        domain = cls.retrieve(domain_id, fields=["dataProducts"])
        return domain.dataProducts if hasattr(domain, "dataProducts") else []

    @classmethod
    def get_domain_experts(cls, domain_id: str) -> List:
        """
        Get all experts for a domain.

        Args:
            domain_id: Domain UUID

        Returns:
            List of experts (users)
        """
        domain = cls.retrieve(domain_id, fields=["experts"])
        return domain.experts if hasattr(domain, "experts") else []

    @classmethod
    def set_parent_domain(cls, domain_id: str, parent_domain_id: str) -> DomainEntity:
        """
        Set parent domain for hierarchical organization.

        Args:
            domain_id: Domain UUID
            parent_domain_id: Parent domain UUID

        Returns:
            Updated Domain entity
        """
        json_patch = [
            {
                "op": "add",
                "path": "/parent",
                "value": {"id": parent_domain_id, "type": "domain"},
            }
        ]
        return cls.patch(domain_id, json_patch)

    @classmethod
    def add_subdomain(cls, parent_domain_id: str, subdomain_id: str) -> DomainEntity:
        """
        Add a subdomain to a parent domain.

        Args:
            parent_domain_id: Parent domain UUID
            subdomain_id: Subdomain UUID to add

        Returns:
            Updated parent Domain entity
        """
        json_patch = [
            {
                "op": "add",
                "path": "/children/-",
                "value": {"id": subdomain_id, "type": "domain"},
            }
        ]
        return cls.patch(parent_domain_id, json_patch)
