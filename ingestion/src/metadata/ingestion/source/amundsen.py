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
import traceback
import uuid
from dataclasses import dataclass, field
from typing import Iterable, List, Optional

from pydantic import SecretStr

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataServerConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.models.user import OMetaUserProfile
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.neo4j_helper import Neo4JConfig, Neo4jHelper
from metadata.utils.column_type_parser import ColumnTypeParser
from metadata.utils.fqdn_generator import get_fqdn
from metadata.utils.helpers import get_dashboard_service_or_create
from metadata.utils.sql_queries import (
    NEO4J_AMUNDSEN_DASHBOARD_QUERY,
    NEO4J_AMUNDSEN_TABLE_QUERY,
    NEO4J_AMUNDSEN_USER_QUERY,
)

logger: logging.Logger = logging.getLogger(__name__)


class AmundsenConfig(ConfigModel):
    neo4j_username: Optional[str] = None
    neo4j_password: Optional[SecretStr] = None
    neo4j_url: str
    neo4j_max_connection_life_time: int = 50
    neo4j_encrypted: bool = True
    neo4j_validate_ssl: bool = False


PRIMITIVE_TYPES = ["int", "char", "varchar"]


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
    def __init__(
        self, config: AmundsenConfig, metadata_config: OpenMetadataServerConfig
    ):
        self.config = config
        self.metadata_config = metadata_config

        neo4j_config = Neo4JConfig(
            username=self.config.neo4j_username,
            password=self.config.neo4j_password.get_secret_value(),
            neo4j_url=self.config.neo4j_url,
            max_connection_life_time=self.config.neo4j_max_connection_life_time,
            neo4j_encrypted=self.config.neo4j_encrypted,
            neo4j_validate_ssl=self.config.neo4j_validate_ssl,
        )
        self.neo4j_helper = Neo4jHelper(neo4j_config)
        self.status = AmundsenStatus()

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataServerConfig):
        config = AmundsenConfig.parse_obj(config_dict)
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

    def create_table_entity(self, table):
        try:
            service_name = table["cluster"]
            service_type = table["database"]
            service_entity = self.get_database_service_or_create(
                service_name, service_type
            )
            database = Database(
                name=table["schema"],
                service=EntityReference(id=service_entity.id, type=service_type),
            )
            columns: List[Column] = []
            row_order = 1
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
                col = Column(**parsed_string)
                columns.append(col)

            fqn = get_fqdn(
                Table, service_name, database.name, table["schema"], table["name"]
            )
            table_entity = Table(
                id=uuid.uuid4(),
                name=table["name"],
                tableType="Regular",
                description=table["description"],
                fullyQualifiedName=fqn,
                columns=columns,
            )

            table_and_db = OMetaDatabaseAndTable(table=table_entity, database=database)
            self.status.scanned(table["name"])
            yield table_and_db
        except Exception as e:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to create table entity, due to {e}")
            self.status.failure(table["name"], str(e))
            return None

    def create_dashboard_entity(self, dashboard):
        try:
            service_name = dashboard["cluster"]
            service_entity = get_dashboard_service_or_create(
                service_name,
                DashboardServiceType.Superset.name,
                "admin",
                "admin",
                "http://localhost:8088",
                self.metadata_config,
            )
            self.status.scanned(dashboard["name"])
            yield Dashboard(
                name=dashboard["name"],
                displayName=dashboard["name"],
                description="",
                url=dashboard["url"],
                charts=dashboard["chart_ids"],
                service=EntityReference(id=service_entity.id, type="dashboardService"),
            )
        except Exception as e:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to create table entity, due to {e}")
            self.status.failure(dashboard["name"], str(e))
            return None

    def create_chart_entity(self, dashboard):
        service_name = dashboard["cluster"]
        service_entity = get_dashboard_service_or_create(
            service_name,
            DashboardServiceType.Superset.name,
            "admin",
            "admin",
            "http://localhost:8088",
            self.metadata_config,
        )

        for (name, chart_id, chart_type, url) in zip(
            dashboard["chart_names"],
            dashboard["chart_ids"],
            dashboard["chart_types"],
            dashboard["chart_urls"],
        ):
            chart = Chart(
                name=chart_id,
                displayName=name,
                description="",
                chart_url=url,
                chart_type=chart_type,
                service=EntityReference(id=service_entity.id, type="dashboardService"),
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

    def get_database_service_or_create(
        self, service_name: str, service_type: str
    ) -> DatabaseService:
        metadata = OpenMetadata(self.metadata_config)
        service = metadata.get_by_name(entity=DatabaseService, fqdn=service_name)
        if service is not None:
            return service
        else:
            service = {
                "databaseConnection": {"hostPort": f"localhost"},
                "name": service_name,
                "description": "",
                "serviceType": service_type.capitalize(),
            }
            created_service = metadata.create_or_update(
                CreateDatabaseServiceRequest(**service)
            )
            return created_service
