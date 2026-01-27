"""
DataProducts entity SDK with fluent API
"""
from typing import Any, Dict, List, Type, cast

from metadata.generated.schema.api.domains.createDataProduct import (
    CreateDataProductRequest,
)
from metadata.generated.schema.entity.domains.dataProduct import DataProduct
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.entities.base import BaseEntity


class DataProducts(BaseEntity[DataProduct, CreateDataProductRequest]):
    """DataProducts SDK class - plural to avoid conflict with generated DataProduct entity"""

    @classmethod
    def entity_type(cls) -> Type[DataProduct]:
        """Return the DataProduct entity type"""
        return DataProduct

    # ------------------------------------------------------------------
    # Input Ports operations
    # ------------------------------------------------------------------
    @classmethod
    def add_input_ports(cls, name: str, ports: List[EntityReference]) -> Dict[str, Any]:
        """
        Add input ports to a data product.

        Args:
            name: Fully qualified name of the data product
            ports: List of entity references to add as input ports

        Returns:
            BulkOperationResult as a dictionary
        """
        return cls._handle_ports_operation(name, ports, "inputPorts", "add")

    @classmethod
    def remove_input_ports(
        cls, name: str, ports: List[EntityReference]
    ) -> Dict[str, Any]:
        """
        Remove input ports from a data product.

        Args:
            name: Fully qualified name of the data product
            ports: List of entity references to remove from input ports

        Returns:
            BulkOperationResult as a dictionary
        """
        return cls._handle_ports_operation(name, ports, "inputPorts", "remove")

    # ------------------------------------------------------------------
    # Output Ports operations
    # ------------------------------------------------------------------
    @classmethod
    def add_output_ports(
        cls, name: str, ports: List[EntityReference]
    ) -> Dict[str, Any]:
        """
        Add output ports to a data product.

        Args:
            name: Fully qualified name of the data product
            ports: List of entity references to add as output ports

        Returns:
            BulkOperationResult as a dictionary
        """
        return cls._handle_ports_operation(name, ports, "outputPorts", "add")

    @classmethod
    def remove_output_ports(
        cls, name: str, ports: List[EntityReference]
    ) -> Dict[str, Any]:
        """
        Remove output ports from a data product.

        Args:
            name: Fully qualified name of the data product
            ports: List of entity references to remove from output ports

        Returns:
            BulkOperationResult as a dictionary
        """
        return cls._handle_ports_operation(name, ports, "outputPorts", "remove")

    # ------------------------------------------------------------------
    # Assets operations
    # ------------------------------------------------------------------
    @classmethod
    def add_assets(cls, name: str, assets: List[EntityReference]) -> Dict[str, Any]:
        """
        Add assets to a data product.

        Args:
            name: Fully qualified name of the data product
            assets: List of entity references to add as assets

        Returns:
            BulkOperationResult as a dictionary
        """
        return cls._handle_assets_operation(name, assets, "add")

    @classmethod
    def remove_assets(cls, name: str, assets: List[EntityReference]) -> Dict[str, Any]:
        """
        Remove assets from a data product.

        Args:
            name: Fully qualified name of the data product
            assets: List of entity references to remove from assets

        Returns:
            BulkOperationResult as a dictionary
        """
        return cls._handle_assets_operation(name, assets, "remove")

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------
    @classmethod
    def _handle_ports_operation(
        cls,
        name: str,
        ports: List[EntityReference],
        port_type: str,
        operation: str,
    ) -> Dict[str, Any]:
        """
        Handle adding or removing ports from a data product.

        Args:
            name: Fully qualified name of the data product
            ports: List of entity references to add/remove as ports
            port_type: Type of port ("inputPorts" or "outputPorts")
            operation: Operation to perform ("add" or "remove")

        Returns:
            BulkOperationResult as a dictionary
        """
        client = cls._get_client()
        rest_client = cls._get_rest_client(client)
        path = f"/dataProducts/{name}/{port_type}/{operation}"
        payload = {
            "assets": [
                port.model_dump(mode="json", exclude_none=True)  # type: ignore[misc]
                for port in ports
            ]
        }
        response = rest_client.put(path, json=payload)
        return cast(Dict[str, Any], response)

    @classmethod
    def _handle_assets_operation(
        cls,
        name: str,
        assets: List[EntityReference],
        operation: str,
    ) -> Dict[str, Any]:
        """
        Handle adding or removing assets from a data product.

        Args:
            name: Fully qualified name of the data product
            assets: List of entity references to add/remove as assets
            operation: Operation to perform ("add" or "remove")

        Returns:
            BulkOperationResult as a dictionary
        """
        client = cls._get_client()
        rest_client = cls._get_rest_client(client)
        path = f"/dataProducts/{name}/assets/{operation}"
        payload = {
            "assets": [
                asset.model_dump(mode="json", exclude_none=True)  # type: ignore[misc]
                for asset in assets
            ]
        }
        response = rest_client.put(path, json=payload)
        return cast(Dict[str, Any], response)
