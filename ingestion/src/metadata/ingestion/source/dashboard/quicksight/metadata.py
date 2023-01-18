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
"""QuickSight source module"""

import traceback
from typing import Any, Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.quickSightConnection import (
    QuickSightConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# BoundLimit for MaxResults = MaxResults >= 0 and MaxResults <= 100
QUICKSIGHT_MAXRESULTS = 2


class QuicksightSource(DashboardServiceSource):
    """
    QuickSight Source Class
    """

    config: WorkflowSource
    metadata: OpenMetadataConnection
    status: SourceStatus

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__(config, metadata_config)
        self.aws_account_id = self.service_connection.awsAccountId
        self.dashboard_url = None
        self.default_args = {
            "AwsAccountId": self.aws_account_id,
            "MaxResults": QUICKSIGHT_MAXRESULTS,
        }

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: QuickSightConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, QuickSightConnection):
            raise InvalidSourceException(
                f"Expected QuickSightConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def _check_pagination(self, listing_method, entity_key) -> Optional[List]:
        entity_summary_list = []
        entity_response = listing_method(self.default_args)
        entity_summary_list.extend(entity_response[entity_key])
        while entity_response.get("NextToken"):
            try:
                copied_def_args = self.default_args.copy()
                copied_def_args.update({"NextToken": entity_response.get("NextToken")})
                entity_response = listing_method(copied_def_args)
                entity_summary_list.extend(entity_response[entity_key])
            except Exception as err:
                logger.error(err)
                logger.debug(traceback.format_exc())
                break
        return entity_summary_list

    def get_dashboards_list(self) -> Optional[List[dict]]:
        """
        Get List of all dashboards
        """
        list_dashboards_func = lambda kwargs: self.client.list_dashboards(  # pylint: disable=unnecessary-lambda-assignment
            **kwargs
        )

        dashboard_summary_list = self._check_pagination(
            listing_method=list_dashboards_func,
            entity_key="DashboardSummaryList",
        )
        dashboard_set = {
            dashboard["DashboardId"] for dashboard in dashboard_summary_list
        }
        dashboards = [
            self.client.describe_dashboard(
                AwsAccountId=self.aws_account_id, DashboardId=dashboard_id
            )["Dashboard"]
            for dashboard_id in dashboard_set
        ]
        return dashboards

    def get_dashboard_name(self, dashboard: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard["Name"]

    def get_dashboard_details(self, dashboard: dict) -> dict:
        """
        Get Dashboard Details
        """
        return dashboard

    def yield_dashboard(
        self, dashboard_details: dict
    ) -> Iterable[CreateDashboardRequest]:
        """
        Method to Get Dashboard Entity
        """
        self.dashboard_url = self.client.get_dashboard_embed_url(
            AwsAccountId=self.aws_account_id,
            DashboardId=dashboard_details["DashboardId"],
            IdentityType=self.config.serviceConnection.__root__.config.identityType.value,
            Namespace=self.config.serviceConnection.__root__.config.namespace or "",
        )["EmbedUrl"]

        yield CreateDashboardRequest(
            name=dashboard_details["DashboardId"],
            dashboardUrl=self.dashboard_url,
            displayName=dashboard_details["Name"],
            description=dashboard_details["Version"].get("Description", ""),
            charts=[
                EntityReference(id=chart.id.__root__, type="chart")
                for chart in self.context.charts
            ],
            service=EntityReference(
                id=self.context.dashboard_service.id.__root__, type="dashboardService"
            ),
        )

    def yield_dashboard_chart(
        self, dashboard_details: Any
    ) -> Optional[Iterable[CreateChartRequest]]:
        """Get chart method

        Args:
            dashboard_details:
        Returns:
            Iterable[CreateChartRequest]
        """
        # Each dashboard is guaranteed to have at least one sheet, which represents
        # a chart in the context of QuickSight
        # https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/quicksight.html#QuickSight.Client.describe_dashboard
        charts = dashboard_details["Version"]["Sheets"]
        for chart in charts:
            try:
                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart["Name"]
                ):
                    self.status.filter(chart["Name"], "Chart Pattern not allowed")
                    continue

                yield CreateChartRequest(
                    name=chart["Name"],
                    displayName=chart["Name"],
                    description="",
                    chartType=ChartType.Other.value,
                    chartUrl=f"{self.dashboard_url}/sheets/{chart['SheetId']}",
                    service=EntityReference(
                        id=self.context.dashboard_service.id.__root__,
                        type="dashboardService",
                    ),
                )
                self.status.scanned(chart["Name"])
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error creating chart [{chart}]: {exc}")
                continue

    def yield_dashboard_lineage_details(  # pylint: disable=too-many-locals
        self, dashboard_details: dict, db_service_name: str
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        """
        try:  # pylint: disable=too-many-nested-blocks
            list_data_set_func = lambda kwargs: self.client.list_data_sets(  # pylint: disable=unnecessary-lambda-assignment
                **kwargs
            )
            data_set_summary_list = self._check_pagination(
                listing_method=list_data_set_func,
                entity_key="DataSetSummaries",
            )
            dataset_ids = {
                dataset["DataSetId"]
                for dataset in data_set_summary_list
                if dataset.get("Arn") in dashboard_details["Version"]["DataSetArns"]
            }

            for dataset_id in dataset_ids:
                for data_source in list(
                    self.client.describe_data_set(
                        AwsAccountId=self.aws_account_id, DataSetId=dataset_id
                    )["DataSet"]["PhysicalTableMap"].values()
                ):
                    if any(
                        data_source_resp in data_source
                        for data_source_resp in ["S3Source", "CustomSql"]
                    ):
                        logger.warning(
                            "We currently don't support lineage to S3 Source or Custom Sql Queries"
                        )
                        continue

                    # db_name = data_source
                    schema_name = data_source["RelationalTable"]["Schema"]
                    table_name = data_source["RelationalTable"]["Name"]

                    list_data_source_func = lambda kwargs: self.client.list_data_sources(  # pylint: disable=unnecessary-lambda-assignment
                        **kwargs
                    )

                    data_source_summary_list = self._check_pagination(
                        listing_method=list_data_source_func,
                        entity_key="DataSources",
                    )

                    data_source_ids = [
                        data_source_arn["DataSourceId"]
                        for data_source_arn in data_source_summary_list
                        if data_source_arn["Arn"]
                        in data_source["RelationalTable"]["DataSourceArn"]
                    ]

                    for data_source_id in data_source_ids:
                        data_source_dict = self.client.describe_data_source(
                            AwsAccountId=self.aws_account_id,
                            DataSourceId=data_source_id,
                        )["DataSource"]["DataSourceParameters"]
                        for db in data_source_dict.keys():
                            from_fqn = None
                            try:
                                database_name = data_source_dict[db]["Database"]
                            except Exception as err:
                                logger.error(err)
                                logger.debug(traceback.format_exc())
                                database_name = None
                                from_fqn = fqn.build(
                                    self.metadata,
                                    entity_type=Table,
                                    service_name=db_service_name,
                                    table_name=table_name,
                                    schema_name=schema_name,
                                    database_name="",
                                )
                            from_entity = self.metadata.get_by_name(
                                entity=Table,
                                fqn=f"{db_service_name}{fqn.FQN_SEPARATOR}"
                                f"{database_name}{fqn.FQN_SEPARATOR}{schema_name}{fqn.FQN_SEPARATOR}{table_name}"
                                if database_name
                                else from_fqn,
                            )

                            to_entity = self.metadata.get_by_name(
                                entity=Dashboard,
                                fqn=f"{self.config.serviceName}{fqn.FQN_SEPARATOR}{dashboard_details['DashboardId']}",
                            )
                            yield self._get_add_lineage_request(
                                to_entity=to_entity, from_entity=from_entity
                            )
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error to yield dashboard lineage details for DB service name [{db_service_name}]: {exc}"
            )
