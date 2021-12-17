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
from typing import Generic, TypeVar

from pydantic import BaseModel, ValidationError

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createChart import CreateChartEntityRequest
from metadata.generated.schema.api.data.createDashboard import (
    CreateDashboardEntityRequest,
)
from metadata.generated.schema.api.data.createDatabase import (
    CreateDatabaseEntityRequest,
)
from metadata.generated.schema.api.data.createLocation import (
    CreateLocationEntityRequest,
)
from metadata.generated.schema.api.data.createMlModel import CreateMlModelEntityRequest
from metadata.generated.schema.api.data.createPipeline import (
    CreatePipelineEntityRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableEntityRequest
from metadata.generated.schema.api.data.createTopic import CreateTopicEntityRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineage
from metadata.generated.schema.api.policies.createPolicy import (
    CreatePolicyEntityRequest,
)
from metadata.generated.schema.api.teams.createTeam import CreateTeamEntityRequest
from metadata.generated.schema.api.teams.createUser import CreateUserEntityRequest
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.location import Location
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.policies.policy import Policy
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity, WorkflowContext
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.table_metadata import Chart, Dashboard
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
        self.api_client = self.metadata.client
        self.team_entities = {}
        self._bootstrap_entities()

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
        elif isinstance(record, CreateTopicEntityRequest):
            self.write_topics(record)
        elif isinstance(record, Chart):
            self.write_charts(record)
        elif isinstance(record, Dashboard):
            self.write_dashboards(record)
        elif isinstance(record, Location):
            self.write_locations(record)
        elif isinstance(record, Policy):
            self.write_policies(record)
        elif isinstance(record, Pipeline):
            self.write_pipelines(record)
        elif isinstance(record, AddLineage):
            self.write_lineage(record)
        elif isinstance(record, User):
            self.write_users(record)
        elif isinstance(record, CreateMlModelEntityRequest):
            self.write_ml_model(record)
        else:
            logging.info(
                f"Ignoring the record due to unknown Record type {type(record)}"
            )

    def write_tables(self, db_and_table: OMetaDatabaseAndTable):
        try:
            db_request = CreateDatabaseEntityRequest(
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

            table_request = CreateTableEntityRequest(
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
                location_request = CreateLocationEntityRequest(
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

    def write_topics(self, topic: CreateTopicEntityRequest) -> None:
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

            chart_request = CreateChartEntityRequest(
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

            dashboard_request = CreateDashboardEntityRequest(
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
            location_request = CreateLocationEntityRequest(
                name=location.name,
                description=location.description,
                locationType=location.locationType,
                owner=location.owner,
                service=location.service,
            )
            created_location = self.metadata.create_or_update(location_request)
            logger.info(f"Successfully ingested Location {created_location.name}")
            self.status.records_written(f"Location: {created_location.name}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest Location {location.name}")
            logger.error(err)
            self.status.failure(f"Location: {location.name}")

    def write_pipelines(self, pipeline: Pipeline):
        try:
            pipeline_request = CreatePipelineEntityRequest(
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

    def write_policies(self, policy: Policy):
        try:
            policy_request = CreatePolicyEntityRequest(
                name=policy.name,
                displayName=policy.displayName,
                description=policy.description,
                owner=policy.owner,
                policyUrl=policy.policyUrl,
                policyType=policy.policyType,
                rules=policy.rules,
            )
            created_policy = self.metadata.create_or_update(policy_request)
            logger.info(f"Successfully ingested Policy {created_policy.name}")
            self.status.records_written(f"Policy: {created_policy.name}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest Policy {policy.name}")
            logger.error(err)
            self.status.failure(f"Policy: {policy.name}")

    def write_lineage(self, add_lineage: AddLineage):
        try:
            logger.info(add_lineage)
            created_lineage = self.metadata.add_lineage(add_lineage)
            logger.info(f"Successfully added Lineage {created_lineage}")
            self.status.records_written(f"Lineage: {created_lineage}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest lineage {add_lineage}")
            logger.error(err)
            self.status.failure(f"Lineage: {add_lineage}")

    def write_ml_model(self, model: CreateMlModelEntityRequest):
        try:
            created_model = self.metadata.create_or_update(model)
            logger.info(f"Successfully added Model {created_model.name}")
            self.status.records_written(f"Model: {created_model.name}")
        except (APIError, ValidationError) as err:
            logger.error(f"Failed to ingest Model {model.name}")
            logger.error(err)
            self.status.failure(f"Model: {model.name}")

    def _bootstrap_entities(self):
        team_response = self.api_client.get("/teams")
        for team in team_response["data"]:
            self.team_entities[team["name"]] = team["id"]

    def _create_team(self, team: EntityReference) -> None:
        metadata_team = CreateTeamEntityRequest(
            name=team.name, displayName=team.name, description=team.description
        )
        try:
            r = self.metadata.create_or_update(metadata_team)
            instance_id = str(r.id.__root__)
            self.team_entities[team.name] = instance_id
        except Exception as err:
            logger.error(traceback.format_exc())
            logger.error(traceback.print_exc())
            logger.error(err)

    def write_users(self, record: User):
        teams = []
        for team in record.teams.__root__:
            if team.name not in self.team_entities:
                self._create_team(team)
            teams.append(self.team_entities[team.name])

        metadata_user = CreateUserEntityRequest(
            name=record.name.__root__,
            displayName=record.displayName,
            email=record.email,
            teams=teams,
        )
        try:
            self.metadata.create_or_update(metadata_user)
            self.status.records_written(record.displayName)
            logger.info("Sink: {}".format(record.displayName))
        except Exception as err:
            logger.error(traceback.format_exc())
            logger.error(traceback.print_exc())
            logger.error(err)

    def get_status(self):
        return self.status

    def close(self):
        pass
