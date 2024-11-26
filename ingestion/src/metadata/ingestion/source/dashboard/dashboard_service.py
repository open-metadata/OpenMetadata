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
"""
Base class for ingesting dashboard services
"""
import traceback
from abc import ABC, abstractmethod
from typing import Any, Iterable, List, Optional, Set, Union

from pydantic import BaseModel, Field
from typing_extensions import Annotated

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
)
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.api.delete import delete_entity_from_source
from metadata.ingestion.api.models import Either, Entity
from metadata.ingestion.api.steps import Source
from metadata.ingestion.api.topology_runner import C, TopologyRunnerMixin
from metadata.ingestion.connections.test_connections import (
    raise_test_connection_exception,
)
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.models.delete_entity import DeleteEntity
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.models.patch_request import PatchRequest
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyContextManager,
    TopologyNode,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.utils import fqn
from metadata.utils.filters import filter_by_dashboard, filter_by_project
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

LINEAGE_MAP = {
    Dashboard: "dashboard",
    Table: "table",
    DashboardDataModel: "dashboardDataModel",
    Chart: "chart",
}


class DashboardUsage(BaseModel):
    """
    Wrapper to handle type at the sink
    """

    dashboard: Dashboard
    usage: UsageRequest


class DashboardServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in Dashboard Services.
    service -> data models -> dashboard -> charts.

    We could have a topology validator. We can only consume
    data that has been produced by any parent node.
    """

    root: Annotated[
        TopologyNode, Field(description="Root node for the topology")
    ] = TopologyNode(
        producer="get_services",
        stages=[
            NodeStage(
                type_=DashboardService,
                context="dashboard_service",
                processor="yield_create_request_dashboard_service",
                overwrite=False,
                must_return=True,
                cache_entities=True,
            ),
            NodeStage(
                type_=OMetaTagAndClassification,
                processor="yield_bulk_tags",
                nullable=True,
            ),
        ],
        children=["bulk_data_model", "dashboard"],
        post_process=["mark_dashboards_as_deleted", "mark_datamodels_as_deleted"],
    )
    # Dashboard Services have very different approaches when
    # when dealing with data models. Tableau has the models
    # tightly coupled with dashboards, while Looker
    # handles them as independent entities.
    # When configuring a new source, we will either implement
    # the yield_bulk_datamodel or yield_datamodel functions.
    bulk_data_model: Annotated[
        TopologyNode, Field(description="Write data models in bulk")
    ] = TopologyNode(
        producer="list_datamodels",
        stages=[
            NodeStage(
                type_=DashboardDataModel,
                processor="yield_bulk_datamodel",
                consumer=["dashboard_service"],
                nullable=True,
                use_cache=True,
            )
        ],
    )
    dashboard: Annotated[
        TopologyNode, Field(description="Process dashboards")
    ] = TopologyNode(
        producer="get_dashboard",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                processor="yield_tags",
                nullable=True,
            ),
            NodeStage(
                type_=Chart,
                context="charts",
                processor="yield_dashboard_chart",
                consumer=["dashboard_service"],
                nullable=True,
                store_all_in_context=True,
                clear_context=True,
                use_cache=True,
            ),
            NodeStage(
                type_=DashboardDataModel,
                context="dataModels",
                processor="yield_datamodel",
                consumer=["dashboard_service"],
                nullable=True,
                store_all_in_context=True,
                clear_context=True,
                use_cache=True,
            ),
            NodeStage(
                type_=Dashboard,
                context="dashboard",
                processor="yield_dashboard",
                consumer=["dashboard_service"],
                use_cache=True,
            ),
            NodeStage(
                type_=AddLineageRequest,
                processor="yield_dashboard_lineage",
                consumer=["dashboard_service"],
                nullable=True,
            ),
            NodeStage(
                type_=UsageRequest,
                processor="yield_dashboard_usage",
                consumer=["dashboard_service"],
                nullable=True,
            ),
        ],
    )


# pylint: disable=too-many-public-methods
class DashboardServiceSource(TopologyRunnerMixin, Source, ABC):
    """
    Base class for Database Services.
    It implements the topology and context.
    """

    source_config: DashboardServiceMetadataPipeline
    config: WorkflowSource
    metadata: OpenMetadata
    # Big union of types we want to fetch dynamically
    service_connection: DashboardConnection.model_fields["config"].annotation

    topology = DashboardServiceTopology()
    context = TopologyContextManager(topology)
    dashboard_source_state: Set = set()
    datamodel_source_state: Set = set()

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.source_config: DashboardServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.client = get_connection(self.service_connection)

        # Flag the connection for the test connection
        self.connection_obj = self.client
        self.test_connection()

    @property
    def name(self) -> str:
        return self.service_connection.type.name

    @abstractmethod
    def yield_dashboard(
        self, dashboard_details: Any
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """

    @abstractmethod
    def yield_dashboard_lineage_details(
        self, dashboard_details: Any, db_service_name: str
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        """

    @abstractmethod
    def yield_dashboard_chart(
        self, dashboard_details: Any
    ) -> Iterable[Either[CreateChartRequest]]:
        """
        Method to fetch charts linked to dashboard
        """

    @abstractmethod
    def get_dashboards_list(self) -> Optional[List[Any]]:
        """
        Get List of all dashboards
        """

    @abstractmethod
    def get_dashboard_name(self, dashboard: Any) -> str:
        """
        Get Dashboard Name from each element coming from `get_dashboards_list`
        """

    @abstractmethod
    def get_dashboard_details(self, dashboard: Any) -> Any:
        """
        Get Dashboard Details
        """

    def list_datamodels(self) -> Iterable[Any]:
        """
        Optional Node producer for processing datamodels in bulk
        before the dashboards
        """
        return []

    def yield_datamodel(self, _) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """
        Method to fetch DataModel linked to Dashboard
        """

    def yield_bulk_datamodel(
        self, _
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """
        Method to fetch DataModels in bulk
        """

    def yield_datamodel_dashboard_lineage(
        self,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Returns:
            Lineage request between Data Models and Dashboards
        """
        if hasattr(self.context.get(), "dataModels") and self.context.get().dataModels:
            for datamodel in self.context.get().dataModels:
                try:
                    datamodel_fqn = fqn.build(
                        metadata=self.metadata,
                        entity_type=DashboardDataModel,
                        service_name=self.context.get().dashboard_service,
                        data_model_name=datamodel,
                    )
                    datamodel_entity = self.metadata.get_by_name(
                        entity=DashboardDataModel, fqn=datamodel_fqn
                    )

                    dashboard_fqn = fqn.build(
                        self.metadata,
                        entity_type=Dashboard,
                        service_name=self.context.get().dashboard_service,
                        dashboard_name=self.context.get().dashboard,
                    )
                    dashboard_entity = self.metadata.get_by_name(
                        entity=Dashboard, fqn=dashboard_fqn
                    )
                    yield self._get_add_lineage_request(
                        to_entity=dashboard_entity, from_entity=datamodel_entity
                    )
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error to yield dashboard lineage details for data model name [{str(datamodel)}]: {err}"
                    )

    def get_db_service_names(self) -> List[str]:
        """
        Get the list of db service names
        """
        return (
            self.source_config.lineageInformation.dbServiceNames or []
            if self.source_config.lineageInformation
            else []
        )

    def yield_dashboard_lineage(
        self, dashboard_details: Any
    ) -> Iterable[Either[OMetaLineageRequest]]:
        """
        Yields lineage if config is enabled.

        We will look for the data in all the services
        we have informed.
        """
        for lineage in self.yield_datamodel_dashboard_lineage() or []:
            if lineage.right is not None:
                yield Either(
                    right=OMetaLineageRequest(
                        lineage_request=lineage.right,
                        override_lineage=self.source_config.overrideLineage,
                    )
                )
            else:
                yield lineage

        db_service_names = self.get_db_service_names()
        for db_service_name in db_service_names or []:
            yield from self.yield_dashboard_lineage_details(
                dashboard_details, db_service_name
            ) or []

    def yield_bulk_tags(
        self, *args, **kwargs
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        Method to bulk fetch dashboard tags
        """

    def yield_tags(
        self, dashboard_details
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        Method to fetch dashboard tags
        """

    def yield_dashboard_usage(self, *args, **kwargs) -> Iterable[DashboardUsage]:
        """
        Method to pick up dashboard usage data
        """

    def close(self):
        self.metadata.close()

    def get_services(self) -> Iterable[WorkflowSource]:
        yield self.config

    def yield_create_request_dashboard_service(
        self, config: WorkflowSource
    ) -> Iterable[Either[CreateDashboardServiceRequest]]:
        yield Either(
            right=self.metadata.get_create_service_from_source(
                entity=DashboardService, config=config
            )
        )

    def mark_dashboards_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        """
        Method to mark the dashboards as deleted
        """
        if self.source_config.markDeletedDashboards:
            logger.info("Mark Deleted Dashboards set to True")
            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=Dashboard,
                entity_source_state=self.dashboard_source_state,
                mark_deleted_entity=self.source_config.markDeletedDashboards,
                params={"service": self.context.get().dashboard_service},
            )

    def mark_datamodels_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        """
        Method to mark the datamodels as deleted
        """
        if self.source_config.markDeletedDataModels:
            logger.info("Mark Deleted Datamodels set to True")
            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=DashboardDataModel,
                entity_source_state=self.datamodel_source_state,
                mark_deleted_entity=self.source_config.markDeletedDataModels,
                params={"service": self.context.get().dashboard_service},
            )

    def get_owner_ref(  # pylint: disable=unused-argument, useless-return
        self, dashboard_details
    ) -> Optional[EntityReferenceList]:
        """
        Method to process the dashboard owners
        """
        logger.debug(
            f"Processing ownership is not supported for {self.service_connection.type.name}"
        )
        return None

    def register_record(self, dashboard_request: CreateDashboardRequest) -> None:
        """
        Mark the dashboard record as scanned and update the dashboard_source_state
        """
        dashboard_fqn = fqn.build(
            self.metadata,
            entity_type=Dashboard,
            service_name=dashboard_request.service.root,
            dashboard_name=dashboard_request.name.root,
        )

        self.dashboard_source_state.add(dashboard_fqn)

    def register_record_datamodel(
        self, datamodel_request: CreateDashboardDataModelRequest
    ) -> None:
        """
        Mark the datamodel record as scanned and update the datamodel_source_state
        """
        datamodel_fqn = fqn.build(
            self.metadata,
            entity_type=DashboardDataModel,
            service_name=datamodel_request.service.root,
            data_model_name=datamodel_request.name.root,
        )

        self.datamodel_source_state.add(datamodel_fqn)

    @staticmethod
    def _get_add_lineage_request(
        to_entity: Union[Dashboard, DashboardDataModel],
        from_entity: Union[Table, DashboardDataModel, Dashboard],
        column_lineage: List[ColumnLineage] = None,
    ) -> Optional[Either[AddLineageRequest]]:
        if from_entity and to_entity:
            return Either(
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
                        lineageDetails=LineageDetails(
                            source=LineageSource.DashboardLineage,
                            columnsLineage=column_lineage,
                        ),
                    )
                )
            )

        return None

    @staticmethod
    def _get_data_model_column_fqn(
        data_model_entity: DashboardDataModel, column: str
    ) -> Optional[str]:
        """
        Get fqn of column if exist in table entity
        """
        if not data_model_entity:
            return None
        for tbl_column in data_model_entity.columns:
            if tbl_column.displayName.lower() == column.lower():
                return tbl_column.fullyQualifiedName.root
        return None

    def get_dashboard(self) -> Any:
        """
        Method to iterate through dashboard lists filter dashboards & yield dashboard details
        """
        for dashboard in self.get_dashboards_list():
            dashboard_name = self.get_dashboard_name(dashboard)
            if filter_by_dashboard(
                self.source_config.dashboardFilterPattern,
                dashboard_name,
            ):
                self.status.filter(
                    dashboard_name,
                    "Dashboard Filtered Out",
                )
                continue

            try:
                dashboard_details = self.get_dashboard_details(dashboard)
                self.context.get().project_name = (  # pylint: disable=E1128
                    self.get_project_name(dashboard_details=dashboard_details)
                )
                if filter_by_project(
                    self.source_config.projectFilterPattern,
                    self.context.get().project_name,
                ):
                    self.status.filter(
                        self.context.get().project_name,
                        "Project / Workspace Filtered Out",
                    )
                    continue
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Cannot extract dashboard details from {dashboard}: {exc}"
                )
                continue

            yield dashboard_details

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        result = test_connection_fn(
            self.metadata, self.connection_obj, self.service_connection
        )
        raise_test_connection_exception(result)

    def prepare(self):
        """By default, nothing to prepare"""

    def check_database_schema_name(self, database_schema_name: str):
        """
        Check if the input database schema name is equal to "<default>" and return the input name if it is not.

        Args:
        - database_schema_name (str): A string representing the name of the database schema to be checked.

        Returns:
        - None: If the input database schema name is equal to "<default>".
        - database_schema_name (str): If the input database schema name is not equal to "<default>".
        """
        if database_schema_name == "<default>":
            return None

        return database_schema_name

    def get_project_name(  # pylint: disable=unused-argument, useless-return
        self, dashboard_details: Any
    ) -> Optional[str]:
        """
        Get the project / workspace / folder / collection name of the dashboard
        """
        logger.debug(
            f"Projects are not supported for {self.service_connection.type.name}"
        )
        return None

    def create_patch_request(
        self, original_entity: Entity, create_request: C
    ) -> PatchRequest:
        """
        Method to get the PatchRequest object
        To be overridden by the process if any custom logic is to be applied
        """
        patch_request = PatchRequest(
            original_entity=original_entity,
            new_entity=original_entity.model_copy(update=create_request.__dict__),
        )
        if isinstance(original_entity, Dashboard):
            # For patch the charts need to be entity ref instead of fqn
            charts_entity_ref_list = []
            for chart_fqn in create_request.charts or []:
                chart_entity = self.metadata.get_by_name(entity=Chart, fqn=chart_fqn)
                if chart_entity:
                    charts_entity_ref_list.append(
                        EntityReference(
                            id=chart_entity.id.root,
                            type=LINEAGE_MAP[type(chart_entity)],
                        )
                    )
            patch_request.new_entity.charts = EntityReferenceList(
                charts_entity_ref_list
            )

            # For patch the datamodels need to be entity ref instead of fqn
            datamodel_entity_ref_list = []
            for datamodel_fqn in create_request.dataModels or []:
                datamodel_entity = self.metadata.get_by_name(
                    entity=DashboardDataModel, fqn=datamodel_fqn
                )
                if datamodel_entity:
                    datamodel_entity_ref_list.append(
                        EntityReference(
                            id=datamodel_entity.id.root,
                            type=LINEAGE_MAP[type(datamodel_entity)],
                        )
                    )
            patch_request.new_entity.dataModels = EntityReferenceList(
                datamodel_entity_ref_list
            )
        return patch_request

    def _get_column_lineage(
        self,
        om_table: Table,
        data_model_entity: DashboardDataModel,
        columns_list: List[str],
    ) -> List[ColumnLineage]:
        """
        Get the column lineage from the fields
        """
        try:
            column_lineage = []
            for field in columns_list or []:
                from_column = get_column_fqn(table_entity=om_table, column=field)
                to_column = self._get_data_model_column_fqn(
                    data_model_entity=data_model_entity,
                    column=field,
                )
                if from_column and to_column:
                    column_lineage.append(
                        ColumnLineage(fromColumns=[from_column], toColumn=to_column)
                    )
            return column_lineage
        except Exception as exc:
            logger.debug(f"Error to get column lineage: {exc}")
            logger.debug(traceback.format_exc())
