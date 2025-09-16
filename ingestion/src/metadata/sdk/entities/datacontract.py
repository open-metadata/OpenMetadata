"""
Data Contract entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional

from metadata.generated.schema.entity.data.table import DataModel, Table
from metadata.sdk.entities.base import BaseEntity


class DataContract(BaseEntity):
    """Data Contract operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return Table  # DataContract is part of Table entity

    @classmethod
    def add_data_contract(
        cls, table_id: str, data_model: DataModel, contract_type: str = "SLA"
    ) -> Table:
        """
        Add a data contract to a table.

        Args:
            table_id: Table UUID
            data_model: Data model for the contract
            contract_type: Type of contract (SLA, Schema, etc.)

        Returns:
            Updated Table entity with data contract
        """
        json_patch = [
            {
                "op": "add",
                "path": "/dataModel",
                "value": data_model.dict()
                if hasattr(data_model, "dict")
                else data_model,
            }
        ]
        client = cls._get_client()
        return client.patch(entity=Table, entity_id=table_id, json_patch=json_patch)

    @classmethod
    def update_data_contract(cls, table_id: str, data_model: DataModel) -> Table:
        """
        Update the data contract of a table.

        Args:
            table_id: Table UUID
            data_model: Updated data model

        Returns:
            Updated Table entity
        """
        json_patch = [
            {
                "op": "replace",
                "path": "/dataModel",
                "value": data_model.dict()
                if hasattr(data_model, "dict")
                else data_model,
            }
        ]
        client = cls._get_client()
        return client.patch(entity=Table, entity_id=table_id, json_patch=json_patch)

    @classmethod
    def remove_data_contract(cls, table_id: str) -> Table:
        """
        Remove data contract from a table.

        Args:
            table_id: Table UUID

        Returns:
            Updated Table entity
        """
        json_patch = [{"op": "remove", "path": "/dataModel"}]
        client = cls._get_client()
        return client.patch(entity=Table, entity_id=table_id, json_patch=json_patch)

    @classmethod
    def get_data_contract(cls, table_id: str) -> Optional[DataModel]:
        """
        Get the data contract of a table.

        Args:
            table_id: Table UUID

        Returns:
            DataModel if exists, None otherwise
        """
        client = cls._get_client()
        table = client.get_by_id(entity=Table, entity_id=table_id, fields=["dataModel"])
        return table.dataModel if hasattr(table, "dataModel") else None

    @classmethod
    def validate_data_contract(cls, table_id: str, data: dict) -> bool:
        """
        Validate data against a table's data contract.

        Args:
            table_id: Table UUID
            data: Data to validate

        Returns:
            True if valid, False otherwise
        """
        contract = cls.get_data_contract(table_id)
        if not contract:
            return True  # No contract means no validation needed

        # Basic validation logic (can be extended)
        if hasattr(contract, "columns"):
            required_columns = [
                col.name for col in contract.columns if col.constraint == "NOT_NULL"
            ]
            for col in required_columns:
                if col not in data:
                    return False

        return True

    @classmethod
    def list_tables_with_contracts(cls, limit: int = 100) -> List[Table]:
        """
        List all tables that have data contracts.

        Args:
            limit: Number of results

        Returns:
            List of Table entities with data contracts
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=Table,
            fields=["dataModel"],
            limit=limit,
        )

        # Filter tables with data contracts
        if response and response.entities:
            return [
                table
                for table in response.entities
                if hasattr(table, "dataModel") and table.dataModel
            ]
        return []
