#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import logging
from typing import Generic, List, Optional, Type, TypeVar, Union, get_args

from pydantic import BaseModel

from metadata.generated.schema.api.lineage.addLineage import AddLineage
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.location import Location
from metadata.generated.schema.entity.data.metrics import Metrics
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.report import Report
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.policies.policy import Policy
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.entityHistory import EntityVersionHistory
from metadata.ingestion.ometa.auth_provider import AuthenticationProvider
from metadata.ingestion.ometa.client import REST, APIError, ClientConfig
from metadata.ingestion.ometa.mixins.lineageMixin import OMetaLineageMixin
from metadata.ingestion.ometa.mixins.tableMixin import OMetaTableMixin
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


class InvalidEntityException(Exception):
    """
    We receive an entity not supported in an operation
    """


class EntityList(Generic[T], BaseModel):
    entities: List[T]
    total: int
    after: str = None


class OpenMetadata(OMetaLineageMixin, OMetaTableMixin, Generic[T, C]):
    """
    Generic interface to the OpenMetadata API

    It is a polymorphism on all our different Entities.

    Specific functionalities to be inherited from Mixins
    """

    client: REST
    _auth_provider: AuthenticationProvider

    class_root = ".".join(["metadata", "generated", "schema"])
    entity_path = "entity"
    api_path = "api"
    data_path = "data"
    policies_path = "policies"
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
            entity, get_args(Union[MlModel, self.get_create_entity_type(MlModel)])
        ):
            return "/mlmodels"

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
            entity, get_args(Union[Location, self.get_create_entity_type(Location)])
        ):
            return "/locations"

        if issubclass(
            entity, get_args(Union[Policy, self.get_create_entity_type(Policy)])
        ):
            return "/policies"

        if issubclass(
            entity, get_args(Union[Table, self.get_create_entity_type(Table)])
        ):
            return "/tables"

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

        if issubclass(entity, Tag):
            return "/tags"

        if issubclass(entity, get_args(Union[Team, self.get_create_entity_type(Team)])):
            return "/teams"

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

        if issubclass(
            entity,
            get_args(
                Union[StorageService, self.get_create_entity_type(StorageService)]
            ),
        ):
            return "/services/storageServices"

        raise MissingEntityTypeException(
            f"Missing {entity} type when generating suffixes"
        )

    @staticmethod
    def get_entity_type(
        entity: Union[Type[T], str],
    ) -> str:
        """
        Given an Entity T, return its type.
        E.g., Table returns table, Dashboard returns dashboard...

        Also allow to be the identity if we just receive a string
        """
        return entity if isinstance(entity, str) else entity.__name__.lower()

    def get_module_path(self, entity: Type[T]) -> str:
        """
        Based on the entity, return the module path
        it is found inside generated
        """

        if "policy" in entity.__name__.lower():
            return self.policies_path

        if "service" in entity.__name__.lower():
            return self.services_path

        if "user" in entity.__name__.lower() or "team" in entity.__name__.lower():
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

    def create_or_update(self, data: C) -> T:
        """
        We allow CreateEntity for PUT, so we expect a type C.

        We PUT to the endpoint and return the Entity generated result
        """

        entity = data.__class__
        is_create = "create" in data.__class__.__name__.lower()

        # Prepare the return Entity Type
        if is_create:
            entity_class = self.get_entity_from_create(entity)
        else:
            raise InvalidEntityException(
                f"PUT operations need a CrateEntity, not {entity}"
            )

        resp = self.client.put(self.get_suffix(entity), data=data.json())
        return entity_class(**resp)

    @staticmethod
    def uuid_to_str(entity_id: Union[str, basic.Uuid]) -> str:
        """
        Given an entity_id, that can be a str or our pydantic
        definition of Uuid, return a proper str to build
        the endpoint path
        :param entity_id: Entity ID to onvert to string
        :return: str for the ID
        """
        if isinstance(entity_id, basic.Uuid):
            return str(entity_id.__root__)

        return entity_id

    def get_by_name(
        self, entity: Type[T], fqdn: str, fields: Optional[List[str]] = None
    ) -> Optional[T]:
        """
        Return entity by name or None
        """

        return self._get(entity=entity, path=f"name/{fqdn}", fields=fields)

    def get_by_id(
        self,
        entity: Type[T],
        entity_id: Union[str, basic.Uuid],
        fields: Optional[List[str]] = None,
    ) -> Optional[T]:
        """
        Return entity by ID or None
        """

        return self._get(entity=entity, path=self.uuid_to_str(entity_id), fields=fields)

    def _get(
        self, entity: Type[T], path: str, fields: Optional[List[str]] = None
    ) -> Optional[T]:
        """
        Generic GET operation for an entity
        :param entity: Entity Class
        :param path: URL suffix by FQDN or ID
        :param fields: List of fields to return
        """
        fields_str = "?fields=" + ",".join(fields) if fields else ""
        try:
            resp = self.client.get(f"{self.get_suffix(entity)}/{path}{fields_str}")
            return entity(**resp)
        except APIError as err:
            logger.error(
                f"Creating new {entity.__class__.__name__} for {path}. Error {err.status_code}"
            )
            return None

    def list_entities(
        self,
        entity: Type[T],
        fields: Optional[List[str]] = None,
        after: str = None,
        limit: int = 1000,
    ) -> EntityList[T]:
        """
        Helps us paginate over the collection
        """

        suffix = self.get_suffix(entity)
        url_limit = f"?limit={limit}"
        url_after = f"&after={after}" if after else ""
        url_fields = f"&fields={','.join(fields)}" if fields else ""

        resp = self.client.get(f"{suffix}{url_limit}{url_after}{url_fields}")

        if self._use_raw_data:
            return resp
        else:
            entities = [entity(**t) for t in resp["data"]]
            total = resp["paging"]["total"]
            after = resp["paging"]["after"] if "after" in resp["paging"] else None
            return EntityList(entities=entities, total=total, after=after)

    def list_versions(
        self, entity_id: Union[str, basic.Uuid], entity: Type[T]
    ) -> EntityVersionHistory:
        """
        Helps us paginate over the collection
        """

        suffix = self.get_suffix(entity)
        path = f"/{self.uuid_to_str(entity_id)}/versions"
        resp = self.client.get(f"{suffix}{path}")

        if self._use_raw_data:
            return resp
        else:
            return EntityVersionHistory(**resp)

    def list_services(self, entity: Type[T]) -> List[EntityList[T]]:
        """
        Service listing does not implement paging
        """

        resp = self.client.get(self.get_suffix(entity))
        if self._use_raw_data:
            return resp
        else:
            return [entity(**p) for p in resp["data"]]

    def delete(self, entity: Type[T], entity_id: Union[str, basic.Uuid]) -> None:
        self.client.delete(f"{self.get_suffix(entity)}/{self.uuid_to_str(entity_id)}")

    def compute_percentile(self, entity: Union[Type[T], str], date: str) -> None:
        """
        Compute an entity usage percentile
        """
        entity_name = self.get_entity_type(entity)
        resp = self.client.post(f"/usage/compute.percentile/{entity_name}/{date}")
        logger.debug("published compute percentile {}".format(resp))

    def list_tags_by_category(self, category: str) -> List[Tag]:
        """
        List all tags
        """
        resp = self.client.get(f"{self.get_suffix(Tag)}/{category}")
        return [Tag(**d) for d in resp["children"]]

    def health_check(self) -> bool:
        """
        Run endpoint health-check. Return `true` if OK
        """
        return self.client.get("/health-check")["status"] == "healthy"

    def close(self):
        self.client.close()
