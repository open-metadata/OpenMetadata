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
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.connections.metadata.amundsenConnection import (
    AmundsenConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.entity.teams import team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.connections.test_connections import (
    raise_test_connection_exception,
)
from metadata.ingestion.models.user import OMetaUserProfile
from metadata.ingestion.ometa.client_utils import get_chart_entities_from_id
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.metadata.amundsen.queries import (
    NEO4J_AMUNDSEN_DASHBOARD_QUERY,
    NEO4J_AMUNDSEN_TABLE_QUERY,
    NEO4J_AMUNDSEN_USER_QUERY,
)
from metadata.utils import fqn
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger
from metadata.utils.metadata_service_helper import SERVICE_TYPE_MAPPER
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

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
            "connection": {
                "provider": "db",
                "username": "test",
                "password": "test",
            },
            "hostPort": "http://localhost:8088",
            "type": "Superset",
        }
    },
    "sourceConfig": {"config": {"chartFilterPattern": {}}},
}


class AmundsenSource(Source):
    """
    Amundsen source class
    """

    dashboard_service: DashboardService

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.database_schema_object = None
        self.database_object = None
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.client = get_connection(self.service_connection)
        self.connection_obj = self.client
        self.database_service_map = {
            service.value.lower(): service.value for service in DatabaseServiceType
        }
        self.test_connection()

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: AmundsenConnection = config.serviceConnection.root.config
        if not isinstance(connection, AmundsenConnection):
            raise InvalidSourceException(
                f"Expected AmundsenConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        """Nothing to prepare"""

    def _iter(self, *_, **__) -> Iterable[Either[Entity]]:
        table_entities = self.client.execute_query(NEO4J_AMUNDSEN_TABLE_QUERY)
        for table in table_entities:
            yield from Either(right=self.create_table_entity(table))

        user_entities = self.client.execute_query(NEO4J_AMUNDSEN_USER_QUERY)
        for user in user_entities:
            yield from Either(right=self.create_user_entity(user))
            yield from Either(right=self.add_owner_to_entity(user))

        dashboard_entities = self.client.execute_query(NEO4J_AMUNDSEN_DASHBOARD_QUERY)
        for dashboard in dashboard_entities:
            yield from Either(right=self.create_dashboard_service(dashboard))
            yield from Either(right=self.create_chart_entity(dashboard))
            yield from Either(right=self.create_dashboard_entity(dashboard))

    def create_user_entity(self, user) -> Iterable[Either[OMetaUserProfile]]:
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
            yield Either(
                right=OMetaUserProfile(
                    user=user_metadata,
                    teams=[team_metadata],
                )
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=user.name,
                    error=f"Failed to create user entity [{user}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def add_owner_to_entity(self, user) -> Iterable[Either[CreateTableRequest]]:
        """Add owner information to table entity"""
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
                    table = CreateTableRequest(
                        name=table_entity.name,
                        tableType=table_entity.tableType,
                        description=table_entity.description,
                        databaseSchema=FullyQualifiedEntityName(
                            table_entity.databaseSchema.fullyQualifiedName
                        ),
                        tags=table_entity.tags,
                        columns=table_entity.columns,
                        owners=EntityReferenceList(root=[user_entity_ref]),
                    )
                    yield Either(right=table)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(f"Failed to create user entity [{user}]: {exc}")
                yield Either(
                    left=StackTraceError(
                        name=user.get("full_name") or "User",
                        error=f"Failed to add table from user [{user}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _yield_create_database(self, table) -> Iterable[Either[CreateDatabaseRequest]]:
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
                service=service_entity.fullyQualifiedName,
            )
            yield Either(right=database_request)
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
            yield Either(
                left=StackTraceError(
                    name="Database",
                    error=f"Failed to Ingest database due to - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _yield_create_database_schema(self, table) -> Iterable[Either[DatabaseSchema]]:
        try:
            database_schema_request = CreateDatabaseSchemaRequest(
                name=table["schema"],
                database=self.database_object.fullyQualifiedName,
            )
            yield Either(right=database_schema_request)
            database_schema_fqn = fqn.build(
                self.metadata,
                entity_type=DatabaseSchema,
                service_name=table["database"],
                database_name=self.database_object.name.root,
                schema_name=database_schema_request.name.root,
            )

            self.database_schema_object = self.metadata.get_by_name(
                entity=DatabaseSchema, fqn=database_schema_fqn
            )
        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name="Database Schema",
                    error=f"Failed to Ingest database schema due to - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def create_table_entity(self, table) -> Iterable[Either[Entity]]:
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
            for name, description, data_type in columns_meta:
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

            # We are creating a couple of custom tags
            tags = [AMUNDSEN_TABLE_TAG, table["cluster"]]
            if table["tags"]:
                tags.extend(table["tags"])
            yield from get_ometa_tag_and_classification(
                tags=tags,
                classification_name=AMUNDSEN_TAG_CATEGORY,
                tag_description="Amundsen Table Tag",
                classification_description="Tags associated with amundsen entities",
            )

            table_request = CreateTableRequest(
                name=table["name"],
                tableType="Regular",
                description=table.get("description"),
                databaseSchema=self.database_schema_object.fullyQualifiedName,
                tags=get_tag_labels(
                    metadata=self.metadata,
                    tags=tags,
                    classification_name=AMUNDSEN_TAG_CATEGORY,
                    include_tags=True,
                ),
                columns=columns,
            )
            yield Either(right=table_request)

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=table.get("name") or "Table",
                    error=f"Failed to create table entity [{table}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def create_dashboard_service(
        self, dashboard: dict
    ) -> Iterable[Either[CreateDashboardRequest]]:
        service_name = dashboard["cluster"]
        SUPERSET_DEFAULT_CONFIG["serviceName"] = service_name
        config = WorkflowSource.model_validate(SUPERSET_DEFAULT_CONFIG)
        create_service_entity = self.metadata.get_create_service_from_source(
            entity=DashboardService, config=config
        )
        yield Either(right=create_service_entity)
        logger.info(f"Created Dashboard Service {service_name}")
        self.dashboard_service = self.metadata.get_by_name(
            entity=DashboardService, fqn=service_name
        )

    def create_dashboard_entity(
        self, dashboard
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to process dashboard and return CreateDashboardRequest
        """
        try:
            dashboard_request = CreateDashboardRequest(
                name=dashboard["name"],
                displayName=dashboard["name"],
                sourceUrl=dashboard["url"],
                charts=get_chart_entities_from_id(
                    chart_ids=dashboard["chart_ids"],
                    metadata=self.metadata,
                    service_name=self.dashboard_service.name.root,
                ),
                service=self.dashboard_service.fullyQualifiedName,
            )
            yield Either(right=dashboard_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=dashboard.get("name") or "Dashboard",
                    error=f"Failed to create dashboard entity [{dashboard}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def create_chart_entity(self, dashboard) -> Iterable[Either[CreateChartRequest]]:
        for name, chart_id, chart_type, url in zip(
            dashboard["chart_names"],
            dashboard["chart_ids"],
            dashboard["chart_types"],
            dashboard["chart_urls"],
        ):
            chart = CreateChartRequest(
                name=chart_id,
                displayName=name,
                sourceUrl=url,
                chartType=get_standard_chart_type(chart_type).value,
                service=self.dashboard_service.fullyQualifiedName,
            )
            yield Either(right=chart)

    def close(self):
        if self.client is not None:
            self.client.close()

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
        test_connection_fn = get_test_connection_fn(self.service_connection)
        result = test_connection_fn(
            self.metadata, self.connection_obj, self.service_connection
        )
        raise_test_connection_exception(result)
