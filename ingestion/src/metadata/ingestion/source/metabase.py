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

import json
import logging
import traceback
import uuid
from typing import Iterable
from urllib.parse import quote

import requests
from pydantic import SecretStr

from metadata.generated.schema.api.lineage.addLineage import AddLineage
from metadata.generated.schema.entity.data.dashboard import Dashboard as Model_Dashboard
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import (
    ConfigModel,
    Entity,
    IncludeFilterPattern,
    WorkflowContext,
)
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_alchemy_helper import SQLSourceStatus
from metadata.ingestion.source.sql_source import SQLSourceStatus
from metadata.utils.helpers import get_dashboard_service_or_create

HEADERS = {"Content-Type": "application/json", "Accept": "*/*"}


logger: logging.Logger = logging.getLogger(__name__)


class MetabaseSourceConfig(ConfigModel):
    username: str
    password: SecretStr
    host_port: str
    dashboard_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    chart_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    service_name: str
    service_type: str = "Metabase"
    database_service_name: str = None

    def get_connection_url(self):
        pass


class MetabaseSource(Source[Entity]):
    config: MetabaseSourceConfig
    metadata_config: MetadataServerConfig
    status: SQLSourceStatus

    def __init__(
        self,
        config: MetabaseSourceConfig,
        metadata_config: MetadataServerConfig,
        ctx: WorkflowContext,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = SQLSourceStatus()
        params = {}
        params["username"] = self.config.username
        params["password"] = self.config.password.get_secret_value()
        try:
            resp = requests.post(
                self.config.host_port + "/api/session/",
                data=json.dumps(params),
                headers=HEADERS,
            )
        except Exception as err:
            raise ConnectionError(f"{err}")
        session_id = resp.json()["id"]
        self.metabase_session = {"X-Metabase-Session": session_id}
        self.dashboard_service = get_dashboard_service_or_create(
            config.service_name,
            DashboardServiceType.Metabase.name,
            config.username,
            config.password.get_secret_value(),
            config.host_port,
            metadata_config,
        )
        self.charts = []
        self.metric_charts = []

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = MetabaseSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def next_record(self) -> Iterable[Entity]:
        yield from self.get_dashboards()

    def get_charts(self, charts) -> Iterable[Chart]:
        for chart in charts:
            try:
                chart_details = chart["card"]
                if not self.config.chart_pattern.included(chart_details["name"]):
                    self.status.filter(chart_details["name"])
                    continue
                yield Chart(
                    id=uuid.uuid4(),
                    name=chart_details["name"],
                    displayName=chart_details["name"],
                    description=chart_details["description"]
                    if chart_details["description"] is not None
                    else "",
                    chart_type=str(chart_details["display"]),
                    url=self.config.host_port,
                    service=EntityReference(
                        id=self.dashboard_service.id, type="dashboardService"
                    ),
                )
                self.charts.append(chart_details["name"])
                self.status.scanned(chart_details["name"])
            except Exception as err:
                logger.error(repr(err))
                traceback.print_exc()
                continue

    def get_dashboards(self):
        resp_dashboards = self.req_get("/api/dashboard")
        if resp_dashboards.status_code == 200:
            for dashboard in resp_dashboards.json():
                resp_dashboard = self.req_get(f"/api/dashboard/{dashboard['id']}")
                dashboard_details = resp_dashboard.json()
                self.charts = []
                if not self.config.dashboard_pattern.included(
                    dashboard_details["name"]
                ):
                    self.status.filter(dashboard_details["name"])
                    continue
                yield from self.get_charts(dashboard_details["ordered_cards"])
                yield Dashboard(
                    id=uuid.uuid4(),
                    name=dashboard_details["name"],
                    url=self.config.host_port,
                    displayName=dashboard_details["name"],
                    description=dashboard_details["description"]
                    if dashboard_details["description"] is not None
                    else "",
                    charts=self.charts,
                    service=EntityReference(
                        id=self.dashboard_service.id, type="dashboardService"
                    ),
                )
                yield from self.get_lineage(
                    dashboard_details["ordered_cards"], dashboard_details["name"]
                )

    def get_lineage(self, chart_list, dashboard_name):
        metadata = OpenMetadata(self.metadata_config)
        for chart in chart_list:
            try:
                chart_details = chart["card"]
                resp_tables = self.req_get(f"/api/table/{chart_details['table_id']}")
                if resp_tables.status_code == 200:
                    table = resp_tables.json()
                    table_fqdn = f"{self.config.database_service_name}.{table['schema']}.{table['name']}"
                    dashboard_fqdn = (
                        f"{self.dashboard_service.name}.{quote(dashboard_name)}"
                    )
                    table_entity = metadata.get_by_name(entity=Table, fqdn=table_fqdn)
                    chart_entity = metadata.get_by_name(
                        entity=Model_Dashboard, fqdn=dashboard_fqdn
                    )
                    logger.debug("from entity {}".format(table_entity))
                    lineage = AddLineage(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=table_entity.id.__root__, type="table"
                            ),
                            toEntity=EntityReference(
                                id=chart_entity.id.__root__, type="dashboard"
                            ),
                        )
                    )
                    yield lineage
            except Exception as err:
                logger.error(traceback.print_exc())

    def req_get(self, path):
        return requests.get(self.config.host_port + path, headers=self.metabase_session)

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass

    def prepare(self):
        pass
