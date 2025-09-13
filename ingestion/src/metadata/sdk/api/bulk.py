"""
Bulk API with fluent interface
"""
import asyncio
from enum import Enum
from typing import ClassVar, Dict, List, Optional, Union

from metadata.ingestion.ometa.ometa_api import OpenMetadata as OMeta
from metadata.sdk.client import OpenMetadata


class BulkOperationType(Enum):
    """Type of bulk operation"""

    IMPORT_CSV = "import_csv"
    EXPORT_CSV = "export_csv"
    ADD_ASSETS = "add_assets"
    PATCH = "patch"
    DELETE = "delete"
    RESTORE = "restore"


class Bulk:
    """Static fluent API for bulk operations"""

    _default_client: ClassVar[Optional[OMeta]] = None

    @classmethod
    def set_default_client(cls, client: Union[OpenMetadata, OMeta]):
        """Set the default client for static methods"""
        if isinstance(client, OpenMetadata):
            cls._default_client = client.ometa
        else:
            cls._default_client = client

    @classmethod
    def _get_client(cls) -> OMeta:
        """Get the default client"""
        if cls._default_client is None:
            cls._default_client = OpenMetadata.get_default_client()
        return cls._default_client

    @classmethod
    def import_csv(
        cls,
        entity_type: str,
        csv_data: str,
        dry_run: bool = False,
    ) -> Dict:
        """Import entities from CSV"""
        client = cls._get_client()
        return client.import_csv(
            entity_type=entity_type, csv_data=csv_data, dry_run=dry_run
        )

    @classmethod
    def export_csv(
        cls,
        entity_type: str,
        name: Optional[str] = None,
    ) -> str:
        """Export entities to CSV"""
        client = cls._get_client()
        return client.export_csv(entity_type=entity_type, name=name)

    @classmethod
    def add_assets(
        cls,
        entity_type: str,
        assets: List[Dict],
    ) -> List[Dict]:
        """Bulk add assets"""
        client = cls._get_client()
        results = []
        for asset in assets:
            result = client.create_or_update(asset)
            results.append(
                result.dict() if hasattr(result, "dict") else result.__dict__
            )
        return results

    @classmethod
    def patch(
        cls,
        entity_type: str,
        patches: List[Dict],
    ) -> List[Dict]:
        """Bulk patch entities"""
        client = cls._get_client()
        results = []
        for patch in patches:
            entity_id = patch.get("id")
            json_patch = patch.get("patch", [])
            if entity_id:
                result = client.patch(
                    entity_type=entity_type, entity_id=entity_id, json_patch=json_patch
                )
                results.append(
                    result.dict() if hasattr(result, "dict") else result.__dict__
                )
        return results

    @classmethod
    def delete(
        cls,
        entity_type: str,
        ids: List[str],
        hard_delete: bool = False,
    ) -> List[str]:
        """Bulk delete entities"""
        client = cls._get_client()
        deleted = []
        for entity_id in ids:
            try:
                client.delete(
                    entity_type=entity_type,
                    entity_id=entity_id,
                    hard_delete=hard_delete,
                )
                deleted.append(entity_id)
            except Exception as e:
                print(f"Failed to delete {entity_id}: {e}")
        return deleted

    @classmethod
    def restore(
        cls,
        entity_type: str,
        ids: List[str],
    ) -> List[str]:
        """Bulk restore entities"""
        client = cls._get_client()
        restored = []
        for entity_id in ids:
            try:
                client.restore(entity_type=entity_type, entity_id=entity_id)
                restored.append(entity_id)
            except Exception as e:
                print(f"Failed to restore {entity_id}: {e}")
        return restored

    @classmethod
    async def import_csv_async(
        cls,
        entity_type: str,
        csv_data: str,
        dry_run: bool = False,
    ) -> Dict:
        """Async import CSV"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, cls.import_csv, entity_type, csv_data, dry_run
        )

    @classmethod
    async def export_csv_async(
        cls,
        entity_type: str,
        name: Optional[str] = None,
    ) -> str:
        """Async export CSV"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.export_csv, entity_type, name)

    @classmethod
    async def add_assets_async(
        cls,
        entity_type: str,
        assets: List[Dict],
    ) -> List[Dict]:
        """Async bulk add assets"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.add_assets, entity_type, assets)

    @classmethod
    async def patch_async(
        cls,
        entity_type: str,
        patches: List[Dict],
    ) -> List[Dict]:
        """Async bulk patch"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.patch, entity_type, patches)

    @classmethod
    async def delete_async(
        cls,
        entity_type: str,
        ids: List[str],
        hard_delete: bool = False,
    ) -> List[str]:
        """Async bulk delete"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, cls.delete, entity_type, ids, hard_delete
        )

    @classmethod
    async def restore_async(
        cls,
        entity_type: str,
        ids: List[str],
    ) -> List[str]:
        """Async bulk restore"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.restore, entity_type, ids)

    @classmethod
    def builder(cls) -> "BulkBuilder":
        """Create a bulk operation builder"""
        return BulkBuilder()


