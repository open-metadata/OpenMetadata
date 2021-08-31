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
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import WorkflowContext, Record
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.openmetadata_rest import OpenMetadataAPIClient, MetadataServerConfig
from metadata.ingestion.source import metadata

logger = logging.getLogger(__name__)


class MetadataDashboardsSinkConfig(ConfigModel):
    api_endpoint: str = None


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

class MetadataRestDashboardsSink(Sink):
    config: MetadataDashboardsSinkConfig
    status: SinkStatus

    def __init__(self, ctx: WorkflowContext, config: MetadataDashboardsSinkConfig,
                 metadata_config: MetadataServerConfig):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = SinkStatus()
        self.wrote_something = False
        self.client = OpenMetadataAPIClient(self.metadata_config)
        self.charts_dict = {}

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = MetadataDashboardsSinkConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def write_record(self, record: Record) -> None:
        if isinstance(record, Chart):
            self._ingest_charts(record)
        elif isinstance(record, Dashboard):
            self._ingest_dashboards(record)
        else:
            logging.info("Ignoring the record due to unknown Record type {}".format(type(record)))

    def _ingest_charts(self, chart: Chart):
        try:
            om_chart_type = ChartType.Other
            if chart.chart_type is not None and chart.chart_type in om_chart_type_dict.keys():
                om_chart_type = om_chart_type_dict[chart.chart_type]

            chart_request = CreateChartEntityRequest(
                name=chart.name,
                description=chart.description,
                chartId=chart.chart_id,
                chartType=om_chart_type,
                chartUrl=chart.url,
                service=chart.service
            )
            created_chart = self.client.create_or_update_chart(chart_request)
            self.charts_dict[chart.chart_id] = EntityReference(id=created_chart.id, type='chart')
            logger.info(
                'Successfully ingested {}'.format(created_chart.name))
            self.status.records_written(
                '{}'.format(created_chart.name))
        except (APIError, ValidationError) as err:
            logger.error(
                "Failed to ingest chart {}".format(chart.name))
            logger.error(err)
            self.status.failure(chart.name)

    def _ingest_dashboards(self, dashboard: Dashboard):
        try:
            charts = self._get_chart_references(dashboard)

            dashboard_request = CreateDashboardEntityRequest(
                name=dashboard.name,
                description=dashboard.description,
                dashboardUrl=dashboard.url,
                charts=charts,
                service=dashboard.service
            )
            created_dashboard = self.client.create_or_update_dashboard(dashboard_request)
            logger.info('Successfully ingested {}'.format(created_dashboard.name))
            self.status.records_written('{}'.format(created_dashboard.name))
        except (APIError, ValidationError) as err:
            logger.error("Failed to ingest chart {}".format(dashboard.name))
            logger.error(err)
            self.status.failure(dashboard.name)

    def _get_chart_references(self, dashboard: Dashboard) -> []:
        chart_references = []
        for chart_id in dashboard.charts:
            if chart_id in self.charts_dict.keys():
                chart_references.append(self.charts_dict[chart_id])
        return chart_references

    def get_status(self):
        return self.status

    def close(self):
        pass
