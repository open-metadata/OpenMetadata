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
from typing import Iterable, List, Optional

from pydantic import ValidationError

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart, ChartType
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.quickSightConnection import (
    QuickSightConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
    Uuid,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import search_table_entities
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import (
    LINEAGE_MAP,
    DashboardServiceSource,
)
from metadata.ingestion.source.dashboard.quicksight.models import (
    DashboardDetail,
    DashboardResp,
    DataSourceResp,
    DataSourceRespQuery,
    DataSourceRespS3,
    DescribeDataSourceResponse,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# BoundLimit for MaxResults = MaxResults >= 0 and MaxResults <= 100
QUICKSIGHT_MAX_RESULTS = 100


class QuicksightSource(DashboardServiceSource):
    """
    QuickSight Source Class
    """

    config: WorkflowSource
    metadata: OpenMetadata

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.aws_account_id = self.service_connection.awsAccountId
        self.dashboard_url = None
        self.aws_region = self.config.serviceConnection.root.config.awsConfig.awsRegion
        self.default_args = {
            "AwsAccountId": self.aws_account_id,
            "MaxResults": QUICKSIGHT_MAX_RESULTS,
        }

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: QuickSightConnection = config.serviceConnection.root.config
        if not isinstance(connection, QuickSightConnection):
            raise InvalidSourceException(
                f"Expected QuickSightConnection, but got {connection}"
            )
        return cls(config, metadata)

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
                logger.error(f"Pagination Failed with error: {err}")
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
            DashboardResp(
                **self.client.describe_dashboard(
                    AwsAccountId=self.aws_account_id, DashboardId=dashboard_id
                )
            ).Dashboard
            for dashboard_id in dashboard_set
        ]
        return dashboards

    def get_dashboard_name(self, dashboard: DashboardDetail) -> str:
        """
        Get Dashboard Name
        """
        return dashboard.Name

    def get_dashboard_details(self, dashboard: DashboardDetail) -> DashboardDetail:
        """
        Get Dashboard Details
        """
        return dashboard

    def yield_dashboard(
        self, dashboard_details: DashboardDetail
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        dashboard_request = CreateDashboardRequest(
            name=EntityName(dashboard_details.DashboardId),
            sourceUrl=SourceUrl(self.dashboard_url),
            displayName=dashboard_details.Name,
            description=Markdown(dashboard_details.Version.Description)
            if dashboard_details.Version and dashboard_details.Version.Description
            else None,
            charts=[
                FullyQualifiedEntityName(
                    fqn.build(
                        self.metadata,
                        entity_type=Chart,
                        service_name=self.context.get().dashboard_service,
                        chart_name=chart,
                    )
                )
                for chart in self.context.get().charts or []
            ],
            service=self.context.get().dashboard_service,
            owners=self.get_owner_ref(dashboard_details=dashboard_details),
        )
        yield Either(right=dashboard_request)
        self.register_record(dashboard_request=dashboard_request)

    def yield_dashboard_chart(
        self, dashboard_details: DashboardDetail
    ) -> Iterable[Either[CreateChartRequest]]:
        """Get chart method"""
        # Each dashboard is guaranteed to have at least one sheet, which represents
        # a chart in the context of QuickSight
        # https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/quicksight.html#QuickSight.Client.describe_dashboard
        if dashboard_details.Version:
            for chart in dashboard_details.Version.Charts or []:
                try:
                    if filter_by_chart(
                        self.source_config.chartFilterPattern, chart.Name
                    ):
                        self.status.filter(chart.Name, "Chart Pattern not allowed")
                        continue

                    self.dashboard_url = (
                        f"https://{self.aws_region}.quicksight.aws.amazon.com/sn/dashboards"
                        f"/{dashboard_details.DashboardId}"
                    )
                    yield Either(
                        right=CreateChartRequest(
                            name=EntityName(chart.ChartId),
                            displayName=chart.Name,
                            chartType=ChartType.Other.value,
                            sourceUrl=SourceUrl(self.dashboard_url),
                            service=FullyQualifiedEntityName(
                                self.context.get().dashboard_service
                            ),
                        )
                    )
                except Exception as exc:
                    yield Either(
                        left=StackTraceError(
                            name="Chart",
                            error=f"Error creating chart [{chart}]: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def _get_database_service(self, db_service_name: str):
        return self.metadata.get_by_name(DatabaseService, db_service_name)

    def _yield_lineage_from_query(
        self,
        data_source_ids: list,
        dashboard_details: DashboardDetail,
        db_service_name: str,
        data_source_resp: DataSourceRespQuery,
    ) -> Iterable[Either[AddLineageRequest]]:
        """yield lineage from table(parsed form query source) <-> dashboard"""
        sql_query = data_source_resp.query
        database_names = []
        try:
            for data_source_id in data_source_ids or []:
                data_source_resp = DescribeDataSourceResponse(
                    **self.client.describe_data_source(
                        AwsAccountId=self.aws_account_id,
                        DataSourceId=data_source_id,
                    )
                ).DataSource
                if data_source_resp and data_source_resp.DataSourceParameters:
                    data_source_dict = data_source_resp.DataSourceParameters
                    for db in data_source_dict.keys() or []:
                        database_names.append(data_source_dict[db].get("Database"))
        except Exception as err:
            logger.info(f"Error to parse database names from source:{err}")
            return None

        try:
            db_service = self._get_database_service(db_service_name)
            lineage_parser = LineageParser(
                sql_query,
                ConnectionTypeDialectMapper.dialect_of(db_service.serviceType.value)
                if db_service
                else None,
            )
            lineage_details = LineageDetails(
                source=LineageSource.DashboardLineage, sqlQuery=sql_query
            )
            for datbase_name in database_names:
                for table in lineage_parser.source_tables:
                    database_schema_name, table = fqn.split(str(table))[-2:]
                    database_schema_name = self.check_database_schema_name(
                        database_schema_name
                    )
                    from_entities = search_table_entities(
                        metadata=self.metadata,
                        database=datbase_name,
                        service_name=db_service_name,
                        database_schema=database_schema_name,
                        table=table,
                    )
                    to_fqn = fqn.build(
                        self.metadata,
                        entity_type=Dashboard,
                        service_name=self.config.serviceName,
                        dashboard_name=dashboard_details.DashboardId,
                    )
                    to_entity = self.metadata.get_by_name(
                        entity=Dashboard,
                        fqn=to_fqn,
                    )
                    for from_entity in from_entities:
                        if from_entity and to_entity:
                            yield Either(
                                right=AddLineageRequest(
                                    edge=EntitiesEdge(
                                        fromEntity=EntityReference(
                                            id=Uuid(from_entity.id.root),
                                            type=LINEAGE_MAP[type(from_entity)],
                                        ),
                                        toEntity=EntityReference(
                                            id=Uuid(to_entity.id.root),
                                            type=LINEAGE_MAP[type(to_entity)],
                                        ),
                                        lineageDetails=lineage_details,
                                    )
                                )
                            )

        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.DashboardId,
                    error=f"Wild error ingesting dashboard lineage {dashboard_details} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _yield_lineage_from_s3(
        self, data_source_ids: list, dashboard_details: DashboardDetail
    ) -> Iterable[Either[AddLineageRequest]]:
        """yield lineage from s3 container <-> dashboard"""
        try:
            for data_source_id in data_source_ids or []:
                data_source_resp = DescribeDataSourceResponse(
                    **self.client.describe_data_source(
                        AwsAccountId=self.aws_account_id,
                        DataSourceId=data_source_id,
                    )
                ).DataSource
                if data_source_resp and data_source_resp.DataSourceParameters:
                    data_source_dict = data_source_resp.DataSourceParameters
                    for s3_param in data_source_dict.keys() or []:
                        bucket_name = (
                            data_source_dict[s3_param]
                            .get("ManifestFileLocation", {})
                            .get("Bucket")
                        )
                        key_name = (
                            data_source_dict[s3_param]
                            .get("ManifestFileLocation", {})
                            .get("Key")
                        )
                        container = self.metadata.es_search_container_by_path(
                            full_path=f"s3://{bucket_name}/{key_name}"
                        )
                        if container and container[0]:
                            storage_entity = EntityReference(
                                id=Uuid(container[0].id.root),
                                type="container",
                            )
                            to_fqn = fqn.build(
                                self.metadata,
                                entity_type=Dashboard,
                                service_name=self.config.serviceName,
                                dashboard_name=dashboard_details.DashboardId,
                            )
                            to_entity = self.metadata.get_by_name(
                                entity=Dashboard,
                                fqn=to_fqn,
                            )

                            if to_entity and storage_entity:
                                yield Either(
                                    right=AddLineageRequest(
                                        edge=EntitiesEdge(
                                            fromEntity=storage_entity,
                                            toEntity=EntityReference(
                                                id=Uuid(to_entity.id.root),
                                                type=LINEAGE_MAP[type(to_entity)],
                                            ),
                                        )
                                    )
                                )
        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.DashboardId,
                    error=f"Wild error ingesting dashboard lineage {dashboard_details} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _yield_lineage_from_table(
        self,
        data_source_ids: list,
        dashboard_details: DashboardDetail,
        db_service_name: str,
        data_source_resp: DataSourceResp,
    ) -> Iterable[Either[AddLineageRequest]]:
        """yield lineage from table <-> dashboard"""
        schema_name = data_source_resp.schema_name
        table_name = data_source_resp.table_name

        for data_source_id in data_source_ids or []:
            data_source_resp = DescribeDataSourceResponse(
                **self.client.describe_data_source(
                    AwsAccountId=self.aws_account_id,
                    DataSourceId=data_source_id,
                )
            ).DataSource
            if data_source_resp and data_source_resp.DataSourceParameters:
                data_source_dict = data_source_resp.DataSourceParameters
                for db in data_source_dict.keys() or []:
                    from_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=db_service_name,
                        database_name=data_source_dict[db].get("Database"),
                        schema_name=schema_name,
                        table_name=table_name,
                    )
                    from_entity = self.metadata.get_by_name(
                        entity=Table,
                        fqn=from_fqn,
                    )
                    to_fqn = fqn.build(
                        self.metadata,
                        entity_type=Dashboard,
                        service_name=self.config.serviceName,
                        dashboard_name=dashboard_details.DashboardId,
                    )
                    to_entity = self.metadata.get_by_name(
                        entity=Dashboard,
                        fqn=to_fqn,
                    )
                    if from_entity is not None and to_entity is not None:
                        yield self._get_add_lineage_request(
                            to_entity=to_entity,
                            from_entity=from_entity,
                        )

    def yield_dashboard_lineage_details(  # pylint: disable=too-many-locals
        self, dashboard_details: DashboardDetail, db_service_name: str
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        """
        try:
            list_data_set_func = lambda kwargs: self.client.list_data_sets(  # pylint: disable=unnecessary-lambda-assignment
                **kwargs
            )
            data_set_summary_list = self._check_pagination(
                listing_method=list_data_set_func,
                entity_key="DataSetSummaries",
            )
            dataset_ids = {
                dataset["DataSetId"]
                for dataset in data_set_summary_list or []
                if dataset.get("Arn") in dashboard_details.Version.DataSetArns
            }

            for dataset_id in dataset_ids or []:
                data_source_list = self._describe_data_sets(
                    dataset_id, dashboard_details
                )
                for data_source in data_source_list:
                    try:
                        if data_source.get("RelationalTable"):
                            data_source_resp = DataSourceResp(
                                **data_source["RelationalTable"]
                            )
                        elif data_source.get("CustomSql"):
                            data_source_resp = DataSourceRespQuery(
                                **data_source["CustomSql"]
                            )
                        elif data_source.get("S3Source"):
                            data_source_resp = DataSourceRespS3(
                                **data_source["S3Source"]
                            )
                        else:
                            raise KeyError(
                                f"We currently don't support lineage to {list(data_source.keys())}"
                            )
                    except (KeyError, ValidationError) as err:
                        data_source_resp = None
                        yield Either(
                            left=StackTraceError(
                                name="Lineage",
                                error=(
                                    "Error to yield dashboard lineage details for DB service"
                                    f" name [{db_service_name}]: {err}"
                                ),
                                stackTrace=traceback.format_exc(),
                            )
                        )
                    if data_source_resp:
                        list_data_source_func = lambda kwargs: self.client.list_data_sources(  # pylint: disable=unnecessary-lambda-assignment
                            **kwargs
                        )

                        data_source_summary_list = self._check_pagination(
                            listing_method=list_data_source_func,
                            entity_key="DataSources",
                        )

                        data_source_ids = [
                            data_source_arn["DataSourceId"]
                            for data_source_arn in data_source_summary_list or []
                            if data_source_arn["Arn"] in data_source_resp.datasource_arn
                        ]

                        if isinstance(data_source_resp, DataSourceRespQuery):
                            yield from self._yield_lineage_from_query(
                                data_source_ids,
                                dashboard_details,
                                db_service_name,
                                data_source_resp,
                            )
                        elif isinstance(data_source_resp, DataSourceRespS3):
                            yield from self._yield_lineage_from_s3(
                                data_source_ids, dashboard_details
                            )
                        elif isinstance(data_source_resp, DataSourceResp):
                            yield from self._yield_lineage_from_table(
                                data_source_ids,
                                dashboard_details,
                                db_service_name,
                                data_source_resp,
                            )
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name="Lineage",
                    error=f"Error to yield dashboard lineage details for DB service name [{db_service_name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _describe_data_sets(self, dataset_id, dashboard_details) -> List:
        """call botocore's describe api for datasets"""
        try:
            return list(
                self.client.describe_data_set(
                    AwsAccountId=self.aws_account_id, DataSetId=dataset_id
                )["DataSet"]["PhysicalTableMap"].values()
            )
        except Exception as err:
            logger.info(
                f"Cannot parse lineage from the dashboard: {dashboard_details.Name} to dataset due to: {err}"
            )
            return []
