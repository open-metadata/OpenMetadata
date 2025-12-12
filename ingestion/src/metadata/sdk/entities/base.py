"""Lightweight, typed helpers for entity CRUD operations in the SDK."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import (
    Any,
    Callable,
    ClassVar,
    Dict,
    Generic,
    List,
    Mapping,
    Optional,
    Sequence,
    Type,
    TypeVar,
    Union,
    cast,
)

from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.sdk.client import OpenMetadata
from metadata.sdk.types import JsonDict, OMetaClient, UuidLike

TCreate = TypeVar("TCreate", bound=BaseModel)  # pylint: disable=invalid-name
TEntity = TypeVar("TEntity", bound=BaseModel)  # pylint: disable=invalid-name


@dataclass
class EntityList(Generic[TEntity]):
    """Simple typed container for paginated responses."""

    entities: Sequence[TEntity]
    after: Optional[str] = None
    before: Optional[str] = None


@dataclass
class CsvExportOperation(Generic[TEntity]):
    """Stateful helper that performs synchronous or async CSV exports."""

    client: OMetaClient
    entity: Type[TEntity]
    name: str
    async_enabled: bool = field(default=False, init=False)

    def with_async(self) -> "CsvExportOperation[TEntity]":
        """Enable async execution mode (metadata only, retained for fluent API)."""
        self.async_enabled = True
        return self

    def execute(self) -> Any:
        return cast(Any, self.client).export_csv(entity=self.entity, name=self.name)

    def execute_async(self) -> Any:
        export_async = getattr(self.client, "export_csv_async", None)
        if not callable(export_async):
            raise AttributeError("Client does not support async CSV export operations")
        return export_async(entity=self.entity, name=self.name)


@dataclass
class CsvImportOperation(Generic[TEntity]):
    """Stateful helper for CSV import operations."""

    client: OMetaClient
    entity: Type[TEntity]
    name: str
    csv_data: Optional[str] = None
    dry_run: bool = False
    async_enabled: bool = field(default=False, init=False)

    def with_data(self, csv_data: str) -> "CsvImportOperation[TEntity]":
        self.csv_data = csv_data
        return self

    def set_dry_run(self, dry_run: bool) -> "CsvImportOperation[TEntity]":
        self.dry_run = dry_run
        return self

    def with_async(self) -> "CsvImportOperation[TEntity]":
        self.async_enabled = True
        return self

    def execute(self) -> Any:
        payload = self.csv_data or ""
        return cast(Any, self.client).import_csv(
            entity=self.entity,
            name=self.name,
            csv_data=payload,
            dry_run=self.dry_run,
        )

    def execute_async(self) -> Any:
        import_async = getattr(self.client, "import_csv_async", None)
        if not callable(import_async):
            raise AttributeError("Client does not support async CSV import operations")
        payload = self.csv_data or ""
        return import_async(
            entity=self.entity,
            name=self.name,
            csv_data=payload,
            dry_run=self.dry_run,
        )


class BaseEntity(Generic[TEntity, TCreate]):
    """Typed facade over the ingestion `OpenMetadata` client."""

    _default_client: ClassVar[Optional[OMetaClient]] = None

    # ------------------------------------------------------------------
    # Client handling
    # ------------------------------------------------------------------
    @classmethod
    def _get_client(cls) -> OMetaClient:
        if cls._default_client is None:
            cls._default_client = OpenMetadata.get_default_client()
        return cls._default_client

    @classmethod
    def use_client(cls, client: Union[OpenMetadata, OMetaClient]) -> None:
        """Register a default client for SDK calls."""
        cls._default_client = (
            client.ometa if isinstance(client, OpenMetadata) else client
        )

    @classmethod
    def set_default_client(cls, client: Union[OpenMetadata, OMetaClient]) -> None:
        """Backward-compatible alias used across legacy tests/examples."""
        cls.use_client(client)

    # ------------------------------------------------------------------
    # Entity metadata
    # ------------------------------------------------------------------
    @classmethod
    def entity_type(cls) -> Type[TEntity]:
        raise NotImplementedError

    # ------------------------------------------------------------------
    # CRUD operations
    # ------------------------------------------------------------------
    @classmethod
    def create(cls, request: TCreate) -> TEntity:
        client = cls._get_client()
        response = client.create_or_update(request)
        return cls._coerce_entity(response)

    @classmethod
    def retrieve(
        cls,
        entity_id: UuidLike,
        *,
        fields: Optional[Sequence[str]] = None,
        nullable: Optional[bool] = None,
    ) -> TEntity:
        """Retrieve an entity by its unique identifier."""
        client = cls._get_client()
        entity_id_value = cls._stringify_identifier(entity_id)
        if nullable is None:
            entity = client.get_by_id(
                entity=cls.entity_type(),
                entity_id=entity_id_value,
                fields=list(fields) if fields else None,
            )
        else:
            entity = client.get_by_id(
                entity=cls.entity_type(),
                entity_id=entity_id_value,
                fields=list(fields) if fields else None,
                nullable=nullable,
            )
        return cls._coerce_entity(entity)

    @classmethod
    def retrieve_by_name(
        cls,
        fqn: Union[str, FullyQualifiedEntityName],
        *,
        fields: Optional[Sequence[str]] = None,
        nullable: Optional[bool] = None,
    ) -> TEntity:
        """Retrieve an entity by its fully-qualified name."""
        client = cls._get_client()
        if nullable is None:
            entity = client.get_by_name(
                entity=cls.entity_type(),
                fqn=fqn,
                fields=list(fields) if fields else None,
            )
        else:
            entity = client.get_by_name(
                entity=cls.entity_type(),
                fqn=fqn,
                fields=list(fields) if fields else None,
                nullable=nullable,
            )
        return cls._coerce_entity(entity)

    @classmethod
    def update(cls, entity: TEntity) -> TEntity:
        client = cls._get_client()
        entity_identifier = getattr(entity, "id", None)
        if entity_identifier is None:
            raise ValueError("Entity must define an 'id' attribute before updating")
        current = client.get_by_id(
            entity=cls.entity_type(),
            entity_id=cls._stringify_identifier(entity_identifier),
            fields=None,
        )
        updated = cast(Any, client).patch(
            entity=cls.entity_type(), source=current, destination=entity
        )
        return cls._coerce_entity(updated)

    @classmethod
    def delete(
        cls,
        entity_id: UuidLike,
        *,
        recursive: bool = False,
        hard_delete: bool = False,
    ) -> None:
        client = cls._get_client()
        client.delete(
            entity=cls.entity_type(),
            entity_id=cls._stringify_identifier(entity_id),
            recursive=recursive,
            hard_delete=hard_delete,
        )

    @classmethod
    def list(
        cls,
        *,
        limit: int = 10,
        after: Optional[str] = None,
        before: Optional[str] = None,
        fields: Optional[Sequence[str]] = None,
        filters: Optional[Mapping[str, str]] = None,
    ) -> EntityList[TEntity]:
        """Fetch a single page of entities from OpenMetadata."""
        client = cls._get_client()
        response = client.list_entities(
            entity=cls.entity_type(),
            fields=list(fields) if fields else None,
            after=after,
            before=before,
            limit=limit,
            params=dict(filters) if filters else None,
        )
        raw_entities = cast(Sequence[Any], getattr(response, "entities", []) or [])
        entities = [cls._coerce_entity(item) for item in raw_entities]
        return EntityList(
            entities=entities,
            after=getattr(response, "after", None),
            before=getattr(response, "before", None),
        )

    @classmethod
    def list_all(
        cls,
        *,
        batch_size: int = 100,
        fields: Optional[Sequence[str]] = None,
        filters: Optional[Mapping[str, str]] = None,
    ) -> List[TEntity]:
        """Iterate through all entities by repeatedly calling :meth:`list`."""

        results: List[TEntity] = []
        after: Optional[str] = None
        while True:
            page = cls.list(
                limit=batch_size,
                after=after,
                fields=fields,
                filters=filters,
            )
            results.extend(page.entities)
            if not page.after:
                break
            after = page.after
        return results

    @classmethod
    def search(cls, query: str, *, size: int = 10) -> Sequence[TEntity]:
        """Perform name-based search via Elasticsearch helper if available."""

        client = cls._get_client()
        search_fn = getattr(client, "es_search_from_fqn", None)
        if not callable(search_fn):
            raise AttributeError("OpenMetadata client does not support entity search")
        assert callable(search_fn)
        results = cast(
            Sequence[Any],
            search_fn(  # pylint: disable=not-callable
                entity_type=cls.entity_type(),
                fqn_search_string=query,
                size=size,
            ),
        )
        coerced_results = cast(Sequence[Any], results or [])
        return [cls._coerce_entity(item) for item in coerced_results]

    @classmethod
    def export_csv(cls, name: str) -> CsvExportOperation[TEntity]:
        """Return a CSV export operation bound to this entity type."""

        client = cls._get_client()
        return CsvExportOperation(client=client, entity=cls.entity_type(), name=name)

    @classmethod
    def import_csv(cls, name: str) -> CsvImportOperation[TEntity]:
        """Return a CSV import operation bound to this entity type."""

        client = cls._get_client()
        return CsvImportOperation(client=client, entity=cls.entity_type(), name=name)

    @classmethod
    def get_versions(cls, entity_id: UuidLike) -> Sequence[TEntity]:
        """Fetch all historical versions for an entity."""

        client = cls._get_client()
        list_versions = cast(
            Callable[..., Any], getattr(client, "get_list_entity_versions")
        )
        history = list_versions(
            entity=cls.entity_type(),
            entity_id=str(entity_id),
        )
        versions = cast(Sequence[Any], getattr(history, "versions", []) or [])
        return [cls._coerce_entity(item) for item in versions]

    @classmethod
    def get_specific_version(cls, entity_id: UuidLike, version: str) -> TEntity:
        """Fetch a specific entity version."""

        client = cls._get_client()
        get_version = cast(Callable[..., Any], getattr(client, "get_entity_version"))
        payload = get_version(
            entity=cls.entity_type(),
            entity_id=cls._stringify_identifier(entity_id),
            version=version,
        )
        return cls._coerce_entity(payload)

    # ------------------------------------------------------------------
    # Relationship helpers
    # ------------------------------------------------------------------
    @classmethod
    def add_followers(
        cls, entity_id: UuidLike, follower_ids: Sequence[UuidLike]
    ) -> TEntity:
        """Add followers to an entity and return the refreshed payload."""

        if not follower_ids:
            return cls.retrieve(entity_id, fields=["followers"])
        client = cls._get_client()
        rest_client = cls._get_rest_client(client)
        endpoint = cls._get_endpoint_path(client)
        entity_id_str = cls._stringify_identifier(entity_id)
        for follower in follower_ids:
            follower_str = cls._stringify_identifier(follower)
            rest_client.put(
                f"{endpoint}/{entity_id_str}/followers",
                json=follower_str,
            )
        updated = client.get_by_id(
            entity=cls.entity_type(),
            entity_id=entity_id_str,
            fields=["followers"],
        )
        return cls._coerce_entity(updated)

    @classmethod
    def remove_followers(
        cls, entity_id: UuidLike, follower_ids: Sequence[UuidLike]
    ) -> TEntity:
        """Remove followers from an entity and return the refreshed payload."""

        if not follower_ids:
            return cls.retrieve(entity_id, fields=["followers"])
        client = cls._get_client()
        rest_client = cls._get_rest_client(client)
        endpoint = cls._get_endpoint_path(client)
        entity_id_str = cls._stringify_identifier(entity_id)
        for follower in follower_ids:
            follower_str = cls._stringify_identifier(follower)
            rest_client.delete(f"{endpoint}/{entity_id_str}/followers/{follower_str}")
        updated = client.get_by_id(
            entity=cls.entity_type(),
            entity_id=entity_id_str,
            fields=["followers"],
        )
        return cls._coerce_entity(updated)

    @classmethod
    def restore(cls, entity_id: UuidLike) -> TEntity:
        """Restore a soft-deleted entity."""

        client = cls._get_client()
        rest_client = cls._get_rest_client(client)
        endpoint = cls._get_endpoint_path(client)
        response = rest_client.put(
            f"{endpoint}/restore",
            json={"id": cls._stringify_identifier(entity_id)},
        )
        return cls._coerce_entity(response)

    @classmethod
    def update_custom_properties(cls, identifier: UuidLike):
        """Convenience accessor for custom property updates by entity id."""

        from metadata.sdk.entities.custom_properties import (  # pylint: disable=import-outside-toplevel
            CustomProperties,
        )

        updater = CustomProperties.update(cls.entity_type(), identifier)
        _ = updater.use_client(cls._get_client())
        return updater

    @classmethod
    def update_custom_properties_by_name(cls, fqn: str):
        """Convenience accessor for custom property updates by entity FQN."""

        from metadata.sdk.entities.custom_properties import (  # pylint: disable=import-outside-toplevel
            CustomProperties,
        )

        updater = CustomProperties.update_by_name(cls.entity_type(), fqn)
        _ = updater.use_client(cls._get_client())
        return updater

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @classmethod
    def _coerce_entity(cls, payload: Any) -> TEntity:
        entity_cls = cls.entity_type()
        if isinstance(payload, entity_cls):
            return payload
        if isinstance(payload, BaseModel):
            return cast(TEntity, payload)
        if isinstance(payload, dict):
            typed_payload = cast(Dict[str, Any], payload)
            model_validate = getattr(entity_cls, "model_validate", None)
            if not callable(model_validate):
                raise TypeError("Entity type does not support model validation")
            return cast(TEntity, model_validate(typed_payload))
        return cast(TEntity, payload)

    @classmethod
    def _coerce_dict(cls, payload: Any) -> JsonDict:
        if isinstance(payload, dict):
            return cast(JsonDict, payload)
        if isinstance(payload, BaseModel):
            json_result: Dict[
                str, Any
            ] = payload.model_dump(  # pyright: ignore[reportUnknownMemberType]
                mode="json"
            )
            return json_result
        raise TypeError("Expected mapping-compatible payload")

    @staticmethod
    def _get_rest_client(client: OMetaClient) -> Any:
        rest_client = getattr(client, "client", None)
        if rest_client is None:
            raise RuntimeError("OpenMetadata client does not expose a REST interface")
        return rest_client

    @classmethod
    def _get_endpoint_path(cls, client: OMetaClient) -> str:
        suffix_getter = getattr(client, "get_suffix", None)
        if callable(suffix_getter):
            raw_suffix = cast(str, suffix_getter(cls.entity_type()))
            normalized = raw_suffix.rstrip("/")
            return normalized if normalized.startswith("/") else f"/{normalized}"
        return f"/{cls.entity_type().__name__.lower()}s"

    @staticmethod
    def _stringify_identifier(identifier: Any) -> str:
        root = getattr(identifier, "root", None)
        if root is not None:
            return str(root)
        return str(identifier)
