import logging
from typing import Generic, List, Type, TypeVar, Union, get_args

from pydantic import BaseModel

from metadata.generated.schema.api.lineage.addLineage import AddLineage
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.metrics import Metrics
from metadata.generated.schema.entity.data.model import Model
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.report import Report
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.task import Task
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.ometa.auth_provider import AuthenticationProvider
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.ometa.openmetadata_rest import (
    Auth0AuthenticationProvider,
    GoogleAuthenticationProvider,
    MetadataServerConfig,
    NoOpAuthenticationProvider,
    OktaAuthenticationProvider,
)

logger = logging.getLogger(__name__)


# The naming convention is T for Entity Types and C for Create Types
T = TypeVar("T", bound=BaseModel)
C = TypeVar("C", bound=BaseModel)


class MissingEntityTypeException(Exception):
    """
    We are receiving an Entity Type[T] not covered
    in our suffix generation list
    """


class EntityList(Generic[T], BaseModel):
    entities: List[T]
    total: int
    after: str = None


class OMeta(Generic[T, C]):
    """
    Generic interface to the OpenMetadata API

    It is a polymorphism on all our different Entities
    """

    client: REST
    _auth_provider: AuthenticationProvider

    class_root = ".".join(["metadata", "generated", "schema"])
    entity_path = "entity"
    api_path = "api"
    data_path = "data"
    services_path = "services"
    teams_path = "teams"

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

    def get_suffix(self, entity: Type[T]) -> str:
        """
        Given an entity Type from the generated sources,
        return the endpoint to run requests.

        Might be interesting to follow a more strict
        and type-checked approach
        """

        # Entity Schemas
        if issubclass(
            entity, get_args(Union[Model, self.get_create_entity_type(Model)])
        ):
            return "/models"

        if issubclass(
            entity, get_args(Union[Chart, self.get_create_entity_type(Chart)])
        ):
            return "/charts"

        if issubclass(
            entity, get_args(Union[Dashboard, self.get_create_entity_type(Dashboard)])
        ):
            return "/dashboards"

        if issubclass(
            entity, get_args(Union[Database, self.get_create_entity_type(Database)])
        ):
            return "/databases"

        if issubclass(
            entity, get_args(Union[Pipeline, self.get_create_entity_type(Pipeline)])
        ):
            return "/pipelines"

        if issubclass(
            entity, get_args(Union[Table, self.get_create_entity_type(Table)])
        ):
            return "/tables"

        if issubclass(entity, get_args(Union[Task, self.get_create_entity_type(Task)])):
            return "/tasks"

        if issubclass(
            entity, get_args(Union[Topic, self.get_create_entity_type(Topic)])
        ):
            return "/topics"

        if issubclass(entity, Metrics):
            return "/metrics"

        if issubclass(entity, AddLineage):
            return "/lineage"

        if issubclass(entity, Report):
            return "/reports"

        if issubclass(entity, get_args(Union[User, self.get_create_entity_type(User)])):
            return "/users"

        # Services Schemas
        if issubclass(
            entity,
            get_args(
                Union[DatabaseService, self.get_create_entity_type(DatabaseService)]
            ),
        ):
            return "/services/databaseServices"

        if issubclass(
            entity,
            get_args(
                Union[DashboardService, self.get_create_entity_type(DashboardService)]
            ),
        ):
            return "/services/dashboardServices"

        if issubclass(
            entity,
            get_args(
                Union[MessagingService, self.get_create_entity_type(MessagingService)]
            ),
        ):
            return "/services/messagingServices"

        if issubclass(
            entity,
            get_args(
                Union[PipelineService, self.get_create_entity_type(PipelineService)]
            ),
        ):
            return "/services/pipelineServices"

        raise MissingEntityTypeException(
            f"Missing {entity} type when generating suffixes"
        )

    def get_module_path(self, entity: Type[T]) -> str:
        """
        Based on the entity, return the module path
        it is found inside generated
        """

        if "service" in entity.__name__.lower():
            return self.services_path

        if "user" in entity.__name__.lower():
            return self.teams_path

        return self.data_path

    def get_create_entity_type(self, entity: Type[T]) -> Type[C]:
        """
        imports and returns the Create Type from an Entity Type T.

        We are following the expected path structure to import
        on-the-fly the necessary class and pass it to the consumer
        """
        file_name = f"create{entity.__name__}"

        class_path = ".".join(
            [self.class_root, self.api_path, self.get_module_path(entity), file_name]
        )

        class_name = f"Create{entity.__name__}EntityRequest"

        create_class = getattr(
            __import__(class_path, globals(), locals(), [class_name]), class_name
        )
        return create_class

    def get_entity_from_create(self, create: Type[C]) -> Type[T]:
        """
        Inversely, import the Entity type based on the create Entity class
        """

        class_name = create.__name__.replace("Create", "").replace("EntityRequest", "")
        file_name = class_name.lower()

        class_path = ".".join(
            [
                self.class_root,
                self.entity_path,
                self.get_module_path(create),
                file_name.replace("service", "Service")
                if "service" in create.__name__.lower()
                else file_name,
            ]
        )

        entity_class = getattr(
            __import__(class_path, globals(), locals(), [class_name]), class_name
        )
        return entity_class

    def create_or_update(self, entity: Type[T], data: T) -> Type[C]:
        """
        We allow both Entity and CreateEntity for PUT
        If Entity, no need to find response class mapping.

        We PUT to the endpoint and return the Entity generated result

        Here the typing is a bit more weird. We will get a type T, be it
        Entity or CreateEntity, and we are always going to return Entity
        """

        is_create = "create" in entity.__name__.lower()
        is_service = "service" in entity.__name__.lower()

        # Prepare the return Entity Type
        if is_create:
            entity_class = self.get_entity_from_create(entity)
        else:
            entity_class = entity

        # Prepare the request method
        if is_service and is_create:
            # Services can only be created via POST
            method = self.client.post
        else:
            method = self.client.put

        resp = method(self.get_suffix(entity), data=data.json())
        return entity_class(**resp)

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
        self.client.delete(f"{self.get_suffix(entity)}/{entity_id}")
