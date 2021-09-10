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


import json
import logging
from dataclasses import dataclass, field
from typing import Iterable, List

from pydantic import ValidationError

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.services.createDashboardService import CreateDashboardServiceEntityRequest
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Record
from metadata.ingestion.api.source import SourceStatus, Source
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.ometa.openmetadata_rest import OpenMetadataAPIClient, MetadataServerConfig


logger = logging.getLogger(__name__)

def get_service_or_create(service_json, metadata_config) -> DashboardService:
    client = OpenMetadataAPIClient(metadata_config)
    service = client.get_dashboard_service(service_json['name'])
    if service is not None:
        return service
    else:
        created_service = client.create_dashboard_service(CreateDashboardServiceEntityRequest(**service_json))
        return created_service


class SampleDashboardSourceConfig(ConfigModel):
    sample_dashboard_folder: str
    service_name: str
    service_type: str = "Superset"

    def get_sample_dashboard_folder(self):
        return self.sample_dashboard_folder


@dataclass
class SampleDashboardSourceStatus(SourceStatus):
    dashboards_scanned: List[str] = field(default_factory=list)

    def report_dashboard_scanned(self, dashboard_name: str) -> None:
        self.dashboards_scanned.append(dashboard_name)


class SampleDashboardsSource(Source):

    def __init__(self, config: SampleDashboardSourceConfig, metadata_config: MetadataServerConfig, ctx):
        super().__init__(ctx)
        self.status = SampleDashboardSourceStatus()
        self.config = config
        self.metadata_config = metadata_config
        self.client = OpenMetadataAPIClient(metadata_config)
        self.service_json = json.load(open(config.sample_dashboard_folder + "/service.json", 'r'))
        self.charts = json.load(open(config.sample_dashboard_folder + "/charts.json", 'r'))
        self.dashboards = json.load(open(config.sample_dashboard_folder + "/dashboards.json", 'r'))
        self.service = get_service_or_create(self.service_json, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = SampleDashboardSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Record]:
        for chart in self.charts['charts']:
            try:
                chart_ev = Chart(name=chart['name'],
                                displayName=chart['displayName'],
                                description=chart['description'],
                                chart_type=chart['chartType'],
                                url=chart['chartUrl'],
                                service=EntityReference(id=self.service.id, type="dashboardService"))
                yield chart_ev
            except ValidationError as err:
                logger.error(err)


        for dashboard in self.dashboards['dashboards']:
            dashboard_ev = Dashboard(name=dashboard['name'],
                                     displayName=dashboard['displayName'],
                                     description=dashboard['description'],
                                     url=dashboard['dashboardUrl'],
                                     charts=dashboard['charts'],
                                     service=EntityReference(id=self.service.id, type="dashboardService"))
            yield dashboard_ev

    def close(self):
        self.client.close()

    def get_status(self):
        return self.status
