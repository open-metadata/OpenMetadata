#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Domain and Data Product specific operations"""
import traceback
from typing import Dict, List

from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import quote
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


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

    def get_data_product_assets(
        self, name: str, limit: int = 10, offset: int = 0
    ) -> Dict:
        """
        Get paginated list of assets for a data product

        Args:
            name: Name of the data product
            limit: Maximum number of assets to return (default 10, max 1000)
            offset: Offset from which to start returning results (default 0)

        Returns:
            API response as a dictionary containing paginated assets
        """
        try:
            path = f"/dataProducts/name/{quote(name)}/assets"
            params = {"limit": limit, "offset": offset}
            return self.client.get(path, params)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not get data product assets due to {exc}")
            return {}

    def get_domain_assets(self, name: str, limit: int = 10, offset: int = 0) -> Dict:
        """
        Get paginated list of assets for a domain

        Args:
            name: Name of the domain
            limit: Maximum number of assets to return (default 10, max 1000)
            offset: Offset from which to start returning results (default 0)

        Returns:
            API response as a dictionary containing paginated assets
        """
        try:
            path = f"/domains/name/{quote(name)}/assets"
            params = {"limit": limit, "offset": offset}
            return self.client.get(path, params)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not get domain assets due to {exc}")
            return {}

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
        path = f"/dataProducts/{quote(name)}/assets/{operation}"
        payload = AssetsRequest(assets=assets)

        return self.client.put(path, payload.model_dump_json())

    # Input Ports methods

    def add_input_ports_to_data_product(
        self, name: str, ports: List[EntityReference]
    ) -> Dict:
        """
        Add input ports to a data product

        Args:
            name: Name of the data product
            ports: List of entity references to add as input ports

        Returns:
            API response as a dictionary
        """
        return self._handle_data_product_ports(name, ports, "inputPorts", "add")

    def remove_input_ports_from_data_product(
        self, name: str, ports: List[EntityReference]
    ) -> Dict:
        """
        Remove input ports from a data product

        Args:
            name: Name of the data product
            ports: List of entity references to remove from input ports

        Returns:
            API response as a dictionary
        """
        return self._handle_data_product_ports(name, ports, "inputPorts", "remove")

    # Output Ports methods

    def add_output_ports_to_data_product(
        self, name: str, ports: List[EntityReference]
    ) -> Dict:
        """
        Add output ports to a data product

        Args:
            name: Name of the data product
            ports: List of entity references to add as output ports

        Returns:
            API response as a dictionary
        """
        return self._handle_data_product_ports(name, ports, "outputPorts", "add")

    def remove_output_ports_from_data_product(
        self, name: str, ports: List[EntityReference]
    ) -> Dict:
        """
        Remove output ports from a data product

        Args:
            name: Name of the data product
            ports: List of entity references to remove from output ports

        Returns:
            API response as a dictionary
        """
        return self._handle_data_product_ports(name, ports, "outputPorts", "remove")

    def _handle_data_product_ports(
        self,
        name: str,
        ports: List[EntityReference],
        port_type: str,
        operation: str,
    ) -> Dict:
        """
        Handle adding or removing ports from a data product

        Args:
            name: Name of the data product
            ports: List of entity references to add/remove as ports
            port_type: Type of port ("inputPorts" or "outputPorts")
            operation: Operation to perform ("add" or "remove")

        Returns:
            API response as a dictionary
        """
        path = f"/dataProducts/{quote(name)}/{port_type}/{operation}"
        payload = AssetsRequest(assets=ports)

        return self.client.put(path, payload.model_dump_json())
