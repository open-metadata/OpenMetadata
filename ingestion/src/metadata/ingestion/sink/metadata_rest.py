#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import logging
from typing import List

from pydantic import ValidationError

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createChart import CreateChartEntityRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardEntityRequest
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseEntityRequest
from metadata.generated.schema.api.data.createPipeline import CreatePipelineEntityRequest
from metadata.generated.schema.api.data.createTable import CreateTableEntityRequest
from metadata.generated.schema.api.data.createTask import CreateTaskEntityRequest
from metadata.generated.schema.api.data.createTopic import CreateTopic
from metadata.generated.schema.api.lineage.addLineage import AddLineage
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.task import Task
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import WorkflowContext, Record
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.openmetadata_rest import OpenMetadataAPIClient, MetadataServerConfig, TableProfiles

logger = logging.getLogger(__name__)

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
    "box_plot": ChartType.Bar
}


class MetadataRestSinkConfig(ConfigModel):
    api_endpoint: str = None


class MetadataRestSink(Sink):
    config: MetadataRestSinkConfig
    status: SinkStatus

    def __init__(self, ctx: WorkflowContext, config: MetadataRestSinkConfig, metadata_config: MetadataServerConfig):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = SinkStatus()
        self.wrote_something = False
        self.charts_dict = {}
        self.client = OpenMetadataAPIClient(self.metadata_config)

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = MetadataRestSinkConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def write_record(self, record: Record) -> None:
        if isinstance(record, OMetaDatabaseAndTable):
            self.write_tables(record)
        elif isinstance(record, CreateTopic):
            self.write_topics(record)
        elif isinstance(record, Chart):
            self.write_charts(record)
        elif isinstance(record, Dashboard):
            self.write_dashboards(record)
        elif isinstance(record, Task):
            self.write_tasks(record)
        elif isinstance(record, Pipeline):
            self.write_pipelines(record)
        elif isinstance(record, AddLineage):
            self.write_lineage(record)
        else:
            logging.info("Ignoring the record due to unknown Record type {}".format(type(record)))

    def write_tables(self, table_and_db: OMetaDatabaseAndTable):
        try:
            db_request = CreateDatabaseEntityRequest(name=table_and_db.database.name,
                                                     description=table_and_db.database.description,
                                                     service=EntityReference(id=table_and_db.database.service.id,
                                                                             type="databaseService"))
            db = self.client.create_database(db_request)
            table_request = CreateTableEntityRequest(name=table_and_db.table.name,
                                                     tableType=table_and_db.table.tableType,
                                                     columns=table_and_db.table.columns,
                                                     description=table_and_db.table.description,
                                                     database=db.id)

            if table_and_db.table.viewDefinition is not None and table_and_db.table.viewDefinition != "":
                table_request.viewDefinition = table_and_db.table.viewDefinition.__root__

            created_table = self.client.create_or_update_table(table_request)
            if table_and_db.table.sampleData is not None:
                self.client.ingest_sample_data(table_id=created_table.id, sample_data=table_and_db.table.sampleData)
            if table_and_db.table.tableProfile is not None:
                self.client.ingest_table_profile_data(table_id=created_table.id,
                                                      table_profile=table_and_db.table.tableProfile)

            logger.info(
                'Successfully ingested table {}.{}'.
                    format(table_and_db.database.name.__root__, created_table.name.__root__))
            self.status.records_written(
                '{}.{}'.format(table_and_db.database.name.__root__, created_table.name.__root__))
        except (APIError, ValidationError) as err:
            logger.error(
                "Failed to ingest table {} in database {} ".format(table_and_db.table.name.__root__,
                                                                   table_and_db.database.name.__root__))
            logger.error(err)
            self.status.failure(table_and_db.table.name.__root__)

    def write_topics(self, topic: CreateTopic) -> None:
        try:
            created_topic = self.client.create_or_update_topic(topic)
            logger.info(
                'Successfully ingested topic {}'.format(created_topic.name.__root__))
            self.status.records_written(created_topic.name.__root__)
        except (APIError, ValidationError) as err:
            logger.error(
                "Failed to ingest topic {} ".format(topic.name.__root__))
            logger.error(err)
            self.status.failure(topic.name)

    def write_charts(self, chart: Chart):
        try:
            om_chart_type = ChartType.Other
            if chart.chart_type is not None and chart.chart_type in om_chart_type_dict.keys():
                om_chart_type = om_chart_type_dict[chart.chart_type]

            chart_request = CreateChartEntityRequest(
                name=chart.name,
                displayName=chart.displayName,
                description=chart.description,
                chartType=om_chart_type,
                chartUrl=chart.url,
                service=chart.service
            )
            created_chart = self.client.create_or_update_chart(chart_request)
            self.charts_dict[chart.name] = EntityReference(id=created_chart.id, type='chart')
            logger.info(
                'Successfully ingested chart {}'.format(created_chart.displayName))
            self.status.records_written(
                '{}'.format(created_chart.displayName))
        except (APIError, ValidationError) as err:
            logger.error(
                "Failed to ingest chart {}".format(chart.displayName))
            logger.error(err)
            self.status.failure(chart.displayName)

    def write_dashboards(self, dashboard: Dashboard):
        try:
            charts = self._get_chart_references(dashboard)

            dashboard_request = CreateDashboardEntityRequest(
                name=dashboard.name,
                displayName=dashboard.displayName,
                description=dashboard.description,
                dashboardUrl=dashboard.url,
                charts=charts,
                service=dashboard.service
            )
            created_dashboard = self.client.create_or_update_dashboard(dashboard_request)
            logger.info('Successfully ingested dashboard {}'.format(created_dashboard.displayName))
            self.status.records_written('{}'.format(created_dashboard.displayName))
        except (APIError, ValidationError) as err:
            logger.error("Failed to ingest dashboard {}".format(dashboard.name))
            logger.error(err)
            self.status.failure(dashboard.name)

    def _get_chart_references(self, dashboard: Dashboard) -> []:
        chart_references = []
        for chart_id in dashboard.charts:
            if chart_id in self.charts_dict.keys():
                chart_references.append(self.charts_dict[chart_id])
        return chart_references

    def write_tasks(self, task: Task):
        try:
            task_request = CreateTaskEntityRequest(
                name=task.name,
                displayName=task.displayName,
                description=task.description,
                taskUrl=task.taskUrl,
                downstreamTasks=task.downstreamTasks,
                service=task.service
            )
            created_task = self.client.create_or_update_task(task_request)
            logger.info('Successfully ingested Task {}'.format(created_task.displayName))
            self.status.records_written('{}'.format(created_task.displayName))
        except (APIError, ValidationError) as err:
            logger.error("Failed to ingest task {}".format(task.name))
            logger.error(err)
            self.status.failure(task.name)

    def write_pipelines(self, pipeline: Pipeline):
        try:
            pipeline_request = CreatePipelineEntityRequest(
                name=pipeline.name,
                displayName=pipeline.displayName,
                description=pipeline.description,
                pipelineUrl=pipeline.pipelineUrl,
                tasks=pipeline.tasks,
                service=pipeline.service
            )
            created_pipeline = self.client.create_or_update_pipeline(pipeline_request)
            logger.info('Successfully ingested Task {}'.format(created_pipeline.displayName))
            self.status.records_written('{}'.format(created_pipeline.displayName))
        except (APIError, ValidationError) as err:
            logger.error("Failed to ingest task {}".format(pipeline.name))
            logger.error(err)
            self.status.failure(pipeline.name)

    def write_lineage(self, add_lineage: AddLineage):
        try:
            logger.info(add_lineage)
            created_lineage = self.client.create_or_update_lineage(add_lineage)
            logger.info('Successfully added Lineage {}'.format(created_lineage))
            self.status.records_written('{}'.format(created_lineage))
        except (APIError, ValidationError) as err:
            logger.error("Failed to ingest task {}".format(add_lineage))
            logger.error(err)
            self.status.failure(add_lineage)

    def get_status(self):
        return self.status

    def close(self):
        pass
