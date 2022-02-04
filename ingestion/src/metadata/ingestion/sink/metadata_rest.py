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
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createLocation import CreateLocationRequest
from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.policies.createPolicy import CreatePolicyRequest
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.location import Location
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity, WorkflowContext
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.models.ometa_policy import OMetaPolicy
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.table_metadata import Chart, Dashboard, DeleteTable
from metadata.ingestion.models.user import OMetaUserProfile
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig

logger = logging.getLogger(__name__)

# Allow types from the generated pydantic models
T = TypeVar("T", bound=BaseModel)

om_chart_type_dict = {
    "line": ChartType.Line,
    "table": ChartType.Table,
    "dist_bar": ChartType.Bar,
    "bar": ChartType.Bar,
    "big_number": ChartType.Line,
    "histogram": ChartType.Histogram,
    "big_number_total": ChartType.Line,
    "dual_line": ChartType.Line,
    "line_multi": ChartType.Line,
    "treemap": ChartType.Area,
    "box_plot": ChartType.Bar,
}


class MetadataRestSinkConfig(ConfigModel):
    api_endpoint: str = None


class MetadataRestSink(Sink[Entity]):
    config: MetadataRestSinkConfig
    status: SinkStatus

    def __init__(
        self,
        ctx: WorkflowContext,
        config: MetadataRestSinkConfig,
        metadata_config: MetadataServerConfig,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = SinkStatus()
        self.wrote_something = False
        self.charts_dict = {}
        self.metadata = OpenMetadata(self.metadata_config)
        self.role_entities = {}
        self.team_entities = {}

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        config = MetadataRestSinkConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def write_record(self, record: Entity) -> None:
        if isinstance(record, OMetaDatabaseAndTable):
            self.write_tables(record)
        elif isinstance(record, CreateTopicRequest):
            self.write_topics(record)
        elif isinstance(record, Chart):
            self.write_charts(record)
        elif isinstance(record, Dashboard):
            self.write_dashboards(record)
        elif isinstance(record, Location):
            self.write_locations(record)
        elif isinstance(record, OMetaPolicy):
            self.write_policies(record)
        elif isinstance(record, Pipeline):
            self.write_pipelines(record)
        elif isinstance(record, AddLineageRequest):
            self.write_lineage(record)
        elif isinstance(record, OMetaUserProfile):
            self.write_users(record)
        elif isinstance(record, CreateMlModelRequest):
            self.write_ml_model(record)
        elif isinstance(record, DeleteTable):
            self.delete_table(record)
        else:
            logging.info(
                f"Ignoring the record due to unknown Record type {type(record)}"
            )

    def write_tables(self, db_and_table: OMetaDatabaseAndTable):
        try:
            db_request = CreateDatabaseRequest(
                name=db_and_table.database.name,
                description=db_and_table.database.description,
                service=EntityReference(
                    id=db_and_table.database.service.id,
                    type="databaseService",
                ),
            )
            db = self.metadata.create_or_update(db_request)
            if db_and_table.table.description is not None:
                db_and_table.table.description = db_and_table.table.description.strip()

            table_request = CreateTableRequest(
                name=db_and_table.table.name,
                tableType=db_and_table.table.tableType,
                columns=db_and_table.table.columns,
                description=db_and_table.table.description,
                database=db.id,
            )
            if db_and_table.table.viewDefinition:
                table_request.viewDefinition = (
                    db_and_table.table.viewDefinition.__root__
                )

            created_table = self.metadata.create_or_update(table_request)
            if db_and_table.location is not None:
                if db_and_table.location.description is not None:
                    db_and_table.location.description = (
                        db_and_table.location.description.strip()
                    )
                location_request = CreateLocationRequest(
                    name=db_and_table.location.name,
                    description=db_and_table.location.description,
                    locationType=db_and_table.location.locationType,
                    owner=db_and_table.location.owner,
                    service=EntityReference(
                        id=db_and_table.location.service.id,
                        type="storageService",
                    ),
                )
                location = self.metadata.create_or_update(location_request)
                self.metadata.add_location(table=created_table, location=location)
            if db_and_table.table.sampleData is not None:
                try:
                    self.metadata.ingest_table_sample_data(
                        table=created_table,
                        sample_data=db_and_table.table.sampleData,
                    )
                except Exception as e:
                    logging.error(
                        f"Failed to ingest sample data for table {db_and_table.table.name}"
                    )

            if db_and_table.table.tableProfile is not None:
                for tp in db_and_table.table.tableProfile:
                    for pd in tp:
                        if pd[0] == "columnProfile":
                            for col in pd[1]:
                                col.name = col.name.replace(".", "_DOT_")
                self.metadata.ingest_table_profile_data(
                    table=created_table,
                    table_profile=db_and_table.table.tableProfile,
                )

            if db_and_table.table.dataModel is not None:
                self.metadata.ingest_table_data_model(
                    table=created_table, data_model=db_and_table.table.dataModel
                )

            logger.info(
                "Successfully ingested table {}.{}".format(
                    db_and_table.database.name.__root__,
                    created_table.name.__root__,
                )
            )
            self.status.records_written(
                f"Table: {db_and_table.database.name.__root__}.{created_table.name.__root__}"
            )
        except (APIError, ValidationError) as err:
            logger.error(
                "Failed to ingest table {} in database {} ".format(
                    db_and_table.table.name.__root__,
                    db_and_table.database.name.__root__,
                )
            )
            logger.error(err)
            self.status.failure(f"Table: {db_and_table.table.name.__root__}")

    def write_topics(self, topic: CreateTopicRequest) -> None:
        try:
            created_topic = self.metadata.create_or_update(topic)
            logger.info(f"Successfully ingested topic {created_topic.name.__root__}")
            self.status.records_written(f"Topic: {created_topic.name.__root__}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest topic {topic.name.__root__}")
            logger.error(err)
            self.status.failure(f"Topic: {topic.name}")

    def write_charts(self, chart: Chart):
        try:
            om_chart_type = ChartType.Other
            if (
                chart.chart_type is not None
                and chart.chart_type in om_chart_type_dict.keys()
            ):
                om_chart_type = om_chart_type_dict[chart.chart_type]

            chart_request = CreateChartRequest(
                name=chart.name,
                displayName=chart.displayName,
                description=chart.description,
                chartType=om_chart_type,
                chartUrl=chart.url,
                service=chart.service,
            )
            created_chart = self.metadata.create_or_update(chart_request)
            self.charts_dict[chart.name] = EntityReference(
                id=created_chart.id, type="chart"
            )
            logger.info(f"Successfully ingested chart {created_chart.displayName}")
            self.status.records_written(f"Chart: {created_chart.displayName}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest chart {chart.displayName}")
            logger.error(err)
            self.status.failure(f"Chart: {chart.displayName}")

    def write_dashboards(self, dashboard: Dashboard):
        try:
            charts = self._get_chart_references(dashboard)

            dashboard_request = CreateDashboardRequest(
                name=dashboard.name,
                displayName=dashboard.displayName,
                description=dashboard.description,
                dashboardUrl=dashboard.url,
                charts=charts,
                service=dashboard.service,
            )
            created_dashboard = self.metadata.create_or_update(dashboard_request)
            logger.info(
                f"Successfully ingested dashboard {created_dashboard.displayName}"
            )
            self.status.records_written(f"Dashboard: {created_dashboard.displayName}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest dashboard {dashboard.name}")
            logger.error(err)
            self.status.failure(f"Dashboard {dashboard.name}")

    def _get_chart_references(self, dashboard: Dashboard) -> []:
        chart_references = []
        for chart_id in dashboard.charts:
            if chart_id in self.charts_dict.keys():
                chart_references.append(self.charts_dict[chart_id])
        return chart_references

    def write_locations(self, location: Location):
        try:
            created_location = self._create_location(location)
            logger.info(f"Successfully ingested Location {created_location.name}")
            self.status.records_written(f"Location: {created_location.name}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest Location {location.name}")
            logger.error(err)
            self.status.failure(f"Location: {location.name}")

    def write_pipelines(self, pipeline: Pipeline):
        try:
            pipeline_request = CreatePipelineRequest(
                name=pipeline.name,
                displayName=pipeline.displayName,
                description=pipeline.description,
                pipelineUrl=pipeline.pipelineUrl,
                tasks=pipeline.tasks,
                service=pipeline.service,
            )
            created_pipeline = self.metadata.create_or_update(pipeline_request)
            logger.info(
                f"Successfully ingested Pipeline {created_pipeline.displayName}"
            )
            self.status.records_written(f"Pipeline: {created_pipeline.displayName}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest pipeline {pipeline.name}")
            logger.error(err)
            self.status.failure(f"Pipeline: {pipeline.name}")

    def write_policies(self, ometa_policy: OMetaPolicy) -> None:
        try:
            created_location = None
            if ometa_policy.location is not None:
                created_location = self._create_location(ometa_policy.location)
                logger.info(f"Successfully ingested Location {created_location.name}")
                self.status.records_written(f"Location: {created_location.name}")

            policy_request = CreatePolicyRequest(
                name=ometa_policy.policy.name,
                displayName=ometa_policy.policy.displayName,
                description=ometa_policy.policy.description,
                owner=ometa_policy.policy.owner,
                policyUrl=ometa_policy.policy.policyUrl,
                policyType=ometa_policy.policy.policyType,
                rules=ometa_policy.policy.rules,
                location=created_location.id if created_location else None,
            )
            created_policy = self.metadata.create_or_update(policy_request)
            logger.info(f"Successfully ingested Policy {created_policy.name}")
            self.status.records_written(f"Policy: {created_policy.name}")

        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest Policy {ometa_policy.policy.name}")
            logger.error(err)
            logger.debug(traceback.print_exc())
            self.status.failure(f"Policy: {ometa_policy.policy.name}")

    def _create_location(self, location: Location) -> Location:
        location_request = CreateLocationRequest(
            name=location.name,
            description=location.description,
            locationType=location.locationType,
            tags=location.tags,
            owner=location.owner,
            service=location.service,
        )
        return self.metadata.create_or_update(location_request)

    def write_lineage(self, add_lineage: AddLineageRequest):
        try:
            logger.info(add_lineage)
            created_lineage = self.metadata.add_lineage(add_lineage)
            logger.info(f"Successfully added Lineage {created_lineage}")
            self.status.records_written(f"Lineage: {created_lineage}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest lineage {add_lineage}")
            logger.error(err)
            self.status.failure(f"Lineage: {add_lineage}")

    def write_ml_model(self, model: CreateMlModelRequest):
        try:
            created_model = self.metadata.create_or_update(model)
            logger.info(f"Successfully added Model {created_model.name}")
            self.status.records_written(f"Model: {created_model.name}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest Model {model.name}")
            logger.error(err)
            self.status.failure(f"Model: {model.name}")

    def _create_role(self, create_role: CreateRoleRequest) -> Role:
        try:
            role = self.metadata.create_or_update(create_role)
            self.role_entities[role.name] = str(role.id.__root__)
            return role
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.debug(traceback.print_exc())
            logger.error(err)

    def _create_team(self, create_team: CreateTeamRequest) -> Team:
        try:
            team = self.metadata.create_or_update(create_team)
            self.team_entities[team.name.__root__] = str(team.id.__root__)
            return team
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.debug(traceback.print_exc())
            logger.error(err)

    def write_users(self, record: OMetaUserProfile):
        """
        Given a User profile (User + Teams + Roles create requests):
        1. Check if role & team exist, otherwise create
        2. Add ids of role & team to the User
        3. Create or update User
        """

        # Create roles if they don't exist
        if record.roles:  # Roles can be optional
            role_ids = []
            for role in record.roles:
                try:
                    role_entity = self.metadata.get_by_name(
                        entity=Role, fqdn=str(role.name.__root__)
                    )
                except APIError:
                    role_entity = self._create_role(role)
                role_ids.append(role_entity.id)
        else:
            role_ids = None

        # Create teams if they don't exist
        if record.teams:  # Teams can be optional
            team_ids = []
            for team in record.teams:
                try:
                    team_entity = self.metadata.get_by_name(
                        entity=Team, fqdn=str(team.name.__root__)
                    )
                    if not team_entity:
                        raise APIError(
                            error={
                                "message": "Creating a new team {}".format(
                                    team.name.__root__
                                )
                            }
                        )
                    team_ids.append(team_entity.id)
                except APIError:
                    team_entity = self._create_team(team)
                    team_ids.append(team_entity.id)
                except Exception as err:
                    logger.error(err)
        else:
            team_ids = None

        # Update user data with the new Role and Team IDs
        user_profile = record.user.dict(exclude_unset=True)
        user_profile["roles"] = role_ids
        user_profile["teams"] = team_ids
        metadata_user = CreateUserRequest(**user_profile)

        # Create user
        try:
            user = self.metadata.create_or_update(metadata_user)
            self.status.records_written(user.displayName)
            logger.info("User: {}".format(user.displayName))
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.debug(traceback.print_exc())
            logger.error(err)

    def delete_table(self, record: DeleteTable):
        try:
            self.metadata.delete(entity=Table, entity_id=record.table.id)
            logger.info(
                f"{record.table.name} doesn't exist in source state, marking it as deleted"
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.debug(traceback.print_exc())
            logger.error(err)

    def get_status(self):
        return self.status

    def close(self):
        pass
