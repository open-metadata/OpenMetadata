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
"""
OpenMetadata is the high level Python API that serves as a wrapper
for the metadata-server API. It is based on the generated pydantic
models from the JSON schemas and provides a typed approach to
working with OpenMetadata entities.
"""
import traceback
from typing import Dict, Generic, Iterable, List, Optional, Type, TypeVar, Union

try:
    from typing import get_args
except ImportError:
    from typing_compat import get_args

from pydantic import BaseModel
from requests.utils import quote

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.bot import BotType
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.location import Location
from metadata.generated.schema.entity.data.metrics import Metrics
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.report import Report
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.policies.policy import Policy
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.generated.schema.entity.tags.tagCategory import Tag, TagCategory
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import TestDefinition
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityHistory import EntityVersionHistory
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.encoders import show_secrets_encoder
from metadata.ingestion.ometa.auth_provider import AuthenticationProvider
from metadata.ingestion.ometa.client import REST, APIError, ClientConfig
from metadata.ingestion.ometa.mixins.dashboard_mixin import OMetaDashboardMixin
from metadata.ingestion.ometa.mixins.es_mixin import ESMixin
from metadata.ingestion.ometa.mixins.glossary_mixin import GlossaryMixin
from metadata.ingestion.ometa.mixins.mlmodel_mixin import OMetaMlModelMixin
from metadata.ingestion.ometa.mixins.patch_mixin import OMetaPatchMixin
from metadata.ingestion.ometa.mixins.pipeline_mixin import OMetaPipelineMixin
from metadata.ingestion.ometa.mixins.server_mixin import OMetaServerMixin
from metadata.ingestion.ometa.mixins.service_mixin import OMetaServiceMixin
from metadata.ingestion.ometa.mixins.table_mixin import OMetaTableMixin
from metadata.ingestion.ometa.mixins.tag_mixin import OMetaTagMixin
from metadata.ingestion.ometa.mixins.tests_mixin import OMetaTestsMixin
from metadata.ingestion.ometa.mixins.topic_mixin import OMetaTopicMixin
from metadata.ingestion.ometa.mixins.version_mixin import OMetaVersionMixin
from metadata.ingestion.ometa.provider_registry import (
    InvalidAuthProviderException,
    auth_provider_registry,
)
from metadata.ingestion.ometa.ssl_registry import (
    InvalidSSLVerificationException,
    ssl_verification_registry,
)
from metadata.ingestion.ometa.utils import get_entity_type, model_str, ometa_logger
from metadata.utils.secrets.secrets_manager_factory import (
    get_secrets_manager_from_om_connection,
)

logger = ometa_logger()

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


class EmptyPayloadException(Exception):
    """
    Raise when receiving no data, even if no exception
    during the API call is received
    """


class EntityList(Generic[T], BaseModel):
    """
    Pydantic Entity list model

    Attributes
        entities (List): list of entities
        total (int):
        after (str):
    """

    entities: List[T]
    total: int
    after: str = None


class OpenMetadata(
    OMetaPipelineMixin,
    OMetaMlModelMixin,
    OMetaTableMixin,
    OMetaTopicMixin,
    OMetaVersionMixin,
    OMetaTagMixin,
    GlossaryMixin,
    OMetaServiceMixin,
    ESMixin,
    OMetaServerMixin,
    OMetaDashboardMixin,
    OMetaPatchMixin,
    OMetaTestsMixin,
    Generic[T, C],
):
    """
    Generic interface to the OpenMetadata API

    It is a polymorphism on all our different Entities.

    Specific functionalities to be inherited from Mixins
    """

    client: REST
    _auth_provider: AuthenticationProvider
    config: OpenMetadataConnection

    class_root = ".".join(["metadata", "generated", "schema"])
    entity_path = "entity"
    api_path = "api"
    data_path = "data"
    policies_path = "policies"
    services_path = "services"
    teams_path = "teams"
    tags_path = "tags"
    tests_path = "tests"

    def __init__(self, config: OpenMetadataConnection, raw_data: bool = False):
        self.config = config

        # Load the secrets' manager client
        self.secrets_manager_client = get_secrets_manager_from_om_connection(
            config, config.secretsManagerCredentials
        )

        # Load auth provider config from Secret Manager if necessary
        self.secrets_manager_client.add_auth_provider_security_config(
            self.config, BotType.ingestion_bot.value
        )

        # Load the auth provider init from the registry
        auth_provider_fn = auth_provider_registry.registry.get(
            self.config.authProvider.value
        )
        if not auth_provider_fn:
            raise InvalidAuthProviderException(
                f"Cannot find {self.config.authProvider.value} in {auth_provider_registry.registry}"
            )

        self._auth_provider = auth_provider_fn(self.config)

        get_verify_ssl = ssl_verification_registry.registry.get(
            self.config.verifySSL.value
        )
        if not get_verify_ssl:
            raise InvalidSSLVerificationException(
                f"Cannot find {self.config.verifySSL.value} in {ssl_verification_registry.registry}"
            )

        client_config: ClientConfig = ClientConfig(
            base_url=self.config.hostPort,
            api_version=self.config.apiVersion,
            auth_header="Authorization",
            auth_token=self._auth_provider.get_access_token,
            verify=get_verify_ssl(config),
        )
        self.client = REST(client_config)
        self._use_raw_data = raw_data
        if self.config.enableVersionValidation:
            self.validate_versions()

    def get_suffix(self, entity: Type[T]) -> str:  # pylint: disable=R0911,R0912
        """
        Given an entity Type from the generated sources,
        return the endpoint to run requests.

        Might be interesting to follow a more strict
        and type-checked approach

        Disabled pylint R0911: too-many-return-statements
        Disabled pylint R0912: too-many-branches
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
            entity,
            get_args(
                Union[DatabaseSchema, self.get_create_entity_type(DatabaseSchema)]
            ),
        ):
            return "/databaseSchemas"

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

        if issubclass(entity, AddLineageRequest):
            return "/lineage"

        if issubclass(entity, Report):
            return "/reports"

        if issubclass(
            entity,
            get_args(
                Union[
                    Tag,
                    self.get_create_entity_type(Tag),
                    TagCategory,
                    self.get_create_entity_type(TagCategory),
                ]
            ),
        ):
            return "/tags"

        if issubclass(
            entity, get_args(Union[Glossary, self.get_create_entity_type(Glossary)])
        ):
            return "/glossaries"

        if issubclass(
            entity,
            get_args(Union[GlossaryTerm, self.get_create_entity_type(GlossaryTerm)]),
        ):
            return "/glossaryTerms"

        if issubclass(entity, get_args(Union[Role, self.get_create_entity_type(Role)])):
            return "/roles"

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

        if issubclass(
            entity,
            get_args(
                Union[MlModelService, self.get_create_entity_type(MlModelService)]
            ),
        ):
            return "/services/mlmodelServices"

        if issubclass(
            entity,
            get_args(
                Union[TestDefinition, self.get_create_entity_type(TestDefinition)]
            ),
        ):
            return "/testDefinition"

        if issubclass(
            entity,
            get_args(Union[TestSuite, self.get_create_entity_type(TestSuite)]),
        ):
            return "/testSuite"

        if issubclass(
            entity,
            get_args(Union[TestCase, self.get_create_entity_type(TestCase)]),
        ):
            return "/testCase"

        raise MissingEntityTypeException(
            f"Missing {entity} type when generating suffixes"
        )

    def get_module_path(self, entity: Type[T]) -> str:
        """
        Based on the entity, return the module path
        it is found inside generated
        """

        if "policy" in entity.__name__.lower():
            return self.policies_path

        if "service" in entity.__name__.lower():
            return self.services_path

        if "tag" in entity.__name__.lower():
            return self.tags_path

        if "test" in entity.__name__.lower():
            return self.tests_path

        if (
            "user" in entity.__name__.lower()
            or "role" in entity.__name__.lower()
            or "team" in entity.__name__.lower()
        ):
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

        class_name = f"Create{entity.__name__}Request"
        create_class = getattr(
            __import__(class_path, globals(), locals(), [class_name]), class_name
        )
        return create_class

    @staticmethod
    def update_file_name(create: Type[C], file_name: str) -> str:
        """
        Update the filename for services and schemas
        """
        if "service" in create.__name__.lower():
            return file_name.replace("service", "Service")

        if "schema" in create.__name__.lower():
            return file_name.replace("schema", "Schema")

        return file_name

    def get_entity_from_create(self, create: Type[C]) -> Type[T]:
        """
        Inversely, import the Entity type based on the create Entity class
        """

        class_name = create.__name__.replace("Create", "").replace("Request", "")
        file_name = (
            class_name.lower()
            .replace("glossaryterm", "glossaryTerm")
            .replace("tagcategory", "tagCategory")
            .replace("testsuite", "testSuite")
            .replace("testdefinition", "testDefinition")
            .replace("testcase", "testCase")
        )

        class_path = ".".join(
            filter(
                None,
                [
                    self.class_root,
                    self.entity_path if not file_name.startswith("test") else None,
                    self.get_module_path(create),
                    self.update_file_name(create, file_name),
                ],
            )
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
        resp = self.client.put(
            self.get_suffix(entity), data=data.json(encoder=show_secrets_encoder)
        )
        if not resp:
            raise EmptyPayloadException(
                f"Got an empty response when trying to PUT to {self.get_suffix(entity)}, {data.json()}"
            )
        return entity_class(**resp)

    def get_by_name(
        self,
        entity: Type[T],
        fqn: Union[str, FullyQualifiedEntityName],
        fields: Optional[List[str]] = None,
    ) -> Optional[T]:
        """
        Return entity by name or None
        """

        return self._get(
            entity=entity,
            path=f"name/{quote(model_str(fqn), safe='')}",
            fields=fields,
        )

    def get_by_id(
        self,
        entity: Type[T],
        entity_id: Union[str, basic.Uuid],
        fields: Optional[List[str]] = None,
    ) -> Optional[T]:
        """
        Return entity by ID or None
        """

        return self._get(entity=entity, path=model_str(entity_id), fields=fields)

    def _get(
        self, entity: Type[T], path: str, fields: Optional[List[str]] = None
    ) -> Optional[T]:
        """
        Generic GET operation for an entity
        :param entity: Entity Class
        :param path: URL suffix by FQN or ID
        :param fields: List of fields to return
        """
        fields_str = "?fields=" + ",".join(fields) if fields else ""
        try:
            resp = self.client.get(f"{self.get_suffix(entity)}/{path}{fields_str}")
            if not resp:
                raise EmptyPayloadException(
                    f"Got an empty response when trying to GET from {self.get_suffix(entity)}/{path}{fields_str}"
                )
            return entity(**resp)
        except APIError as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                "GET %s for %s. Error %s - %s",
                entity.__name__,
                path,
                err.status_code,
                err,
            )
            return None

    def get_entity_reference(
        self, entity: Type[T], fqn: str
    ) -> Optional[EntityReference]:
        """
        Helper method to obtain an EntityReference from
        a FQN and the Entity class.
        :param entity: Entity Class
        :param fqn: Entity instance FQN
        :return: EntityReference or None
        """
        instance = self.get_by_name(entity, fqn)
        if instance:
            return EntityReference(
                id=instance.id,
                type=get_entity_type(entity),
                fullyQualifiedName=model_str(instance.fullyQualifiedName),
                description=instance.description,
                href=instance.href,
            )
        logger.warning("Cannot find the Entity %s", fqn)
        return None

    def list_entities(
        self,
        entity: Type[T],
        fields: Optional[List[str]] = None,
        after: str = None,
        limit: int = 100,
        params: Optional[Dict[str, str]] = None,
    ) -> EntityList[T]:
        """
        Helps us paginate over the collection
        """

        suffix = self.get_suffix(entity)
        url_limit = f"?limit={limit}"
        url_after = f"&after={after}" if after else ""
        url_fields = f"&fields={','.join(fields)}" if fields else ""
        resp = self.client.get(
            path=f"{suffix}{url_limit}{url_after}{url_fields}", data=params
        )

        if self._use_raw_data:
            return resp

        entities = [entity(**t) for t in resp["data"]]
        total = resp["paging"]["total"]
        after = resp["paging"]["after"] if "after" in resp["paging"] else None
        return EntityList(entities=entities, total=total, after=after)

    def list_all_entities(
        self,
        entity: Type[T],
        fields: Optional[List[str]] = None,
        limit: int = 1000,
        params: Optional[Dict[str, str]] = None,
    ) -> Iterable[T]:
        """
        Utility method that paginates over all EntityLists
        to return a generator to fetch entities
        :param entity: Entity Type, such as Table
        :param fields: Extra fields to return
        :param limit: Number of entities in each pagination
        :param params: Extra parameters, e.g., {"service": "serviceName"} to filter
        :return: Generator that will be yielding all Entities
        """

        # First batch of Entities
        entity_list = self.list_entities(
            entity=entity, fields=fields, limit=limit, params=params
        )
        for elem in entity_list.entities:
            yield elem

        after = entity_list.after
        while after:
            entity_list = self.list_entities(
                entity=entity, fields=fields, limit=limit, params=params, after=after
            )
            for elem in entity_list.entities:
                yield elem
            after = entity_list.after

    def list_versions(
        self, entity_id: Union[str, basic.Uuid], entity: Type[T]
    ) -> EntityVersionHistory:
        """
        Version history of an entity
        """

        suffix = self.get_suffix(entity)
        path = f"/{model_str(entity_id)}/versions"
        resp = self.client.get(f"{suffix}{path}")

        if self._use_raw_data:
            return resp
        return EntityVersionHistory(**resp)

    def list_services(self, entity: Type[T]) -> List[EntityList[T]]:
        """
        Service listing does not implement paging
        """

        resp = self.client.get(self.get_suffix(entity))
        if self._use_raw_data:
            return resp

        return [entity(**p) for p in resp["data"]]

    def delete(
        self,
        entity: Type[T],
        entity_id: Union[str, basic.Uuid],
        recursive: bool = False,
        hard_delete: bool = False,
    ) -> None:
        """
        API call to delete an entity from entity ID

        Args
            entity (T): entity Type
            entity_id (basic.Uuid): entity ID
        Returns
            None
        """
        url = f"{self.get_suffix(entity)}/{model_str(entity_id)}"
        url += f"?recursive={str(recursive).lower()}"
        url += f"&hardDelete={str(hard_delete).lower()}"
        self.client.delete(url)

    def compute_percentile(self, entity: Union[Type[T], str], date: str) -> None:
        """
        Compute an entity usage percentile
        """
        entity_name = get_entity_type(entity)
        resp = self.client.post(f"/usage/compute.percentile/{entity_name}/{date}")
        logger.debug("published compute percentile %s", resp)

    def list_tags_by_category(self, category: str) -> List[Tag]:
        """
        List all tags
        """
        resp = self.client.get(f"{self.get_suffix(Tag)}/{category}")
        return [Tag(**d) for d in resp["children"]]

    def health_check(self) -> bool:
        """
        Run version api call. Return `true` if response is not None
        """
        raw_version = self.client.get("/version")["version"]
        return raw_version is not None

    def close(self):
        """
        Closing connection

        Returns
            None
        """
        self.client.close()
