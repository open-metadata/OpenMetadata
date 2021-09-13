import logging
import uuid
from typing import Iterable, Optional
import dateutil.parser as dateparser
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import ConfigModel, Record, WorkflowContext
from metadata.generated.schema.entity.services.dashboardService import DashboardServiceType
from metadata.ingestion.api.common import IncludeFilterPattern
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.table_metadata import Dashboard, Chart, DashboardOwner
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.utils.helpers import get_dashboard_service_or_create
from tableau_api_lib import TableauServerConnection
from tableau_api_lib.utils.querying import get_workbooks_dataframe, get_views_dataframe

logger = logging.getLogger(__name__)


class TableauSourceConfig(ConfigModel):
    username: str
    password: str
    server: str
    api_version: str
    env: Optional[str] = 'tableau_prod'
    site_name: str
    site_url: str
    service_name: str
    service_type: str = "Tableau"
    dashboard_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    chart_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()


class TableauSource(Source):
    config: TableauSourceConfig
    metadata_config: MetadataServerConfig
    status: SourceStatus

    def __init__(
            self, config: TableauSourceConfig, metadata_config: MetadataServerConfig,
            ctx: WorkflowContext
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.client = self.tableau_client()
        self.service = get_dashboard_service_or_create(
            config.service_name,
            DashboardServiceType.Tableau.name,
            config.username,
            config.password,
            config.server,
            metadata_config
        )
        self.status = SourceStatus()
        self.dashboards = get_workbooks_dataframe(self.client).to_dict()
        self.all_dashboard_details = get_views_dataframe(self.client).to_dict()

    def tableau_client(self):
        tableau_server_config = {
            f'{self.config.env}': {
                'server': self.config.server,
                'api_version': self.config.api_version,
                'username': self.config.username,
                'password': self.config.password,
                'site_name': self.config.site_name,
                'site_url': self.config.site_url
            }
        }
        try:
            conn = TableauServerConnection(config_json=tableau_server_config, env='tableau_prod')
            conn.sign_in().json()
        except Exception as err:
            print(f"{repr(err)}: {err}")
        return conn

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = TableauSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Record]:
        yield from self._get_tableau_charts()
        yield from self._get_tableau_dashboard()

    @staticmethod
    def get_owner(owner) -> DashboardOwner:
        return [DashboardOwner(
            first_name=owner['fullName'].split(" ")[0],
            last_name=owner['fullName'].split(" ")[1],
            username=owner['name']
        )]

    def _get_tableau_dashboard(self) -> Dashboard:
        for index in range(len(self.dashboards['id'])):
            dashboard_id = self.dashboards['id'][index]
            dashboard_name = self.dashboards['name'][index]
            dashboard_tag = self.dashboards['tags'][index]
            dashboard_url = self.dashboards['webpageUrl'][index]
            tag_labels = []
            if hasattr(dashboard_tag, 'tag'):
                for tag in dashboard_tag['tag']:
                    tag_labels.append(tag['label'])
            dashboard_chart = []
            for chart_index in self.all_dashboard_details['workbook']:
                dashboard_owner = self.all_dashboard_details['owner'][chart_index]
                chart = self.all_dashboard_details['workbook'][chart_index]
                if chart['id'] == dashboard_id:
                    dashboard_chart.append(self.all_dashboard_details["name"][chart_index])
            yield Dashboard(
                id=uuid.uuid4(),
                name=dashboard_id,
                displayName=dashboard_name,
                description='',
                owner=self.get_owner(dashboard_owner),
                charts=dashboard_chart,
                tags=list(tag_labels),
                url=dashboard_url,
                service=EntityReference(
                    id=self.service.id, type="dashboardService"
                ),
                last_modified=dateparser.parse(chart["updatedAt"]).timestamp() * 1000
            )

    def _get_tableau_charts(self):
        for index in range(len(self.all_dashboard_details['id'])):
            chart_name = self.all_dashboard_details["name"][index]
            chart_id = self.all_dashboard_details["id"][index]
            chart_tags = self.all_dashboard_details["tags"][index]
            chart_type = self.all_dashboard_details["sheetType"][index]
            chart_url = f"{self.config.server}/#/site/{self.config.site_name}" \
                        f"{self.all_dashboard_details['contentUrl'][index]}"
            chart_owner = self.all_dashboard_details["owner"][index]
            chart_datasource_fqn = chart_url.replace("/", ".")
            chart_last_modified = self.all_dashboard_details["updatedAt"][index]
            tag_labels = []
            if hasattr(chart_tags, 'tag'):
                for tag in chart_tags['tag']:
                    tag_labels.append(tag['label'])
            yield Chart(
                name=chart_id,
                displayName=chart_name,
                description="",
                chart_type=chart_type,
                url=chart_url,
                owners=self.get_owner(chart_owner),
                datasource_fqn=chart_datasource_fqn,
                last_modified=dateparser.parse(
                    chart_last_modified
                ).timestamp() * 1000,
                service=EntityReference(id=self.service.id, type="dashboardService"),
            )

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass
