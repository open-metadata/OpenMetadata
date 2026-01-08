"""
DataContracts entity SDK with fluent API for ODCS import/export
"""
from dataclasses import dataclass, field
from typing import Any, Optional, Type, cast

from metadata.generated.schema.api.data.createDataContract import (
    CreateDataContractRequest,
)
from metadata.generated.schema.entity.data.dataContract import DataContract
from metadata.generated.schema.entity.datacontract.odcs.odcsDataContract import (
    ODCSDataContract,
)
from metadata.sdk.entities.base import BaseEntity
from metadata.sdk.types import OMetaClient, UuidLike


@dataclass
class ODCSExportOperation:
    """Fluent helper for exporting DataContracts to ODCS format.

    Example:
        >>> # Export by ID
        >>> odcs = DataContracts.export_odcs(contract_id).execute()

        >>> # Export by FQN
        >>> odcs = DataContracts.export_odcs_by_name("service.db.schema.table").execute()

        >>> # Export as YAML
        >>> yaml_str = DataContracts.export_odcs(contract_id).as_yaml().execute()
    """

    client: OMetaClient
    identifier: str
    by_name: bool = False
    yaml_format: bool = field(default=False, init=False)

    def as_yaml(self) -> "ODCSExportOperation":
        """Export in YAML format instead of JSON."""
        self.yaml_format = True
        return self

    def as_json(self) -> "ODCSExportOperation":
        """Export in JSON format (default)."""
        self.yaml_format = False
        return self

    def execute(self) -> Any:
        """Execute the export and return ODCSDataContract or YAML string."""
        rest_client = getattr(self.client, "client", None)
        if rest_client is None:
            raise RuntimeError("OpenMetadata client does not expose a REST interface")

        suffix = cast(str, self.client.get_suffix(DataContract))
        path_segment = f"name/{self.identifier}" if self.by_name else self.identifier

        if self.yaml_format:
            endpoint = f"{suffix}/{path_segment}/odcs/yaml"
            resp = rest_client.get(endpoint)
            if resp:
                if hasattr(resp, "text"):
                    return resp.text
                if isinstance(resp, str):
                    return resp
            return None

        endpoint = f"{suffix}/{path_segment}/odcs"
        resp = rest_client.get(endpoint)
        if resp:
            return ODCSDataContract(**resp)
        return None


@dataclass
class ODCSImportOperation:
    """Fluent helper for importing DataContracts from ODCS format.

    Example:
        >>> # Import from ODCSDataContract object
        >>> contract = (DataContracts.import_odcs(table_id, "table")
        ...     .from_odcs(odcs_contract)
        ...     .execute())

        >>> # Import from YAML string
        >>> contract = (DataContracts.import_odcs(table_id, "table")
        ...     .from_yaml(yaml_content)
        ...     .execute())

        >>> # Smart merge (update existing contract)
        >>> contract = (DataContracts.import_odcs(table_id, "table")
        ...     .from_odcs(odcs_contract)
        ...     .merge()
        ...     .execute())
    """

    client: OMetaClient
    entity_id: str
    entity_type: str
    odcs_data: Optional[ODCSDataContract] = None
    yaml_data: Optional[str] = None
    smart_merge: bool = field(default=False, init=False)

    def from_odcs(self, odcs: ODCSDataContract) -> "ODCSImportOperation":
        """Set the ODCS contract to import."""
        self.odcs_data = odcs
        self.yaml_data = None
        return self

    def from_yaml(self, yaml_content: str) -> "ODCSImportOperation":
        """Set the YAML content to import."""
        self.yaml_data = yaml_content
        self.odcs_data = None
        return self

    def merge(self) -> "ODCSImportOperation":
        """Enable smart merge mode (updates existing contract, preserves non-ODCS fields)."""
        self.smart_merge = True
        return self

    def create_new(self) -> "ODCSImportOperation":
        """Create new contract (fails if contract already exists)."""
        self.smart_merge = False
        return self

    def execute(self) -> Optional[DataContract]:
        """Execute the import and return the created/updated DataContract."""
        if self.odcs_data is None and self.yaml_data is None:
            raise ValueError("Must call from_odcs() or from_yaml() before execute()")

        rest_client = getattr(self.client, "client", None)
        if rest_client is None:
            raise RuntimeError("OpenMetadata client does not expose a REST interface")

        suffix = cast(str, self.client.get_suffix(DataContract))
        query_params = f"entityId={self.entity_id}&entityType={self.entity_type}"
        method = rest_client.put if self.smart_merge else rest_client.post

        if self.yaml_data is not None:
            endpoint = f"{suffix}/odcs/yaml?{query_params}"
            resp = method(
                endpoint,
                data=self.yaml_data,
                headers={"Content-Type": "application/x-yaml"},
            )
        else:
            endpoint = f"{suffix}/odcs?{query_params}"
            resp = method(
                endpoint,
                data=self.odcs_data.model_dump_json(by_alias=True, exclude_none=True),
            )

        if resp:
            return DataContract(**resp)
        return None


