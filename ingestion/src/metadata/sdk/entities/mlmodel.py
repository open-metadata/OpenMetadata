"""
ML Model entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional, Union

from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.entity.data.mlmodel import MlModel as MlModelEntity
from metadata.sdk.entities.base import BaseEntity


class MLModel(BaseEntity):
    """MLModel entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return MlModelEntity

    @classmethod
    def create(cls, request: CreateMlModelRequest) -> MlModelEntity:
        """
        Create a new ML model.

        Args:
            request: CreateMlModelRequest with ML model details

        Returns:
            Created MlModel entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> MlModelEntity:
        """
        Retrieve an ML model by ID.

        Args:
            entity_id: MlModel UUID
            fields: Optional list of fields to include

        Returns:
            MlModel entity
        """
        client = cls._get_client()
        return client.get_by_id(
            entity=MlModelEntity, entity_id=entity_id, fields=fields
        )

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> MlModelEntity:
        """
        Retrieve an ML model by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            MlModel entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=MlModelEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity_id: str, mlmodel: MlModelEntity) -> MlModelEntity:
        """
        Update an ML model (PUT operation).

        Args:
            entity_id: MlModel UUID
            mlmodel: Updated MlModel entity

        Returns:
            Updated MlModel entity
        """
        mlmodel.id = entity_id
        client = cls._get_client()
        return client.create_or_update(mlmodel)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> MlModelEntity:
        """
        Patch an ML model (PATCH operation).

        Args:
            entity_id: MlModel UUID
            json_patch: JSON patch operations

        Returns:
            Patched MlModel entity
        """
        client = cls._get_client()
        return client.patch(
            entity=MlModelEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete an ML model.

        Args:
            entity_id: MlModel UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=MlModelEntity,
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
    ) -> List[MlModelEntity]:
        """
        List ML models.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of MlModel entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=MlModelEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []

    @classmethod
    def add_followers(cls, entity_id: str, user_ids: List[str]) -> MlModelEntity:
        """
        Add followers to an ML model.

        Args:
            entity_id: MlModel UUID
            user_ids: List of user UUIDs to add as followers

        Returns:
            Updated MlModel entity
        """
        client = cls._get_client()
        return client.add_followers(
            entity=MlModelEntity, entity_id=entity_id, user_ids=user_ids
        )

    @classmethod
    def remove_followers(cls, entity_id: str, user_ids: List[str]) -> MlModelEntity:
        """
        Remove followers from an ML model.

        Args:
            entity_id: MlModel UUID
            user_ids: List of user UUIDs to remove as followers

        Returns:
            Updated MlModel entity
        """
        client = cls._get_client()
        return client.remove_followers(
            entity=MlModelEntity, entity_id=entity_id, user_ids=user_ids
        )

    @classmethod
    def get_versions(cls, entity_id: str) -> List[MlModelEntity]:
        """
        Get all versions of an ML model.

        Args:
            entity_id: MlModel UUID

        Returns:
            List of MlModel versions
        """
        client = cls._get_client()
        return client.get_entity_versions(entity=MlModelEntity, entity_id=entity_id)

    @classmethod
    def get_version(cls, entity_id: str, version: Union[str, float]) -> MlModelEntity:
        """
        Get a specific version of an ML model.

        Args:
            entity_id: MlModel UUID
            version: Version number or 'latest'

        Returns:
            MlModel entity at specified version
        """
        client = cls._get_client()
        return client.get_entity_version(
            entity=MlModelEntity, entity_id=entity_id, version=version
        )

    @classmethod
    def restore(cls, entity_id: str) -> MlModelEntity:
        """
        Restore a soft-deleted ML model.

        Args:
            entity_id: MlModel UUID

        Returns:
            Restored MlModel entity
        """
        client = cls._get_client()
        return client.restore_entity(entity=MlModelEntity, entity_id=entity_id)

    @classmethod
    def add_feature(
        cls, entity_id: str, feature_name: str, feature_type: str, description: str
    ) -> MlModelEntity:
        """
        Add a feature to an ML model.

        Args:
            entity_id: MlModel UUID
            feature_name: Name of the feature
            feature_type: Type of the feature
            description: Feature description

        Returns:
            Updated MlModel entity
        """
        json_patch = [
            {
                "op": "add",
                "path": "/mlFeatures/-",
                "value": {
                    "name": feature_name,
                    "dataType": feature_type,
                    "description": description,
                },
            }
        ]
        return cls.patch(entity_id, json_patch)

    @classmethod
    def update_algorithm(cls, entity_id: str, algorithm: str) -> MlModelEntity:
        """
        Update ML model algorithm.

        Args:
            entity_id: MlModel UUID
            algorithm: New algorithm name

        Returns:
            Updated MlModel entity
        """
        json_patch = [{"op": "replace", "path": "/algorithm", "value": algorithm}]
        return cls.patch(entity_id, json_patch)

    @classmethod
    def export_csv(cls, name: str) -> str:
        """
        Export ML models to CSV format.

        Args:
            name: Export name

        Returns:
            CSV data as string
        """
        client = cls._get_client()
        return client.export_csv(entity=MlModelEntity, name=name)

    @classmethod
    def import_csv(cls, csv_data: str, dry_run: bool = False) -> str:
        """
        Import ML models from CSV format.

        Args:
            csv_data: CSV data to import
            dry_run: Perform dry run without actual import

        Returns:
            Import status message
        """
        client = cls._get_client()
        return client.import_csv(
            entity=MlModelEntity, csv_data=csv_data, dry_run=dry_run
        )
