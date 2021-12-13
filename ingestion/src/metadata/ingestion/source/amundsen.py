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
import re
import textwrap
import traceback
import uuid
from dataclasses import dataclass, field
from typing import Iterable, List, Optional

from pydantic import SecretStr

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceEntityRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.models.user import User
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.neo4j_helper import Neo4JConfig, Neo4jHelper
from metadata.utils.column_helpers import check_column_complex_type, get_column_type
from metadata.utils.helpers import get_dashboard_service_or_create

logger: logging.Logger = logging.getLogger(__name__)


class AmundsenConfig(ConfigModel):
    neo4j_username: Optional[str] = None
    neo4j_password: Optional[SecretStr] = None
    neo4j_url: str
    neo4j_max_connection_life_time: int = 50
    neo4j_encrypted: bool = True
    neo4j_validate_ssl: bool = False


PRIMITIVE_TYPES = ["int", "char", "varchar"]

NEO4J_AMUNDSEN_TABLE_QUERY = textwrap.dedent(
    """
        MATCH (db:Database)<-[:CLUSTER_OF]-(cluster:Cluster)
        <-[:SCHEMA_OF]-(schema:Schema)<-[:TABLE_OF]-(table:Table)
        OPTIONAL MATCH (table)-[:DESCRIPTION]->(table_description:Description)
        OPTIONAL MATCH (schema)-[:DESCRIPTION]->(schema_description:Description)
        OPTIONAL MATCH (table)-[:DESCRIPTION]->(prog_descs:Programmatic_Description)
        WITH db, cluster, schema, schema_description, table, table_description,
        COLLECT(prog_descs.description) as programmatic_descriptions
        OPTIONAL MATCH (table)-[:TAGGED_BY]->(tags:Tag) WHERE tags.tag_type='default'
        WITH db, cluster, schema, schema_description, table, table_description, programmatic_descriptions,
        COLLECT(DISTINCT tags.key) as tags
        OPTIONAL MATCH (table)-[:HAS_BADGE]->(badges:Badge)
        WITH db, cluster, schema, schema_description, table, table_description, programmatic_descriptions, tags,
        COLLECT(DISTINCT badges.key) as badges
        OPTIONAL MATCH (table)-[read:READ_BY]->(user:User)
        WITH db, cluster, schema, schema_description, table, table_description, programmatic_descriptions, tags, badges,
        SUM(read.read_count) AS total_usage,
        COUNT(DISTINCT user.email) as unique_usage
        OPTIONAL MATCH (table)-[:COLUMN]->(col:Column)
        OPTIONAL MATCH (col)-[:DESCRIPTION]->(col_description:Description)
        WITH db, cluster, schema, schema_description, table, table_description, tags, badges, total_usage, unique_usage,
        programmatic_descriptions,
        COLLECT(col.name) AS column_names, COLLECT(col_description.description) AS column_descriptions,
        COLLECT(col.col_type) AS column_types
        OPTIONAL MATCH (table)-[:LAST_UPDATED_AT]->(time_stamp:Timestamp)
        RETURN db.name as database, cluster.name AS cluster, schema.name AS schema,
        schema_description.description AS schema_description,
        table.name AS name, table.key AS key, table_description.description AS description,
        time_stamp.last_updated_timestamp AS last_updated_timestamp,
        column_names,
        column_descriptions,
        column_types,
        total_usage,
        unique_usage,
        tags,
        badges,
        programmatic_descriptions
        ORDER BY table.name;
        """
)

NEO4J_AMUNDSEN_USER_QUERY = textwrap.dedent(
    """
        MATCH (user:User)
        OPTIONAL MATCH (user)-[read:READ]->(a)
        OPTIONAL MATCH (user)-[own:OWNER_OF]->(b)
        OPTIONAL MATCH (user)-[follow:FOLLOWED_BY]->(c)
        OPTIONAL MATCH (user)-[manage_by:MANAGE_BY]->(manager)
        with user, a, b, c, read, own, follow, manager
        where user.full_name is not null
        return user.email as email, user.first_name as first_name, user.last_name as last_name,
        user.full_name as full_name, user.github_username as github_username, user.team_name as team_name,
        user.employee_type as employee_type, manager.email as manager_email,
        user.slack_id as slack_id, user.is_active as is_active, user.role_name as role_name,
        REDUCE(sum_r = 0, r in COLLECT(DISTINCT read)| sum_r + r.read_count) AS total_read,
        count(distinct b) as total_own,
        count(distinct c) AS total_follow
        order by user.email
        """
)

