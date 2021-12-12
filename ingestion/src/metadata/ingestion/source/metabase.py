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

import requests

from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity, WorkflowContext
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_alchemy_helper import SQLSourceStatus
from metadata.ingestion.source.sql_source import SQLConnectionConfig, SQLSourceStatus
from metadata.utils.column_helpers import check_column_complex_type, get_column_type
from metadata.utils.helpers import (
    get_dashboard_service_or_create,
    get_database_service_or_create,
)

HEADERS = {"Content-Type": "application/json", "Accept": "*/*"}


logger: logging.Logger = logging.getLogger(__name__)


class MetabaseConnectionConfig(SQLConnectionConfig):
    service_type = "MySQL"
    session_id: str = None
    scheme = ""

    def get_connection_url(self):
        pass

    def get_session_id(self):
        try:
            resp_session_id = requests.post(
                self.host_port + "/api/session/",
                data=json.dumps(params),
                headers=HEADERS,
            )
            if resp_session_id.status_code == 200:
                self.session_id = resp_session_id.json()["id"]
        except Exception as err:
            logger.error(repr(err))


class MetabaseSource(Source[Entity]):
    config: MetabaseConnectionConfig
    metadata_config: MetadataServerConfig
    status: SQLSourceStatus

    def __init__(
        self,
        config: MetabaseConnectionConfig,
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
        resp = requests.post(
            self.config.host_port + "/api/session/",
            data=json.dumps(params),
            headers=HEADERS,
        )
        session_id = resp.json()["id"]
        self.metabase_session = {"X-Metabase-Session": session_id}
        self.dashboard_service = get_dashboard_service_or_create(
            config.service_name,
            DashboardServiceType.Looker.name,
            config.username,
            config.password.get_secret_value(),
            config.host_port,
            metadata_config,
        )
        self.database_service = get_database_service_or_create(
            config, metadata_config, self.config.service_name
        )
        self.charts = []

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = MetabaseConnectionConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def next_record(self) -> Iterable[Entity]:
        yield from self.get_dashboards()
        yield from self.get_tables()
        # yield from self.get_lineage()

    def get_charts(self, charts) -> Iterable[Chart]:
        for chart in charts:
            try:
                chart_details = chart["card"]
                self.charts.append(chart_details["name"])
                yield Chart(
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
                self.status.scanned(chart_details["name"])
            except Exception as err:
                logger.error(repr(err))
                traceback.format_exc()

    def get_dashboards(self):
        resp_dashboards = self.req_get("/api/dashboard")
        if resp_dashboards.status_code == 200:
            for dashboard in resp_dashboards.json():
                try:
                    resp_dashboard = self.req_get(f"/api/dashboard/{dashboard['id']}")
                    dashboard_details = resp_dashboard.json()
                    self.charts = []
                    yield from self.get_charts(dashboard_details["ordered_cards"])
                    logger.info(self.charts)
                    dashboard_ev = Dashboard(
                        name=dashboard_details["name"],
                        displayName=dashboard_details["name"],
                        description=dashboard_details["description"]
                        if dashboard_details["description"] is not None
                        else "",
                        url=self.config.host_port,
                        charts=self.charts,
                        service=EntityReference(
                            id=self.dashboard_service.id, type="dashboardService"
                        ),
                    )
                    self.status.scanned(dashboard_ev.name)
                    yield dashboard_ev
                except Exception as err:
                    logger.error(repr(err))
                    logger.error(traceback.format_exc())

    def get_columns(self, column_arr, dataset_name):
        for column in column_arr:
            try:
                (
                    col_type,
                    data_type_display,
                    arr_data_type,
                    children,
                ) = check_column_complex_type(
                    self.status,
                    dataset_name,
                    column["database_type"].lower(),
                    column["name"],
                )
                col = Column(
                    name=column["name"].replace(".", "_DOT_")[:128],
                    description="",
                    dataType=col_type,
                    children=children,
                    dataTypeDisplay="{}({})".format(col_type, 1)
                    if data_type_display is None
                    else data_type_display,
                    dataLength=1,
                )
                col.arrayDataType = arr_data_type
                yield col
            except Exception as err:
                logger.error(column["database_type"])
                logger.error(repr(err))
                logger.error(traceback.format_exc())
                continue

    def get_tables(self):
        resp_database = self.req_get("/api/database?include=tables")
        if resp_database.status_code == 200:
            for iter_database in resp_database.json()["data"]:
                resp_tables = self.req_get(
                    f"/api/database/{iter_database['id']}?include=tables.fields"
                )
                if resp_tables.status_code == 200:
                    for table in resp_tables.json()["tables"]:
                        try:
                            db = Database(
                                id=uuid.uuid4(),
                                name=table["schema"],
                                description=iter_database["description"]
                                if iter_database["description"] is not None
                                else "",
                                service=EntityReference(
                                    id=self.database_service.id,
                                    type="databaseService",
                                ),
                            )
                            columns = self.get_columns(table["fields"], table["name"])
                            table_entity = Table(
                                id=uuid.uuid4(),
                                name=table["name"],
                                tableType="Regular",
                                description=table["description"]
                                if table["description"] is not None
                                else "",
                                columns=columns,
                            )
                            table_and_db = OMetaDatabaseAndTable(
                                table=table_entity,
                                database=db,
                            )
                            yield table_and_db
                        except Exception as err:
                            logger.error(repr(err))
                            logger.error(traceback.format_exc())
                            continue

    def req_get(self, path):
        return requests.get(self.config.host_port + path, headers=self.metabase_session)

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass

    def prepare(self):
        pass
