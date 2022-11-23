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
Amundsen source to extract metadata
"""

import traceback
from typing import Iterable, List, Optional

from pydantic import SecretStr
from sqlalchemy.engine.url import make_url

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.tags.createTag import CreateTagRequest
from metadata.generated.schema.api.tags.createTagCategory import (
    CreateTagCategoryRequest,
)
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.connections.metadata.amundsenConnection import (
    AmundsenConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.entity.teams import team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.models.user import OMetaUserProfile
from metadata.ingestion.ometa.client_utils import get_chart_entities_from_id
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.utils import fqn
from metadata.utils.amundsen_helper import SERVICE_TYPE_MAPPER
from metadata.utils.connections import get_connection
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger
from metadata.utils.sql_queries import (
    NEO4J_AMUNDSEN_DASHBOARD_QUERY,
    NEO4J_AMUNDSEN_TABLE_QUERY,
    NEO4J_AMUNDSEN_USER_QUERY,
)

logger = ingestion_logger()


class AmundsenConfig(ConfigModel):
    neo4j_username: Optional[str] = None
    neo4j_password: Optional[SecretStr] = None
    neo4j_url: str
    neo4j_max_connection_life_time: int = 50
    neo4j_encrypted: bool = True
    neo4j_validate_ssl: bool = False


PRIMITIVE_TYPES = ["int", "char", "varchar"]
AMUNDSEN_TAG_CATEGORY = "AmundsenTags"
AMUNDSEN_TABLE_TAG = "amundsen_table"


SUPERSET_DEFAULT_CONFIG = {
    "type": "superset",
    "serviceConnection": {
        "config": {
            "username": "test",
            "password": "test",
            "hostPort": "http://localhost:8088",
            "type": "Superset",
        }
    },
    "sourceConfig": {"config": {"chartFilterPattern": {}}},
}


class AmundsenStatus(SourceStatus):
    success: List[str] = []
    failures: List[str] = []
    warnings: List[str] = []
    filtered: List[str] = []

    def scanned(self, record: str) -> None:
        self.success.append(record)
        logger.info(f"Entity Scanned: {record}")

    def failure(self, key: str, reason: str) -> None:
        self.failures.append({key: reason})


class AmundsenSource(Source[Entity]):
    """
    Amundsen source class
    """

    dashboard_service: DashboardService

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        self.config = config
        self.metadata_config = metadata_config
        self.database_schema_object = None
        self.database_object = None
        self.metadata = OpenMetadata(self.metadata_config)
        self.service_connection = self.config.serviceConnection.__root__.config
        self.connection = get_connection(self.service_connection)
        self.client = self.connection.client
        self.status = AmundsenStatus()
        self.database_service_map = {
            service.value.lower(): service.value for service in DatabaseServiceType
        }

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: AmundsenConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, AmundsenConnection):
            raise InvalidSourceException(
                f"Expected AmundsenConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Entity]:
        table_entities = self.client.execute_query(NEO4J_AMUNDSEN_TABLE_QUERY)
        for table in table_entities:
            yield from self.create_table_entity(table)

        user_entities = self.client.execute_query(NEO4J_AMUNDSEN_USER_QUERY)
        for user in user_entities:
            yield from self.create_user_entity(user)
            yield from self.add_owner_to_entity(user)

        dashboard_entities = self.client.execute_query(NEO4J_AMUNDSEN_DASHBOARD_QUERY)
        for dashboard in dashboard_entities:
            yield from self.create_dashboard_service(dashboard)
            yield from self.create_chart_entity(dashboard)
            yield from self.create_dashboard_entity(dashboard)

    def create_user_entity(self, user):
        try:
            user_metadata = CreateUserRequest(
                email=user["email"],
                name=user["full_name"].lower().replace(" ", "_"),
                displayName=f"{user['first_name']} {user['last_name']}",
            )
            team_metadata = CreateTeamRequest(
                name=user["team_name"],
                teamType=team.TeamType.Department.value,
            )
            self.status.scanned(str(user_metadata.email))
            yield OMetaUserProfile(
                user=user_metadata,
                teams=[team_metadata],
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to create user entity [{user}]: {exc}")

    def add_owner_to_entity(self, user):
        """Add owner information to table entity

        Args:
            user: Amundsen user (previously added to OM)
        """
        user_entity_ref = self.metadata.get_entity_reference(
            entity=User, fqn=user["full_name"].lower().replace(" ", "_")
        )

        if not user_entity_ref:
            logger.warning(f"No entity found for user {user['full_name']}")

        for entity in user["entities_owned"]:
            try:
                service_url = make_url(entity["key"])
                service_entity: DatabaseService = self.metadata.get_by_name(
                    entity=DatabaseService, fqn=service_url.get_backend_name()
                )
                if service_entity:
                    service = service_url.get_backend_name()
                    database_schema = (
                        service_url.host
                        if hasattr(service_entity.connection.config, "supportsDatabase")
                        else f"default.{service_url.host.split('.')[-1]}"
                    )
                    table = service_url.database
                    table_fqn = f"{service}.{database_schema}.{table}"
                    table_entity: Table = self.metadata.get_by_name(
                        entity=Table, fqn=table_fqn
                    )
                    yield CreateTableRequest(
                        name=table_entity.name,
                        tableType=table_entity.tableType,
                        description=table_entity.description,
                        databaseSchema=table_entity.databaseSchema,
                        tags=table_entity.tags,
                        columns=table_entity.columns,
                        owner=user_entity_ref,
                    )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(f"Failed to create user entity [{user}]: {exc}")

    def create_tags(self, tags):
        for tag in tags:
            tag_category = OMetaTagAndCategory(
                category_name=CreateTagCategoryRequest(
                    name=AMUNDSEN_TAG_CATEGORY,
                    description="Tags associates with amundsen entities",
                ),
                category_details=CreateTagRequest(
                    name=tag, description="Amundsen Table Tag"
                ),
            )
            yield tag_category
            logger.info(f"Tag Category {tag_category}, Primary Tag {tag} Ingested")

    def _yield_create_database(self, table):
        try:
            service_entity = self.get_database_service(table["database"])
            table_name = ""
            if hasattr(service_entity.connection.config, "supportsDatabase"):
                table_name = table["cluster"]
            else:
                table_name = "default"

            database_request = CreateDatabaseRequest(
                name=table_name
                if hasattr(service_entity.connection.config, "supportsDatabase")
                else "default",
                service=EntityReference(id=service_entity.id, type="databaseService"),
            )
            yield database_request
            database_fqn = fqn.build(
                self.metadata,
                entity_type=Database,
                service_name=table["database"],
                database_name=table_name,
            )

            self.database_object = self.metadata.get_by_name(
                entity=Database, fqn=database_fqn
            )
        except Exception as err:
            logger.error(f"Failed to Ingest database due to - {err}")
            logger.debug(traceback.format_exc())

    def _yield_create_database_schema(self, table):
        try:

            database_schema_request = CreateDatabaseSchemaRequest(
                name=table["schema"],
                database=EntityReference(id=self.database_object.id, type="database"),
            )
            yield database_schema_request
            database_schema_fqn = fqn.build(
                self.metadata,
                entity_type=DatabaseSchema,
                service_name=table["database"],
                database_name=self.database_object.name.__root__,
                schema_name=database_schema_request.name.__root__,
            )

            self.database_schema_object = self.metadata.get_by_name(
                entity=DatabaseSchema, fqn=database_schema_fqn
            )
        except Exception as err:
            logger.error(f"Failed to Ingest database due to - {err}")
            logger.debug(traceback.format_exc())

    def create_table_entity(self, table):
        """
        Process table details and return CreateTableRequest
        """
        try:
            yield from self._yield_create_database(table)
            yield from self._yield_create_database_schema(table)
            columns: List[Column] = []
            if len(table["column_names"]) == len(table["column_descriptions"]):
                # zipping on column_descriptions can cause incorrect or no ingestion
                # of column metadata as zip will zip on the smallest list len.
                columns_meta = zip(
                    table["column_names"],
                    table["column_descriptions"],
                    table["column_types"],
                )
            else:
                columns_meta = zip(
                    table["column_names"],
                    [None] * len(table["column_names"]),
                    table["column_types"],
                )
            for (name, description, data_type) in columns_meta:
                # Amundsen merges the length into type itself. Instead of making changes to our generic type builder
                # we will do a type match and see if it matches any primitive types and return a type
                data_type = self.get_type_primitive_type(data_type)
                parsed_string = ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
                    data_type
                )
                parsed_string["name"] = name
                parsed_string["dataLength"] = 1
                parsed_string["description"] = description
                col = Column(**parsed_string)
                columns.append(col)
            amundsen_table_tag = OMetaTagAndCategory(
                category_name=CreateTagCategoryRequest(
                    name=AMUNDSEN_TAG_CATEGORY,
                    description="Tags associates with amundsen entities",
                ),
                category_details=CreateTagRequest(
                    name=AMUNDSEN_TABLE_TAG, description="Amundsen Table Tag"
                ),
            )
            yield amundsen_table_tag
            amundsen_cluster_tag = OMetaTagAndCategory(
                category_name=CreateTagCategoryRequest(
                    name=AMUNDSEN_TAG_CATEGORY,
                    description="Tags associates with amundsen entities",
                ),
                category_details=CreateTagRequest(
                    name=table["cluster"], description="Amundsen Cluster Tag"
                ),
            )
            yield amundsen_cluster_tag
            tags = [
                TagLabel(
                    tagFQN=fqn.build(
                        self.metadata,
                        Tag,
                        tag_category_name=AMUNDSEN_TAG_CATEGORY,
                        tag_name=AMUNDSEN_TABLE_TAG,
                    ),
                    labelType="Automated",
                    state="Suggested",
                    source="Tag",
                ),
                TagLabel(
                    tagFQN=fqn.build(
                        self.metadata,
                        Tag,
                        tag_category_name=AMUNDSEN_TAG_CATEGORY,
                        tag_name=table["cluster"],
                    ),
                    labelType="Automated",
                    state="Suggested",
                    source="Tag",
                ),
            ]
            if table["tags"]:
                yield from self.create_tags(table["tags"])
                tags.extend(
                    [
                        TagLabel(
                            tagFQN=fqn.build(
                                self.metadata,
                                Tag,
                                tag_category_name=AMUNDSEN_TAG_CATEGORY,
                                tag_name=tag,
                            ),
                            labelType="Automated",
                            state="Suggested",
                            source="Tag",
                        )
                        for tag in table["tags"]
                    ]
                )
            table_request = CreateTableRequest(
                name=table["name"],
                tableType="Regular",
                description=table["description"],
                databaseSchema=EntityReference(
                    id=self.database_schema_object.id, type="databaseSchema"
                ),
                tags=tags,
                columns=columns,
            )

            yield table_request

            self.status.scanned(table["name"])
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to create table entity [{table}]: {exc}")
            self.status.failure(table["name"], str(exc))

    def create_dashboard_service(self, dashboard: dict):
        service_name = dashboard["cluster"]
        SUPERSET_DEFAULT_CONFIG["serviceName"] = service_name
        config = WorkflowSource.parse_obj(SUPERSET_DEFAULT_CONFIG)
        create_service_entity = self.metadata.get_create_service_from_source(
            entity=DashboardService, config=config
        )
        yield create_service_entity
        logger.info(f"Created Dashboard Service {service_name}")
        self.dashboard_service = self.metadata.get_by_name(
            entity=DashboardService, fqn=service_name
        )

    def create_dashboard_entity(self, dashboard):
        """
        Method to process dashboard and return CreateDashboardRequest
        """
        try:
            self.status.scanned(dashboard["name"])
            yield CreateDashboardRequest(
                name=dashboard["name"],
                displayName=dashboard["name"],
                description="",
                dashboardUrl=dashboard["url"],
                charts=get_chart_entities_from_id(
                    chart_ids=dashboard["chart_ids"],
                    metadata=self.metadata,
                    service_name=self.dashboard_service.name.__root__,
                ),
                service=EntityReference(
                    id=self.dashboard_service.id, type="dashboardService"
                ),
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to create dashboard entity [{dashboard}]: {exc}")
            self.status.failure(dashboard["name"], str(exc))

    def create_chart_entity(self, dashboard):
        for (name, chart_id, chart_type, url) in zip(
            dashboard["chart_names"],
            dashboard["chart_ids"],
            dashboard["chart_types"],
            dashboard["chart_urls"],
        ):
            chart = CreateChartRequest(
                name=chart_id,
                displayName=name,
                description="",
                chartUrl=url,
                chartType=get_standard_chart_type(chart_type).value,
                service=EntityReference(
                    id=self.dashboard_service.id, type="dashboardService"
                ),
            )
            self.status.scanned(name)
            yield chart

    def close(self):
        if self.client is not None:
            self.client.close()

    def get_status(self) -> SourceStatus:
        return self.status

    def get_type_primitive_type(self, data_type):
        for p_type in PRIMITIVE_TYPES:
            if data_type.startswith(p_type):
                return p_type
        return data_type

    def get_database_service(self, service_name: str) -> DatabaseService:
        """
        Method to get and create Database Service
        """
        service = self.metadata.create_or_update(
            CreateDatabaseServiceRequest(
                name=service_name,
                displayName=service_name,
                connection=SERVICE_TYPE_MAPPER.get(
                    service_name, SERVICE_TYPE_MAPPER["mysql"]["connection"]
                )["connection"],
                serviceType=SERVICE_TYPE_MAPPER.get(
                    service_name, SERVICE_TYPE_MAPPER["mysql"]["service_name"]
                )["service_name"],
            ),
        )

        if service is not None:
            return service
        logger.error(f"Please create a service with name {service_name}")
        return None

    def test_connection(self) -> None:
        pass