NEO4J_AMUNDSEN_DASHBOARD_QUERY = textwrap.dedent(
    """
         MATCH (dashboard:Dashboard)
         MATCH (dashboard)-[:DASHBOARD_OF]->(dbg:Dashboardgroup)
         MATCH (dbg)-[:DASHBOARD_GROUP_OF]->(cluster:Cluster)
         OPTIONAL MATCH (dashboard)-[:DESCRIPTION]->(db_descr:Description)
         OPTIONAL MATCH (dbg)-[:DESCRIPTION]->(dbg_descr:Description)
         OPTIONAL MATCH (dashboard)-[:EXECUTED]->(last_exec:Execution)
         WHERE split(last_exec.key, '/')[5] = '_last_successful_execution'
         OPTIONAL MATCH (dashboard)-[read:READ_BY]->(user:User)
         WITH dashboard, dbg, db_descr, dbg_descr, cluster, last_exec, SUM(read.read_count) AS total_usage
         OPTIONAL MATCH (dashboard)-[:HAS_QUERY]->(query:Query)-[:HAS_CHART]->(chart:Chart)
         WITH dashboard, dbg, db_descr, dbg_descr, cluster, last_exec, COLLECT(DISTINCT query.name) as query_names,
         COLLECT(chart.name) as chart_names,
         COLLECT(chart.id) as chart_ids,
         COLLECT(chart.url) as chart_urls,
         COLLECT(chart.type) as chart_types,
         total_usage
         OPTIONAL MATCH (dashboard)-[:TAGGED_BY]->(tags:Tag) WHERE tags.tag_type='default'
         WITH dashboard, dbg, db_descr, dbg_descr, cluster, last_exec, query_names, chart_names, chart_ids, chart_urls,
         chart_types, total_usage,
         COLLECT(DISTINCT tags.key) as tags
         OPTIONAL MATCH (dashboard)-[:HAS_BADGE]->(badges:Badge)
         WITH  dashboard, dbg, db_descr, dbg_descr, cluster, last_exec, query_names, chart_names, chart_ids, chart_urls,
         chart_types, total_usage, tags,
         COLLECT(DISTINCT badges.key) as badges
         RETURN dbg.name as group_name, dashboard.name as name, cluster.name as cluster,
         coalesce(db_descr.description, '') as description,
         coalesce(dbg.description, '') as group_description, dbg.dashboard_group_url as group_url,
         dashboard.dashboard_id as dashboard_id,
         dashboard.dashboard_url as url, dashboard.key as uri,
         split(dashboard.key, '_')[0] as product, toInteger(last_exec.timestamp) as last_successful_run_timestamp,
         query_names, chart_names, chart_ids, chart_urls, chart_types, total_usage, tags, badges
         order by dbg.name
        """
)


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
        self, config: AmundsenConfig, metadata_config: MetadataServerConfig, ctx
    ):
        self.config = config
        self.metadata_config = metadata_config
        self.ctx = ctx
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
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = AmundsenConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

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
            user_metadata = User(
                email=user["email"],
                first_name=user["first_name"],
                last_name=user["last_name"],
                name=user["full_name"],
                team_name=user["team_name"],
                is_active=user["is_active"],
            )
            self.status.scanned(user_metadata.email)
            yield user_metadata
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
                (
                    col_type,
                    data_type_display,
                    arr_data_type,
                    children,
                ) = check_column_complex_type(
                    self.status, table["name"], data_type, name
                )

                col = Column(
                    name=name,
                    description=description,
                    dataType=col_type,
                    dataTypeDisplay="{}({})".format(col_type, 1)
                    if data_type_display is None
                    else f"{data_type_display}",
                    children=children,
                    arrayDataType=arr_data_type,
                    ordinalPosition=row_order,
                    dataLength=1,
                )
                row_order += 1
                columns.append(col)

            fqn = f"{service_name}.{database.name}.{table['schema']}.{table['name']}"
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
                "jdbc": {
                    "connectionUrl": f"jdbc://temp",
                    "driverClass": "jdbc",
                },
                "name": service_name,
                "description": "",
                "serviceType": service_type.capitalize(),
            }
            created_service = metadata.create_or_update(
                CreateDatabaseServiceEntityRequest(**service)
            )
            return created_service
