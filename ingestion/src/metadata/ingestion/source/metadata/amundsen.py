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

import traceback
import uuid
from dataclasses import dataclass, field
from typing import Iterable, List, Optional

from pydantic import SecretStr

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
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
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.models.user import OMetaUserProfile
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.column_type_parser import ColumnTypeParser
from metadata.utils.helpers import (
    get_chart_entities_from_id,
    get_dashboard_service_or_create,
    get_standard_chart_type,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.neo4j_helper import Neo4JConfig, Neo4jHelper
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


@dataclass
class AmundsenStatus(SourceStatus):
    success: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    filtered: List[str] = field(default_factory=list)

    def scanned(self, entity_name: str) -> None:
        self.success.append(entity_name)
        logger.info("Entity Scanned: {}".format(entity_name))

    def failure(self, key: str, reason: str) -> None:
        self.failures.append({key: reason})


class AmundsenSource(Source[Entity]):
    dashboard_service: DashboardService

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        self.config = config
        self.metadata_config = metadata_config
        self.service_connection = config.serviceConnection.__root__.config
        self.metadata = OpenMetadata(self.metadata_config)

        neo4j_config = Neo4JConfig(
            username=self.service_connection.username,
            password=self.service_connection.password.get_secret_value(),
            neo4j_url=self.service_connection.hostPort,
            max_connection_life_time=self.service_connection.maxConnectionLifeTime,
            neo4j_encrypted=self.service_connection.encrypted,
            neo4j_validate_ssl=self.service_connection.validateSSL,
        )
        self.neo4j_helper = Neo4jHelper(neo4j_config)
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
        user_entities = self.neo4j_helper.execute_query(NEO4J_AMUNDSEN_USER_QUERY)
        for user in user_entities:
            yield from self.create_user_entity(user)

        table_entities = self.neo4j_helper.execute_query(NEO4J_AMUNDSEN_TABLE_QUERY)
        for table in table_entities:
            yield from self.create_table_entity(table)

        dashboard_entities = self.neo4j_helper.execute_query(
            NEO4J_AMUNDSEN_DASHBOARD_QUERY
        )
        for dashboard in dashboard_entities:
            yield from self.create_dashboard_service(dashboard)
            yield from self.create_chart_entity(dashboard)
            yield from self.create_dashboard_entity(dashboard)

    def create_user_entity(self, user):
        try:
            user_metadata = CreateUserRequest(
                email=user["email"],
                name=user["full_name"],
                displayName=f"{user['first_name']} {user['last_name']}",
            )
            team_metadata = CreateTeamRequest(name=user["team_name"])
            self.status.scanned(str(user_metadata.email))
            yield OMetaUserProfile(
                user=user_metadata,
                teams=[team_metadata],
            )
        except Exception as err:
            logger.error(err)

    def create_tags(self, tags):
        for tag in tags:
            tag_category = OMetaTagAndCategory(
                category_name=CreateTagCategoryRequest(
                    name=AMUNDSEN_TAG_CATEGORY,
                    description="Tags associates with amundsen entities",
                    categoryType="Descriptive",
                ),
                category_details=CreateTagRequest(
                    name=tag, description="Amundsen Table Tag"
                ),
            )
            yield tag_category
            logger.info(f"Tag Category {tag_category}, Primary Tag {tag} Ingested")

    def create_table_entity(self, table):
        try:
            service_name = table["database"]
            service_type = self.database_service_map.get(
                service_name.lower(), DatabaseServiceType.Mysql.value
            )

            # TODO: use metadata.get_service_or_create
            service_entity = self.get_database_service(service_name)
            database = Database(
                id=uuid.uuid4(),
                name="default",
                service=EntityReference(id=service_entity.id, type=service_type),
            )
            database_schema = DatabaseSchema(
                name=table["schema"],
                service=EntityReference(id=service_entity.id, type=service_type),
                database=EntityReference(id=database.id.__root__, type="database"),
            )

            columns: List[Column] = []
            for (name, description, data_type) in zip(
                table["column_names"],
                table["column_descriptions"],
                table["column_types"],
            ):
                # Amundsen merges the length into type itself. Instead of making changes to our generic type builder
                # we will do a type match and see if it matches any primitive types and return a type
                data_type = self.get_type_primitive_type(data_type)
                parsed_string = ColumnTypeParser._parse_datatype_string(data_type)
                parsed_string["name"] = name
                parsed_string["dataLength"] = 1
                parsed_string["description"] = description
                col = Column(**parsed_string)
                columns.append(col)
            amundsen_table_tag = OMetaTagAndCategory(
                category_name=CreateTagCategoryRequest(
                    name=AMUNDSEN_TAG_CATEGORY,
                    description="Tags associates with amundsen entities",
                    categoryType="Descriptive",
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
                    categoryType="Descriptive",
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
            table_entity = Table(
                id=uuid.uuid4(),
                name=table["name"],
                tableType="Regular",
                description=table["description"],
                tags=tags,
                columns=columns,
            )

            table_and_db = OMetaDatabaseAndTable(
                table=table_entity, database=database, database_schema=database_schema
            )
            self.status.scanned(table["name"])
            yield table_and_db
        except Exception as e:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to create table entity, due to {e}")
            self.status.failure(table["name"], str(e))
            return None

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
        except Exception as e:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to create table entity, due to {e}")
            self.status.failure(dashboard["name"], str(e))
            return None

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
        if self.neo4j_helper is not None:
            self.neo4j_helper.close()

    def get_status(self) -> SourceStatus:
        return self.status

    def get_type_primitive_type(self, data_type):
        for p_type in PRIMITIVE_TYPES:
            if data_type.startswith(p_type):
                return p_type
        return data_type

    def get_database_service(self, service_name: str) -> DatabaseService:
        service = self.metadata.get_by_name(entity=DatabaseService, fqn=service_name)
        if service is not None:
            return service
        else:
            logger.error(f"Please create a service with name {service_name}")

    def test_connection(self) -> None:
        pass