class DataContracts(BaseEntity[DataContract, CreateDataContractRequest]):
    """DataContracts SDK class with fluent ODCS import/export support.

    Example usage:
        >>> from metadata.sdk import configure, DataContracts

        >>> # Configure the SDK
        >>> configure(host="http://localhost:8585/api", jwt_token="token")

        >>> # Export existing contract to ODCS
        >>> odcs = DataContracts.export_odcs(contract_id).execute()
        >>> yaml_str = DataContracts.export_odcs(contract_id).as_yaml().execute()

        >>> # Export by FQN
        >>> odcs = DataContracts.export_odcs_by_name("service.db.schema.table").execute()

        >>> # Import ODCS contract (creates new)
        >>> contract = (DataContracts.import_odcs(table_id, "table")
        ...     .from_odcs(odcs_contract)
        ...     .execute())

        >>> # Smart merge (updates existing, preserves non-ODCS fields)
        >>> contract = (DataContracts.import_odcs(table_id, "table")
        ...     .from_yaml(yaml_content)
        ...     .merge()
        ...     .execute())
    """

    @classmethod
    def entity_type(cls) -> Type[DataContract]:
        """Return the DataContract entity type"""
        return DataContract

    @classmethod
    def export_odcs(cls, contract_id: UuidLike) -> ODCSExportOperation:
        """Export a DataContract to ODCS format.

        Args:
            contract_id: UUID of the data contract to export

        Returns:
            ODCSExportOperation for fluent configuration

        Example:
            >>> odcs = DataContracts.export_odcs(contract_id).execute()
            >>> yaml_str = DataContracts.export_odcs(contract_id).as_yaml().execute()
        """
        client = cls._get_client()
        return ODCSExportOperation(
            client=client,
            identifier=cls._stringify_identifier(contract_id),
            by_name=False,
        )

    @classmethod
    def export_odcs_by_name(cls, fqn: str) -> ODCSExportOperation:
        """Export a DataContract to ODCS format by fully qualified name.

        Args:
            fqn: Fully qualified name of the data contract

        Returns:
            ODCSExportOperation for fluent configuration

        Example:
            >>> odcs = DataContracts.export_odcs_by_name("service.db.schema.table").execute()
        """
        client = cls._get_client()
        return ODCSExportOperation(
            client=client,
            identifier=fqn,
            by_name=True,
        )

    @classmethod
    def import_odcs(cls, entity_id: UuidLike, entity_type: str) -> ODCSImportOperation:
        """Import a DataContract from ODCS format.

        Args:
            entity_id: UUID of the entity (table/topic) to attach the contract to
            entity_type: Type of the entity (e.g., 'table', 'topic')

        Returns:
            ODCSImportOperation for fluent configuration

        Example:
            >>> # Create new contract from ODCS
            >>> contract = (DataContracts.import_odcs(table_id, "table")
            ...     .from_odcs(odcs_contract)
            ...     .execute())

            >>> # Import from YAML with smart merge
            >>> contract = (DataContracts.import_odcs(table_id, "table")
            ...     .from_yaml(yaml_content)
            ...     .merge()
            ...     .execute())
        """
        client = cls._get_client()
        return ODCSImportOperation(
            client=client,
            entity_id=cls._stringify_identifier(entity_id),
            entity_type=entity_type,
        )
