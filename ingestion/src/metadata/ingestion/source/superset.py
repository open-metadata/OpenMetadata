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
from typing import Iterable

import dateutil.parser as dateparser

from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity, WorkflowContext
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.table_metadata import Chart, Dashboard, DashboardOwner
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.ometa.superset_rest import SupersetAPIClient, SupersetConfig
from metadata.utils.helpers import get_dashboard_service_or_create


def get_metric_name(metric):
    if not metric:
        return ""
    if isinstance(metric, str):
        return metric
    label = metric.get("label")
    if label:
        return label


def get_filter_name(filter_obj):
    sql_expression = filter_obj.get("sqlExpression")
    if sql_expression:
        return sql_expression

    clause = filter_obj.get("clause")
    column = filter_obj.get("subject")
    operator = filter_obj.get("operator")
    comparator = filter_obj.get("comparator")
    return f"{clause} {column} {operator} {comparator}"


def get_owners(owners_obj):
    owners = []
    for owner in owners_obj:
        dashboard_owner = DashboardOwner(
            first_name=owner["first_name"],
            last_name=owner["last_name"],
            username=owner["username"],
        )
        owners.append(dashboard_owner)
    return owners


def get_service_type_from_database_uri(uri: str) -> str:
    if uri.startswith("bigquery"):
        return "bigquery"
    if uri.startswith("druid"):
        return "druid"
    if uri.startswith("mssql"):
        return "mssql"
    if uri.startswith("jdbc:postgres:") and uri.index("redshift.amazonaws") > 0:
        return "redshift"
    if uri.startswith("snowflake"):
        return "snowflake"
    if uri.startswith("presto"):
        return "presto"
    if uri.startswith("trino"):
        return "trino"
    if uri.startswith("postgresql"):
        return "postgres"
    if uri.startswith("pinot"):
        return "pinot"
    if uri.startswith("oracle"):
        return "oracle"
    if uri.startswith("mysql"):
        return "mysql"
    if uri.startswith("mongodb"):
        return "mongodb"
    if uri.startswith("hive"):
        return "hive"
    return "external"


class SupersetSource(Source[Entity]):
    config: SupersetConfig
    metadata_config: MetadataServerConfig
    status: SourceStatus
    platform = "superset"
    service_type = "Superset"

    def __init__(
        self,
        config: SupersetConfig,
        metadata_config: MetadataServerConfig,
        ctx: WorkflowContext,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = SourceStatus()
        self.client = SupersetAPIClient(self.config)
        self.service = get_dashboard_service_or_create(
            config.service_name,
            DashboardServiceType.Superset.name,
            config.username,
            config.password.get_secret_value(),
            config.url,
            metadata_config,
        )

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        config = SupersetConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Entity]:
        yield from self._fetch_charts()
        yield from self._fetch_dashboards()

    def _build_dashboard(self, dashboard_json) -> Dashboard:
        dashboard_id = dashboard_json["id"]
        name = dashboard_json["dashboard_title"]
        dashboard_url = f"{self.config.url[:-1]}{dashboard_json['url']}"
        last_modified = (
            dateparser.parse(dashboard_json.get("changed_on_utc", "now")).timestamp()
            * 1000
        )
        owners = get_owners(dashboard_json["owners"])
        raw_position_data = dashboard_json.get("position_json", "{}")
        charts = []
        if raw_position_data is not None:
            position_data = json.loads(raw_position_data)
            for key, value in position_data.items():
                if not key.startswith("CHART-"):
                    continue
                chart_id = value.get("meta", {}).get("chartId", "unknown")
                charts.append(chart_id)

        return Dashboard(
            name=dashboard_id,
            displayName=name,
            description="",
            url=dashboard_url,
            owners=owners,
            charts=charts,
            service=EntityReference(id=self.service.id, type="dashboardService"),
            lastModified=last_modified,
        )

    def _fetch_dashboards(self) -> Iterable[Entity]:
        current_page = 0
        page_size = 25
        total_dashboards = self.client.fetch_total_dashboards()
        while current_page * page_size <= total_dashboards:
            dashboards = self.client.fetch_dashboards(current_page, page_size)
            current_page += 1
            for dashboard_json in dashboards["result"]:
                dashboard = self._build_dashboard(dashboard_json)
                yield dashboard

    def _get_service_type_from_database_id(self, database_id):
        database_json = self.client.fetch_database(database_id)
        sqlalchemy_uri = database_json.get("result", {}).get("sqlalchemy_uri")
        return get_service_type_from_database_uri(sqlalchemy_uri)

    def _get_datasource_from_id(self, datasource_id):
        datasource_json = self.client.fetch_datasource(datasource_id)
        schema_name = datasource_json.get("result", {}).get("schema")
        table_name = datasource_json.get("result", {}).get("table_name")
        database_id = datasource_json.get("result", {}).get("database", {}).get("id")
        database_name = (
            datasource_json.get("result", {}).get("database", {}).get("database_name")
        )

        if database_id and table_name:
            platform = self._get_service_type_from_database_id(database_id)
            dataset_fqn = (
                f"{platform}.{database_name + '.' if database_name else ''}"
                f"{schema_name + '.' if schema_name else ''}"
                f"{table_name}"
            )
            return dataset_fqn
        return None

    def _build_chart(self, chart_json) -> Chart:
        chart_id = chart_json["id"]
        name = chart_json["slice_name"]
        last_modified = (
            dateparser.parse(chart_json.get("changed_on_utc", "now")).timestamp() * 1000
        )
        chart_type = chart_json["viz_type"]
        chart_url = f"{self.config.url}{chart_json['url']}"
        datasource_id = chart_json["datasource_id"]
        datasource_fqn = self._get_datasource_from_id(datasource_id)
        owners = get_owners(chart_json["owners"])
        params = json.loads(chart_json["params"])
        metrics = [
            get_metric_name(metric)
            for metric in (params.get("metrics", []) or [params.get("metric")])
        ]
        filters = [
            get_filter_name(filter_obj)
            for filter_obj in params.get("adhoc_filters", [])
        ]
        group_bys = params.get("groupby", []) or []
        if isinstance(group_bys, str):
            group_bys = [group_bys]
        custom_properties = {
            "Metrics": ", ".join(metrics),
            "Filters": ", ".join(filters),
            "Dimensions": ", ".join(group_bys),
        }

        chart = Chart(
            name=chart_id,
            displayName=name,
            description="",
            chart_type=chart_type,
            url=chart_url,
            owners=owners,
            datasource_fqn=datasource_fqn,
            lastModified=last_modified,
            service=EntityReference(id=self.service.id, type="dashboardService"),
            custom_props=custom_properties,
        )
        return chart

    def _fetch_charts(self):
        current_page = 0
        page_size = 25
        total_charts = self.client.fetch_total_charts()
        while current_page * page_size <= total_charts:
            charts = self.client.fetch_charts(current_page, page_size)
            current_page += 1
            for chart_json in charts["result"]:
                yield self._build_chart(chart_json)

    def get_status(self):
        return self.status

    def close(self):
        pass
