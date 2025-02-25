from typing import Dict, List

from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.ometa.client import REST


class AssetsRequest(BaseModel):
    """Request to add assets to a data product"""

    assets: List[EntityReference]


class OMetaDomainMixin:
    """Mixin class containing Data Product specific methods"""

    client: REST

    def add_assets_to_data_product(
        self, name: str, assets: List[EntityReference]
    ) -> Dict:
        """
        Add assets to a data product

        Args:
            name: Name of the data product
            assets: List of entity references to add as assets

        Returns:
            API response as a dictionary
        """
        return self._handle_data_product_assets(name, assets, "add")

    def remove_assets_from_data_product(
        self, name: str, assets: List[EntityReference]
    ) -> Dict:
        """
        Remove assets from a data product

        Args:
            name: Name of the data product
            assets: List of entity references to remove from assets

        Returns:
            API response as a dictionary
        """
        return self._handle_data_product_assets(name, assets, "remove")

    def _handle_data_product_assets(
        self,
        name: str,
        assets: List[EntityReference],
        operation: str,
    ) -> Dict:
        """
        Handle adding or removing assets from a data product

        Args:
            name: Name of the data product
            assets: List of entity references to add/remove
            operation: Operation to perform ("add" or "remove")

        Returns:
            API response as a dictionary
        """
        path = f"/dataProducts/{name}/assets/{operation}"
        payload = AssetsRequest(assets=assets)

        return self.client.put(path, payload.model_dump_json())