class BulkBuilder:
    """Builder for bulk operations"""

    def __init__(self):
        self._entity_type = None
        self._csv_data = None
        self._dry_run = False
        self._assets = None
        self._patches = None
        self._ids = None
        self._hard_delete = False
        self._operation_type = None
        self._name = None

    def entity_type(self, entity_type: str):
        """Set entity type"""
        self._entity_type = entity_type
        return self

    def csv_data(self, csv_data: str):
        """Set CSV data for import"""
        self._csv_data = csv_data
        self._operation_type = BulkOperationType.IMPORT_CSV
        return self

    def dry_run(self, dry_run: bool):
        """Set dry run mode"""
        self._dry_run = dry_run
        return self

    def assets(self, assets: List[Dict]):
        """Set assets for bulk add"""
        self._assets = assets
        self._operation_type = BulkOperationType.ADD_ASSETS
        return self

    def patches(self, patches: List[Dict]):
        """Set patches for bulk patch"""
        self._patches = patches
        self._operation_type = BulkOperationType.PATCH
        return self

    def ids(self, ids: List[str]):
        """Set IDs for delete or restore"""
        self._ids = ids
        return self

    def hard_delete(self, hard_delete: bool):
        """Set hard delete mode"""
        self._hard_delete = hard_delete
        return self

    def for_delete(self):
        """Configure for delete operation"""
        self._operation_type = BulkOperationType.DELETE
        return self

    def for_restore(self):
        """Configure for restore operation"""
        self._operation_type = BulkOperationType.RESTORE
        return self

    def for_export(self):
        """Configure for export operation"""
        self._operation_type = BulkOperationType.EXPORT_CSV
        return self

    def name(self, name: str):
        """Set name for export"""
        self._name = name
        return self

    def execute(self) -> Union[Dict, List, str]:
        """Execute the bulk operation"""
        if not self._entity_type:
            raise ValueError("Entity type is required")

        if self._operation_type == BulkOperationType.IMPORT_CSV:
            if not self._csv_data:
                raise ValueError("CSV data is required for import")
            return Bulk.import_csv(self._entity_type, self._csv_data, self._dry_run)

        elif self._operation_type == BulkOperationType.EXPORT_CSV:
            return Bulk.export_csv(self._entity_type, self._name)

        elif self._operation_type == BulkOperationType.ADD_ASSETS:
            if not self._assets:
                raise ValueError("Assets are required for bulk add")
            return Bulk.add_assets(self._entity_type, self._assets)

        elif self._operation_type == BulkOperationType.PATCH:
            if not self._patches:
                raise ValueError("Patches are required for bulk patch")
            return Bulk.patch(self._entity_type, self._patches)

        elif self._operation_type == BulkOperationType.DELETE:
            if not self._ids:
                raise ValueError("IDs are required for bulk delete")
            return Bulk.delete(self._entity_type, self._ids, self._hard_delete)

        elif self._operation_type == BulkOperationType.RESTORE:
            if not self._ids:
                raise ValueError("IDs are required for bulk restore")
            return Bulk.restore(self._entity_type, self._ids)

        else:
            raise ValueError("Operation type must be set")

    async def execute_async(self) -> Union[Dict, List, str]:
        """Execute the bulk operation asynchronously"""
        if not self._entity_type:
            raise ValueError("Entity type is required")

        if self._operation_type == BulkOperationType.IMPORT_CSV:
            if not self._csv_data:
                raise ValueError("CSV data is required for import")
            return await Bulk.import_csv_async(
                self._entity_type, self._csv_data, self._dry_run
            )

        elif self._operation_type == BulkOperationType.EXPORT_CSV:
            return await Bulk.export_csv_async(self._entity_type, self._name)

        elif self._operation_type == BulkOperationType.ADD_ASSETS:
            if not self._assets:
                raise ValueError("Assets are required for bulk add")
            return await Bulk.add_assets_async(self._entity_type, self._assets)

        elif self._operation_type == BulkOperationType.PATCH:
            if not self._patches:
                raise ValueError("Patches are required for bulk patch")
            return await Bulk.patch_async(self._entity_type, self._patches)

        elif self._operation_type == BulkOperationType.DELETE:
            if not self._ids:
                raise ValueError("IDs are required for bulk delete")
            return await Bulk.delete_async(
                self._entity_type, self._ids, self._hard_delete
            )

        elif self._operation_type == BulkOperationType.RESTORE:
            if not self._ids:
                raise ValueError("IDs are required for bulk restore")
            return await Bulk.restore_async(self._entity_type, self._ids)

        else:
            raise ValueError("Operation type must be set")
