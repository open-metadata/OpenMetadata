import logging
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar

from pydantic import BaseModel

from ingestion.src.metadata.ingestion.ometa.auth_provider import AuthenticationProvider
from ingestion.src.metadata.ingestion.ometa.client import REST, ClientConfig
from ingestion.src.metadata.ingestion.ometa.openmetadata_rest import (
    Auth0AuthenticationProvider,
    GoogleAuthenticationProvider,
    MetadataServerConfig,
    NoOpAuthenticationProvider,
    OktaAuthenticationProvider,
)

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class EntityList(Generic[T], BaseModel):
    entities: List[T]
    total: int
    after: str = None


class OMeta(Generic[T]):
    """
    Generic interface to the OpenMetadata API

    It is a polymorphism on all our different Entities
    """

    client: REST
    _auth_provider: AuthenticationProvider

    def __init__(self, config: MetadataServerConfig, raw_data: bool = False):
        self.config = config
        if self.config.auth_provider_type == "google":
            self._auth_provider: AuthenticationProvider = (
                GoogleAuthenticationProvider.create(self.config)
            )
        elif self.config.auth_provider_type == "okta":
            self._auth_provider: AuthenticationProvider = (
                OktaAuthenticationProvider.create(self.config)
            )
        elif self.config.auth_provider_type == "auth0":
            self._auth_provider: AuthenticationProvider = (
                Auth0AuthenticationProvider.create(self.config)
            )
        else:
            self._auth_provider: AuthenticationProvider = (
                NoOpAuthenticationProvider.create(self.config)
            )
        client_config: ClientConfig = ClientConfig(
            base_url=self.config.api_endpoint,
            api_version=self.config.api_version,
            auth_header="X-Catalog-Source",
            auth_token=self._auth_provider.auth_token(),
        )
        self.client = REST(client_config)
        self._use_raw_data = raw_data

    @staticmethod
    def get_suffix(entity: Type[T]) -> str:
        """
        Given an entity Type from the generated sources,
        return the endpoint to run requests
        """

        name = entity.__name__.lower()

        if "service" in name:
            return f"/services/{name.replace('service', '')}Services"

        suffix = name if name == "lineage" else name + "s"

        return f"/{suffix}"

    def create_or_update(self, entity: Type[T], data: T) -> Type[T]:
        resp = self.client.put(self.get_suffix(entity), data=data.json())
        return entity(**resp)

    def get_by_name(self, entity: Type[T], name: str) -> Type[T]:
        resp = self.client.get(f"{self.get_suffix(entity)}/name/{name}")
        return entity(**resp)

    def get_by_id(self, entity: Type[T], entity_id: str) -> Type[T]:
        resp = self.client.get(f"{self.get_suffix(entity)}/{entity_id}")
        return entity(**resp)

    def list_entities(
        self, entity: Type[T], fields: str = None, after: str = None, limit: int = 1000
    ) -> EntityList[T]:
        """
        Helps us paginate over the collection
        """

        suffix = self.get_suffix(entity)

        if fields is None:
            resp = self.client.get(suffix)
        else:
            if after is not None:
                resp = self.client.get(
                    f"{suffix}?fields={fields}&after={after}&limit={limit}"
                )
            else:
                resp = self.client.get(f"{suffix}?fields={fields}&limit={limit}")

        if self._use_raw_data:
            return resp
        else:
            entities = [entity(**t) for t in resp["data"]]
            total = resp["paging"]["total"]
            after = resp["paging"]["after"] if "after" in resp["paging"] else None
            return EntityList(entities=entities, total=total, after=after)

    def list_services(self, entity: Type[T]) -> List[EntityList[T]]:
        """
        Service listing does not implement paging
        """

        resp = self.client.get(self.get_suffix(entity))
        if self._use_raw_data:
            return resp
        else:
            return [entity(**p) for p in resp["data"]]

    def delete(self, entity: Type[T], entity_id: str) -> None:
        self.client.delete(f"/{self.get_suffix(entity)}/{entity_id}")
