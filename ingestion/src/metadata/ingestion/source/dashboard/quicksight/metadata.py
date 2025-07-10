#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
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
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart, ChartType
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, Table
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
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import (
    LINEAGE_MAP,
    DashboardServiceSource,
)
from metadata.ingestion.source.dashboard.quicksight.models import (
    DashboardDetail,
    DashboardResp,
    DataSourceModel,
    DataSourceResp,
    DataSourceRespQuery,
    DataSourceRespS3,
    DescribeDataSourceResponse,
)
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.fqn import build_es_fqn_search_string
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
            description=(
                Markdown(dashboard_details.Version.Description)
                if dashboard_details.Version and dashboard_details.Version.Description
                else None
            ),
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

    def _describe_data_sets(
        self, dataset_id, dashboard_details: DashboardDetail
    ) -> List:
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

    def _yield_lineage_from_query(
        self,
        data_model_entity,
        data_source_resp: DataSourceModel,
        dashboard_details: DashboardDetail,
        db_service_prefix: Optional[str],
    ) -> Iterable[Either[AddLineageRequest]]:
        """yield lineage from table(parsed form query source) <-> dashboard"""
        db_service_entity = None
        (
            db_service_name,
            prefix_database_name,
            prefix_schema_name,
            prefix_table_name,
        ) = self.parse_db_service_prefix(db_service_prefix)
        if db_service_prefix:
            db_service_entity = self.metadata.get_by_name(
                entity=DatabaseService, fqn=db_service_name
            )
        sql_query = data_source_resp.data_source_resp.query
        source_database_names = []
        try:
            if data_source_resp.DataSourceParameters:
                data_source_dict = data_source_resp.DataSourceParameters
                for db in data_source_dict.keys() or []:
                    source_database_names.append(data_source_dict[db].get("Database"))
        except Exception as err:
            logger.info(f"Error to parse database names from source:{err}")
            return None

        try:
            lineage_parser = LineageParser(
                sql_query,
                (
                    ConnectionTypeDialectMapper.dialect_of(
                        db_service_entity.serviceType.value
                    )
                    if db_service_entity
                    else Dialect.ANSI
                ),
            )
            lineage_details = LineageDetails(
                source=LineageSource.DashboardLineage, sqlQuery=sql_query
            )
            for db_name in source_database_names:
                if (
                    prefix_database_name
                    and db_name
                    and prefix_database_name.lower() != str(db_name).lower()
                ):
                    logger.debug(
                        f"Database {db_name} does not match prefix {prefix_database_name}"
                    )
                    continue
                for table in lineage_parser.source_tables:
                    database_schema_name, table = fqn.split(str(table))[-2:]
                    database_schema_name = self.check_database_schema_name(
                        database_schema_name
                    )

                    if (
                        prefix_schema_name
                        and database_schema_name
                        and prefix_schema_name.lower() != database_schema_name.lower()
                    ):
                        logger.debug(
                            f"Schema {database_schema_name} does not match prefix {prefix_schema_name}"
                        )
                        continue

                    if (
                        prefix_table_name
                        and table
                        and prefix_table_name.lower() != table.lower()
                    ):
                        logger.debug(
                            f"Table {table} does not match prefix {prefix_table_name}"
                        )
                        continue

                    fqn_search_string = build_es_fqn_search_string(
                        database_name=prefix_database_name or db_name,
                        schema_name=prefix_schema_name or database_schema_name,
                        service_name=db_service_name or "*",
                        table_name=prefix_table_name or table,
                    )
                    from_entities = self.metadata.search_in_any_service(
                        entity_type=Table,
                        fqn_search_string=fqn_search_string,
                        fetch_multiple_entities=True,
                    )
                    for from_entity in from_entities or []:
                        if from_entity is not None and data_model_entity is not None:
                            columns = [
                                col.name.root for col in data_model_entity.columns
                            ]
                            column_lineage = self._get_column_lineage(
                                from_entity, data_model_entity, columns
                            )
                            lineage_details.columnsLineage = column_lineage
                            yield Either(
                                right=AddLineageRequest(
                                    edge=EntitiesEdge(
                                        fromEntity=EntityReference(
                                            id=Uuid(from_entity.id.root),
                                            type=LINEAGE_MAP[type(from_entity)],
                                        ),
                                        toEntity=EntityReference(
                                            id=Uuid(data_model_entity.id.root),
                                            type=LINEAGE_MAP[type(data_model_entity)],
                                        ),
                                        lineageDetails=lineage_details,
                                    )
                                )
                            )

        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.DashboardId,
                    error=f"Wild error ingesting table(query) <-> datamodel lineage {dashboard_details} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _yield_lineage_from_s3(
        self,
        data_model_entity,
        data_source_resp: DataSourceModel,
        dashboard_details: DashboardDetail,
    ) -> Iterable[Either[AddLineageRequest]]:
        """yield lineage from s3 container <-> dashboard"""
        try:
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
                    containers = self.metadata.es_search_container_by_path(
                        full_path=f"s3://{bucket_name}/{key_name}"
                    )
                    for container in containers or []:
                        if container is not None and data_model_entity is not None:
                            storage_entity = EntityReference(
                                id=Uuid(container.id.root),
                                type="container",
                            )
                            yield Either(
                                right=AddLineageRequest(
                                    edge=EntitiesEdge(
                                        fromEntity=storage_entity,
                                        toEntity=EntityReference(
                                            id=Uuid(data_model_entity.id.root),
                                            type=LINEAGE_MAP[type(data_model_entity)],
                                        ),
                                    )
                                )
                            )
        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.DashboardId,
                    error=f"Wild error ingesting s3 <-> datamodel lineage {dashboard_details} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _yield_lineage_from_table(
        self,
        data_model_entity,
        data_source_resp: DataSourceModel,
        dashboard_details: DashboardDetail,
        db_service_prefix: Optional[str],
    ) -> Iterable[Either[AddLineageRequest]]:
        """yield lineage from table <-> dashboard"""
        try:
            (
                db_service_name,
                prefix_database_name,
                prefix_schema_name,
                prefix_table_name,
            ) = self.parse_db_service_prefix(db_service_prefix)
            schema_name = data_source_resp.data_source_resp.schema_name
            table_name = data_source_resp.data_source_resp.table_name

            if (
                prefix_schema_name
                and schema_name
                and prefix_schema_name.lower() != schema_name.lower()
            ):
                logger.debug(
                    f"Schema {schema_name} does not match prefix {prefix_schema_name}"
                )
                return

            if (
                prefix_table_name
                and table_name
                and prefix_table_name.lower() != table_name.lower()
            ):
                logger.debug(
                    f"Table {table_name} does not match prefix {prefix_table_name}"
                )
                return

            if data_source_resp and data_source_resp.DataSourceParameters:
                data_source_dict = data_source_resp.DataSourceParameters
                for db in data_source_dict.keys() or []:
                    database_name = data_source_dict[db].get("Database")
                    if (
                        prefix_database_name
                        and database_name
                        and prefix_database_name.lower() != database_name.lower()
                    ):
                        logger.debug(
                            f"Database {database_name} does not match prefix {prefix_database_name}"
                        )
                        continue

                    fqn_search_string = build_es_fqn_search_string(
                        database_name=prefix_database_name or database_name,
                        schema_name=prefix_schema_name or schema_name,
                        service_name=db_service_name or "*",
                        table_name=prefix_table_name or table_name,
                    )
                    from_entity = self.metadata.search_in_any_service(
                        entity_type=Table,
                        fqn_search_string=fqn_search_string,
                    )
                    if from_entity is not None and data_model_entity is not None:
                        columns = [col.name.root for col in data_model_entity.columns]
                        column_lineage = self._get_column_lineage(
                            from_entity, data_model_entity, columns
                        )
                        yield self._get_add_lineage_request(
                            to_entity=data_model_entity,
                            from_entity=from_entity,
                            column_lineage=column_lineage,
                        )
        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.DashboardId,
                    error=f"Wild error ingesting table <-> datamodel lineage {dashboard_details} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _get_datamodel(self, datamodel_id: str):
        datamodel_fqn = fqn.build(
            self.metadata,
            entity_type=DashboardDataModel,
            service_name=self.context.get().dashboard_service,
            data_model_name=datamodel_id,
        )
        if datamodel_fqn:
            return self.metadata.get_by_name(
                entity=DashboardDataModel,
                fqn=datamodel_fqn,
            )
        return None

    def yield_dashboard_lineage_details(  # pylint: disable=too-many-locals
        self,
        dashboard_details: DashboardDetail,
        db_service_prefix: Optional[str] = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        """
        db_service_name, *_ = self.parse_db_service_prefix(db_service_prefix)
        for datamodel in self.data_models or []:
            try:
                data_model_entity = self._get_datamodel(
                    datamodel_id=datamodel.DataSource.DataSourceId
                )
                if isinstance(
                    datamodel.DataSource.data_source_resp, DataSourceRespQuery
                ):
                    yield from self._yield_lineage_from_query(
                        data_model_entity,
                        datamodel.DataSource,
                        dashboard_details,
                        db_service_prefix,
                    )
                elif isinstance(
                    datamodel.DataSource.data_source_resp, DataSourceRespS3
                ):
                    yield from self._yield_lineage_from_s3(
                        data_model_entity, datamodel.DataSource, dashboard_details
                    )
                elif isinstance(datamodel.DataSource.data_source_resp, DataSourceResp):
                    yield from self._yield_lineage_from_table(
                        data_model_entity,
                        datamodel.DataSource,
                        dashboard_details,
                        db_service_prefix,
                    )
            except Exception as exc:  # pylint: disable=broad-except
                yield Either(
                    left=StackTraceError(
                        name="Lineage",
                        error=f"Error to yield dashboard lineage details for DB service name [{db_service_name}] and dashboard_name [{dashboard_details.Name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _get_column_info(self, data_model: DescribeDataSourceResponse):
        """Get column info"""
        datasource_columns = []
        for field in data_model.DataSource.data_source_resp.columns or []:
            try:
                col_parse = ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
                    field.get("Type")
                )
                parsed_fields = {
                    "name": field.get("Name"),
                    "displayName": field.get("Name"),
                    "dataType": col_parse.get("dataType"),
                }
                datasource_columns.append(Column(**parsed_fields))
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error to yield datamodel column: {exc}")
        return datasource_columns

    def _get_dashboard_datamodels(self, dashboard_details: DashboardDetail) -> list:
        """Get dashboard datamodels"""
        data_models = []
        dataset_ids = []
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
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error while processing datamodels for dashboard: {dashboard_details.Name}: {exc}"
            )

        for dataset_id in dataset_ids or []:
            data_source_list = self._describe_data_sets(dataset_id, dashboard_details)
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
                        data_source_resp = DataSourceRespS3(**data_source["S3Source"])
                    else:
                        raise KeyError(
                            f"We currently don't support data sources: {list(data_source.keys())}"
                        )
                except (KeyError, ValidationError) as err:
                    data_source_resp = None
                    logger.info(
                        f"Error while processing datamodels for dashboard {dashboard_details.Name}: {err}"
                    )
                    continue
                if data_source_resp:
                    try:
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
                        for data_source_id in data_source_ids or []:
                            desribed_source = DescribeDataSourceResponse(
                                **self.client.describe_data_source(
                                    AwsAccountId=self.aws_account_id,
                                    DataSourceId=data_source_id,
                                )
                            )
                            desribed_source.DataSource.data_source_resp = (
                                data_source_resp
                            )
                            data_models.append(desribed_source)
                    except Exception as err:
                        logger.info(
                            f"Error while processing data sources for dashboard {dashboard_details.Name}: {err}"
                        )
        return data_models

    def yield_datamodel(
        self, dashboard_details: DashboardDetail
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """
        Method to ingest the Datasources(Published and Embedded) as DataModels from Quicksight
        """
        self.data_models: List[
            DescribeDataSourceResponse
        ] = self._get_dashboard_datamodels(dashboard_details)
        for data_model in self.data_models:
            try:
                data_model_request = CreateDashboardDataModelRequest(
                    name=EntityName(data_model.DataSource.DataSourceId),
                    displayName=data_model.DataSource.Name,
                    service=FullyQualifiedEntityName(
                        self.context.get().dashboard_service
                    ),
                    dataModelType=DataModelType.QuickSightDataModel.value,
                    serviceType=self.service_connection.type.value,
                    columns=self._get_column_info(data_model),
                )
                yield Either(right=data_model_request)
                self.register_record_datamodel(datamodel_request=data_model_request)
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=data_model.DataSource.Name,
                        error=f"Error yielding Data Model [{data_model.DataSource.Name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )
